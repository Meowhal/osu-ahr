import { LobbyPlugin } from "./LobbyPlugin";
import { Lobby, Player } from "..";
import { BanchoResponseType, MpSettingsResult } from "../parsers";
import config from "config";
import Nedb from 'nedb';
import async from "async";

export interface RecorderOption {
  path_player: string,
  path_map: string,
}

export interface PlayerRecord {
  escaped_name: string,
  playCount: number,
  stayTime: number,
  lastVisit: number,
  visitCount: number,
  seenInfo: boolean,
}

export interface MapRecord {
  mapId: number,
  mapTitle: string,
  selectorName: string,
  timeStamp: number,
}

interface DatabaseVersionInfo {
  version: number;
}

const defaultOption = config.get<RecorderOption>("Recorder");
const CurrentPlayerDBVersion = 2;
const CurrentMapDBVersion = 1;

export class Recorder extends LobbyPlugin {
  option: RecorderOption;
  db: { player: Nedb, map: Nedb };
  hasError: boolean = false;
  playerRecords: Map<string, PlayerRecord> = new Map<string, PlayerRecord>();
  mapChanger: Player | null = null;
  task: Promise<void> = Promise.resolve();

  constructor(lobby: Lobby, autoload: boolean, option: Partial<RecorderOption> = {}) {
    super(lobby, "recorder");
    this.option = { ...defaultOption, ...option } as RecorderOption;
    this.db = {
      player: new Nedb(this.option.path_player),
      map: new Nedb(this.option.path_map)
    };
    if (autoload) {
      this.LoadDatabaseAsync();
    }
    this.registerEvents();
  }
  
  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut));
    this.lobby.MatchStarted.on(a => this.onMatchStarted(a.mapId, a.mapTitle));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.Disconnected.on(a => this.onDisconnected());

    this.lobby.ReceivedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.BeatmapChanged:
          this.mapChanger = this.lobby.host;
          break;
      }
    });
  }

  LoadDatabaseAsync(): Promise<void> {
    this.task = this.task.then(() => new Promise<void>((resolve, reject) => {
      async.series([
        cb => this.db.map.loadDatabase(cb),
        cb => this.db.player.loadDatabase(cb)
      ], (err, results) => {
        if (this.checkDbError(err)) { return reject(err); }
        return resolve();
      });
    })).then(
      () => this.migrate());
    return this.task;
  }

  private async migrate(): Promise<void> {
    const dbVersion = await this.getDBVersion();
    let migrated = false;
    if (dbVersion.playerDBVersion == 1) {
      await this.migratePlayerDBfrom1to2();
      migrated = true;
      dbVersion.playerDBVersion = 2;
    }

    if (migrated) {
      await this.setDBVersion(dbVersion.playerDBVersion, dbVersion.mapDBVersion);
    }
  }

  private async getDBVersion(): Promise<{ playerDBVersion: number, mapDBVersion: number }> {
    return new Promise((resolve, reject) => {
      async.series<DatabaseVersionInfo>([
        cb => this.db.player.findOne({ version: { $exists: true } }, cb),
        cb => this.db.map.findOne({ version: { $exists: true } }, cb),
      ], (err, results) => {
        if (this.checkDbError(err)) return reject(err);
        const v = {
          playerDBVersion: 1,
          mapDBVersion: 1
        };
        if (results) {
          v.playerDBVersion = results[0]?.version ?? 1;
          v.mapDBVersion = results[1]?.version ?? 1;
        }
        resolve(v);
      });
    });
  }

  private async setDBVersion(playerDBVersion: number, mapDBVersion: number): Promise<void> {
    return new Promise((resolve, reject) => {
      async.series([
        cb => this.db.player.update(
          { version: { $exists: true } },
          { version: playerDBVersion },
          { upsert: true }, cb),
        cb => this.db.map.update(
          { version: { $exists: true } },
          { version: mapDBVersion },
          { upsert: true }, cb),
      ], (err, results) => {
        if (this.checkDbError(err)) return reject(err);
        resolve();
      });
    });
  }

  private async migratePlayerDBfrom1to2(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.player.find({ eid: { $exists: true } }, (err: any, docs: any[]) => {
        async.eachSeries(docs, (doc, callback) => {
          this.db.player.update({ _id: doc._id }, { $set: { escaped_name: doc.eid }, $unset: { eid: true } }, {}, callback);
        }, (err) => {
          if (this.checkDbError(err)) return reject(err);
          resolve(true);
        })
      });
    });
  }

  private onPlayerJoined(player: Player, slot: number): void {
    if (this.hasError) return;
    this.task = this.task.then(() => this.loadPlayerRecordAsync(player)).then(p => {
      p.lastVisit = Date.now();
      p.visitCount++;
    });
  }

  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[]): any {
    for (let p of playersIn) {
      this.onPlayerJoined(p, 0);
    }
    for (let p of playersOut) {
      this.onPlayerLeft(p);
    }
  }

  private onMatchStarted(mapId: number, mapTitle: string): void {
    if (this.hasError) return;
    this.playerRecords.forEach((r, id) => r.playCount++);
    if (this.mapChanger == null) return;
    const r = {
      mapId,
      mapTitle,
      selectorName: this.mapChanger.escaped_name,
      timeStamp: Date.now(),
    }
    this.task = this.task.then(() => this.saveMapRecordAsync(r));
  }

  private onPlayerLeft(player: Player): void {
    if (this.hasError) return;
    const r = this.playerRecords.get(player.escaped_name);
    if (r == undefined) return;
    r.stayTime += Date.now() - r.lastVisit;
    this.task = this.task
      .then(() => this.savePlayerRecordAsync(player))
      .then(() => {
        this.playerRecords.delete(r.escaped_name);
      });
  }

  private onDisconnected(): void {
    if (this.hasError) return;
    for (let p of this.lobby.players) {
      this.onPlayerLeft(p);
    }
  }

  private loadPlayerRecordAsync(player: Player): Promise<PlayerRecord> {
    return new Promise<PlayerRecord>((resolve, reject) => {
      this.db.player.findOne({ escaped_name: player.escaped_name }, (err: any, doc: PlayerRecord) => {
        if (this.checkDbError(err)) return reject(err);
        if (!doc) {
          doc = {
            escaped_name: player.escaped_name,
            playCount: 0,
            stayTime: 0,
            lastVisit: 0,
            visitCount: 0,
            seenInfo: false,
          }
        }
        this.playerRecords.set(player.escaped_name, doc);
        resolve(doc);
      })
    });
  }

  private savePlayerRecordAsync(player: Player): Promise<void> {
    const record = this.playerRecords.get(player.escaped_name);
    if (record == undefined) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      this.db.player.update(
        { escaped_name: record.escaped_name },
        record,
        { upsert: true },
        err => {
          if (this.checkDbError(err)) return reject(err);
          resolve();
        });
    });
  }

  private saveMapRecordAsync(r: MapRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.map.insert(r, (err, doc) => {
        if (this.checkDbError(err)) return reject(err);
        resolve();
      })
    });
  }

  private checkDbError(err: any): boolean {
    this.hasError = this.hasError || (err != null);
    if (err) {
      this.logger.error(err);
    }
    return this.hasError;
  }
}
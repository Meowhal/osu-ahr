import { LobbyPlugin } from "./LobbyPlugin";
import { ILobby, Player } from "..";
import { BanchoResponseType } from "../parsers";
import config from "config";
import Nedb from 'nedb';
import log4js from "log4js";

const logger = log4js.getLogger("recorder");

export interface RecorderOption {
  path_player: string,
  path_map: string,
}

export interface PlayerRecord {
  _id: string | undefined,
  eid: string,
  playCount: number,
  stayTime: number,
  lastVisit: number,
  visitCount: number,
  seenInfo: boolean,
}

export interface MapRecord {
  mapId: number,
  mapTitle: number,
  selectorId: string,
  timeStamp: number,
}

const defaultOption = config.get<RecorderOption>("Recorder");

export class Recorder extends LobbyPlugin {
  option: RecorderOption;
  db: { player: Nedb, map: Nedb };
  hasError: boolean = false;
  playerRecords: Map<string, PlayerRecord> = new Map<string, PlayerRecord>();
  mapChanger: Player | null = null;
  loadingTask: Promise<void[]> | null = null;

  constructor(lobby: ILobby, autoload: boolean, option: any | null = null) {
    super(lobby);
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
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a));
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.MatchStarted.on(a => this.onMatchStarted(a.mapId, a.mapTitle));

    this.lobby.RecievedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.BeatmapChanged:
          this.mapChanger = this.lobby.host;
          break;
      }
    });
  }

  LoadDatabaseAsync(): Promise<void[]> {
    if (this.loadingTask == null) {
      const t = ((db: Nedb) => new Promise<void>((resolve, reject) => {
        return db.loadDatabase(err => {
          if (this.checkDbError(err)) { reject(err); }
          resolve();
        });
      }));
      this.loadingTask = Promise.all([
        t(this.db.map),
        t(this.db.player)]);
    }
    return this.loadingTask;
  }

  private onPlayerJoined(player: Player, slot: number): void {
    if (this.hasError) return;
    this.loadPlayerRecordAsync(player).then(p => {
      p.lastVisit = Date.now();
      p.visitCount++;
    });
  }

  private onPlayerLeft(player: Player): any {
    if (this.hasError) return;
    const r = this.playerRecords.get(player.escaped_id);
    if (r == undefined) return;
    r.stayTime += Date.now() - r.lastVisit;
    this.savePlayerRecordAsync(player);
  }

  private onMatchStarted(mapId: number, mapTitle: string): any {
    if (this.hasError) return;
    this.playerRecords.forEach((r, id) => r.playCount++);
    if (this.mapChanger == null) return;
    const r = {
      mapId,
      mapTitle,
      selectorId: this.mapChanger.escaped_id,
      timeStamp: Date.now(),
    }
    this.db.map.insert(r);
  }

  private loadPlayerRecordAsync(player: Player): Promise<PlayerRecord> {
    return new Promise<PlayerRecord>((resolve, reject) => {
      this.db.player.findOne({ eid: player.escaped_id }, (err: any, doc: PlayerRecord) => {
        if (this.checkDbError(err)) return reject(err);
        if (!doc) {
          doc = {
            _id: undefined,
            eid: player.escaped_id,
            playCount: 0,
            stayTime: 0,
            lastVisit: 0,
            visitCount: 0,
            seenInfo: false,
          }
        }
        this.playerRecords.set(player.escaped_id, doc);
        resolve(doc);
      })
    });
  }

  private savePlayerRecordAsync(player: Player): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const record = this.playerRecords.get(player.escaped_id);
      if (record == undefined) return resolve();
      if (record._id == undefined) {
        this.db.player.insert(record, (err, doc) => {
          if (this.checkDbError(err)) return reject(err);
          this.playerRecords.set(player.escaped_id, doc);
          resolve();
        });
      } else {
        this.db.player.update({ _id: record._id }, record, undefined, err => {
          if (this.checkDbError(err)) return reject(err);
          resolve();
        });
      }
    });
  }

  private checkDbError(err: any): boolean {
    this.hasError = this.hasError || (err != null);
    if (err) {
      logger.error(err);
    }
    return this.hasError;
  }
}
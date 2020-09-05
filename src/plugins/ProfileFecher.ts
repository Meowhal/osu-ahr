import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { MpSettingsResult } from "../parsers";
import { WebApiClient } from "../webapi/WebApiClient";

import config from "config";
import Nedb from 'nedb';
import { UserProfile } from "../webapi/UserProfile";

export interface ProfileFecherOption {
  db_path: string,
  profile_expired_day: number
}

const defaultOption = config.get<ProfileFecherOption>("profile");

export class ProfileFecher extends LobbyPlugin {
  option: ProfileFecherOption;
  profileDb: Nedb;
  webApiClient: WebApiClient;
  hasError: boolean = false;
  profileMap: Map<string, UserProfile>;
  pendingNames: Set<string>;
  task: Promise<void>;

  constructor(lobby: Lobby, option: Partial<ProfileFecherOption> = {}) {
    super(lobby, "profile");
    this.option = { ...defaultOption, ...option } as ProfileFecherOption;
    this.profileDb = new Nedb(this.option.db_path);
    this.webApiClient = new WebApiClient();
    this.profileMap = new Map<string, UserProfile>();
    this.pendingNames = new Set<string>();
    this.task = this.initializeAsync();
    this.registerEvents();
  }

  private async initializeAsync(): Promise<void> {
    return Promise.all([
      new Promise((resolve, reject) => {
        this.profileDb.loadDatabase(err => {
          if (this.checkDbError(err)) { reject(err); }
          resolve();
        });
      }),
      this.webApiClient.updateToken()
    ]
    ).then();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
  }

  private onPlayerJoined(player: Player): void {
    if (this.hasError) return;
    this.addTaskQueueIfNeeded(player);
  }

  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    playersIn.forEach(player => {
      this.addTaskQueueIfNeeded(player);
    });
  }

  private addTaskQueueIfNeeded(player: Player): boolean {
    if (player.id !== 0) return false;
    let profile = this.profileMap.get(player.name);
    if (profile && !this.isExpiredProfile(profile)) {
      player.id = profile.id;
      player.profile = profile;
      return true;
    }

    if (this.pendingNames.has(player.name)) {
      return false;
    }
    this.pendingNames.add(player.name);

    this.task = this.task.then(async () => {
      let profile = await this.loadProfileFromDB(player);
      if (profile == null) {
        profile = await this.getProfileFromWebApi(player);
        if (profile != null) {
          await this.saveProfileToDB(profile); 
        }
      }

      if (profile != null) {
        player.id = profile.id;
        player.profile = profile;
        this.logger.info("fetch profile :" + player.name);
      } else {
        this.logger.warn("user not found! " + player.name);
      }
      this.pendingNames.delete(player.name);
    });

    return true;
  }

  /**
   * DBから保存されているプロファイルを取得する。
   * プロファイルが保存されていない場合は、nullを返す。
   * プロファイルが期限切れの場合はそのレコードを削除し、nullを返す。
   * @param player 
   */
  private loadProfileFromDB(player: Player): Promise<UserProfile | null> {
    return new Promise<UserProfile | null>((resolve, reject) => {
      this.profileDb.findOne({ name: player.name }, (err: any, doc: UserProfile) => {
        if (this.checkDbError(err)) return reject(err);
        if (!doc) {
          resolve(null);
        } else if (!this.isExpiredProfile(doc)) {
          this.profileMap.set(player.name, doc);
          resolve(doc);
        } else {
          this.profileDb.remove({ name: player.name }, (err: any, n: number) => {
            if (this.checkDbError(err)) return reject(err);
            resolve(null);
          });
        }
      })
    });
  }

  private saveProfileToDB(profile:UserProfile): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.profileDb.remove({ name: profile.username }, (err: any, n: number) => {
        if (this.checkDbError(err)) return reject(err);
        this.profileDb.insert(profile ,(err: any, newdoc:UserProfile) => {
          if (this.checkDbError(err)) return reject(err);
          resolve();
        });
      });
    });
  }

  private getProfileFromWebApi(player: Player) : Promise<UserProfile | null> {
    return this.webApiClient.getUser(player.name);
  }

  private isExpiredProfile(profile: UserProfile): boolean {
    return Date.now() < this.option.profile_expired_day * 24 * 60 * 60 * 1000 + profile.get_time;
  }

  private checkDbError(err: any): boolean {
    this.hasError = this.hasError || (err != null);
    if (err) {
      this.logger.error(err);
    }
    return this.hasError;
  }
}
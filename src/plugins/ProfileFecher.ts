import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { MpSettingsResult } from "../parsers";
import { WebApiClient } from "../webapi/WebApiClient";

import config from "config";

import { UserProfile } from "../webapi/UserProfile";

export interface ProfileFecherOption {
  profile_expired_day: number
}

const defaultOption = config.get<ProfileFecherOption>("profile");

export class ProfileFecher extends LobbyPlugin {
  option: ProfileFecherOption;
  webApiClient: WebApiClient;
  hasError: boolean = false;
  profileMap: Map<string, UserProfile>;
  pendingNames: Set<string>;
  task: Promise<void>;

  constructor(lobby: Lobby, option: Partial<ProfileFecherOption> = {}) {
    super(lobby, "profile");
    this.option = { ...defaultOption, ...option } as ProfileFecherOption;
    this.webApiClient = new WebApiClient();
    this.profileMap = new Map<string, UserProfile>();
    this.pendingNames = new Set<string>();
    this.task = this.initializeAsync();
    this.registerEvents();
  }

  private async initializeAsync(): Promise<void> {
    await this.webApiClient.updateToken();
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
      try {
        let profile = await this.getProfileFromWebApi(player);

        if (profile != null) {
          player.id = profile.id;
          player.profile = profile;
          this.logger.info("fetch profile :" + player.name);
        } else {
          this.logger.warn("user not found! " + player.name);
        }
        this.pendingNames.delete(player.name);
      } catch (e) {
        this.logger.error("@addTaskQueueIfNeeded" + e);
      }

    });

    return true;
  }

  private getProfileFromWebApi(player: Player): Promise<UserProfile | null> {
    return this.webApiClient.getUser(player.name);
  }

  private isExpiredProfile(profile: UserProfile): boolean {
    return Date.now() < this.option.profile_expired_day * 24 * 60 * 60 * 1000 + profile.get_time;
  }
}
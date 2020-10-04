import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { MpSettingsResult } from "../parsers";

import { HistoryRepository } from "../webapi/HistoryRepository";
import config from "config";
import { User } from "../webapi/HistoryTypes";

export interface HistoryLoaderOption {
}

enum LoadingStatus {
  Idle,
  Loading,
  Cooling,
  Peinding,
}

const defaultOption = config.get<HistoryLoaderOption>("history");
export class HistoryLoader extends LobbyPlugin {
  option: HistoryLoaderOption;
  task: Promise<void>;
  repository: HistoryRepository | null = null;
  status: LoadingStatus = LoadingStatus.Idle;
  coolTime: number = 5 * 1000;

  constructor(lobby: Lobby, option: Partial<HistoryLoaderOption> = {}) {
    super(lobby, "history");
    this.option = { ...defaultOption, ...option } as HistoryLoaderOption;
    this.task = Promise.resolve();
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.JoinedLobby.on(a => this.onJoinedLobby(a.channel));
    this.lobby.MatchStarted.on(a => this.onMatchStarted(a.mapId, a.mapTitle));
  }

  async onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): Promise<void> {
    await this.queueTask();
    if (!this.repository) return;
    let order = (await this.repository.calcCurrentOrderAsName()).join(",");
    this.SendPluginMessage("reorder", [order]);
  }

  onPlayerJoined(player: Player): any {
    this.queueTask();
  }

  onJoinedLobby(channel: string): any {
    if (this.lobby.lobbyId) {
      this.repository = new HistoryRepository(parseInt(this.lobby.lobbyId));
      this.repository.gotUserProfile.on(a => this.onGotUserProfile(a.user));
      this.repository.changedLobbyName.on(a => this.onChangedLobbyName(a.newName, a.oldName));
    }
  }

  onMatchStarted(mapId: number, mapTitle: string): any {
    this.queueTask();
  }
  
  onGotUserProfile(user: User): any {
    let p = this.lobby.GetOrMakePlayer(user.username);
    p.id = user.id;
  }

  onChangedLobbyName(newName: string, oldName: string): any {
    this.lobby.lobbyName = newName;
    this.logger.info(`lobbyname changed : ${newName} -> ${oldName}, host : ${this.lobby.host?.name}`);
  }

  queueTask(): Promise<void> {
    if (!this.repository) return this.task;
    switch (this.status) {
      case LoadingStatus.Idle:
        this.status = LoadingStatus.Loading;
        this.task = this.repository.updateToLatest()
          .then(_ => {
            this.status = LoadingStatus.Cooling;
            return delay(this.coolTime);
          }).then(_ => {
            if (this.status == LoadingStatus.Peinding) {
              this.status = LoadingStatus.Idle;
              return this.queueTask();
            } else {
              this.status = LoadingStatus.Idle;
            }
          });
        break;

      case LoadingStatus.Cooling:
        this.status = LoadingStatus.Peinding;
        break;
    }

    return this.task;
  }

  GetPluginStatus(): string {
    return `-- HistoryLoader --
  status : ${this.status.toString()}
  hasError : ${this.repository?.hasError}
  loaded events : ${this.repository?.events.length}`
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
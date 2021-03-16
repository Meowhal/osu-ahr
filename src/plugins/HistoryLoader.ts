import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { MpSettingsResult } from "../parsers";

import { HistoryRepository } from "../webapi/HistoryRepository";
import config from "config";
import { User } from "../webapi/HistoryTypes";

export interface HistoryLoaderOption {
  fetch_interval_ms: number; // ヒストリー取得間隔
}

const defaultOption = config.get<HistoryLoaderOption>("HistoryLoader");

/**
 * 定期的にhistoryを取得し、lobbyのhistoryrepositoryに保存する
 */
export class HistoryLoader extends LobbyPlugin {
  option: HistoryLoaderOption;
  repository: HistoryRepository;
  fetchInvervalId: NodeJS.Timeout | null = null;

  constructor(lobby: Lobby, option: Partial<HistoryLoaderOption> = {}) {
    super(lobby, "history");
    this.option = { ...defaultOption, ...option } as HistoryLoaderOption;
    this.repository = lobby.historyRepository;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.JoinedLobby.on(a => this.onJoinedLobby(a.channel));
    this.lobby.Disconnected.on(a => this.stopFetch());
  }

  async onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): Promise<void> {
    if (!this.repository) return;
    let order = (await this.repository.calcCurrentOrderAsName()).join(",");
    this.SendPluginMessage("reorder", [order]);
  }

  onJoinedLobby(channel: string): any {
    if (this.lobby.lobbyId) {
      this.repository.lobbyId = parseInt(this.lobby.lobbyId);
      this.repository.gotUserProfile.on(a => this.onGotUserProfile(a.user));
      this.repository.changedLobbyName.on(a => this.onChangedLobbyName(a.newName, a.oldName));
      this.startFetch();
    }
  }

  onGotUserProfile(user: User): any {
    let p = this.lobby.GetOrMakePlayer(user.username);
    p.id = user.id;
  }

  onChangedLobbyName(newName: string, oldName: string): any {
    this.lobby.lobbyName = newName;
    this.logger.info(`lobbyname changed : ${oldName} -> ${newName}, host : ${this.lobby.host?.name}`);
  }

  startFetch(): void {
    this.stopFetch();
    if (this.option.fetch_interval_ms >= 5000) {
      this.logger.trace("start fetching");
      this.fetchInvervalId = setInterval(() => {
        if (!this.lobby.isMatching) {
          this.repository.updateToLatest();
        }        
      }, this.option.fetch_interval_ms);
    }
  }

  stopFetch(): void {
    if (this.fetchInvervalId) {
      this.logger.trace("stop fetching");
      clearInterval(this.fetchInvervalId);
      this.fetchInvervalId = null;
    }
  }

  GetPluginStatus(): string {
    return `-- HistoryLoader -- hasError : ${this.repository?.hasError}, latest : ${this.repository?.latestEventId} loaded events : ${this.repository?.events.length}`
  }
}
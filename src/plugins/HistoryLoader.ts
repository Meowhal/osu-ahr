import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { MpSettingsResult } from '../parsers/MpSettingsParser';
import { HistoryRepository } from '../webapi/HistoryRepository';
import { User } from '../webapi/HistoryTypes';
import { getConfig } from '../TypedConfig';

export interface HistoryLoaderOption {
  fetch_interval_ms: number; // ヒストリー取得間隔
}

/**
 * 定期的にhistoryを取得し、lobbyのhistoryrepositoryに保存する
 */
export class HistoryLoader extends LobbyPlugin {
  option: HistoryLoaderOption;
  repository: HistoryRepository;
  fetchInvervalId: NodeJS.Timeout | null = null;

  constructor(lobby: Lobby, option: Partial<HistoryLoaderOption> = {}) {
    super(lobby, 'HistoryLoader', 'history');
    this.option = getConfig(this.pluginName, option) as HistoryLoaderOption;
    this.repository = lobby.historyRepository;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.FixedSettings.on(a => this.onFixedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.JoinedLobby.on(a => this.onJoinedLobby(a.channel));
    this.lobby.MatchStarted.on(a => this.onMatchStarted());
    this.lobby.LeftChannel.on(a => this.stopFetch());
  }

  async onFixedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): Promise<void> {
    if (!this.repository) return;
    const order = (await this.repository.calcCurrentOrderAsName()).join(',');
    this.SendPluginMessage('reorder', [order]);
  }

  onJoinedLobby(channel: string): any {
    if (this.lobby.lobbyId) {
      this.repository.lobbyId = parseInt(this.lobby.lobbyId);
      this.repository.gotUserProfile.on(a => this.onGotUserProfile(a.user));
      this.repository.changedLobbyName.on(a => this.onChangedLobbyName(a.newName, a.oldName));
      this.startFetch();
    }
  }

  onMatchStarted() {
    if (this.fetchInvervalId === null) {
      this.repository.updateToLatest();
    }
  }

  onGotUserProfile(user: User): any {
    const p = this.lobby.GetOrMakePlayer(user.username);
    p.id = user.id;
  }

  onChangedLobbyName(newName: string, oldName: string): any {
    this.lobby.lobbyName = newName;
    this.logger.info(`Lobby name has been changed: ${oldName} -> ${newName}, Host: ${this.lobby.host?.name}`);
  }

  startFetch(): void {
    this.stopFetch();
    if (this.option.fetch_interval_ms >= 5000) {
      this.logger.trace('Started fetching.');
      this.fetchInvervalId = setInterval(() => {
        if (!this.lobby.isMatching) {
          this.repository.updateToLatest();
        }
      }, this.option.fetch_interval_ms);
    }
  }

  stopFetch(): void {
    if (this.fetchInvervalId) {
      this.logger.trace('Stopped fetching.');
      clearInterval(this.fetchInvervalId);
      this.fetchInvervalId = null;
    }
  }

  GetPluginStatus(): string {
    return `-- History Loader --
  hasError: ${this.repository?.hasError}
  Latest: ${this.repository?.latestEventId}
  Loaded events: ${this.repository?.events.length}`;
  }
}

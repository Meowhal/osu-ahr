import { Lobby } from '../Lobby';
import { BanchoResponseType, BanchoResponse } from '../parsers/CommandParser';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { getConfig } from '../TypedConfig';

export interface AutoStartTimerOption {
  enabled: boolean;
  doClearHost: boolean;
  waitingTime: number;
}

const WAITINGTIME_MIN = 15;

export class AutoStartTimer extends LobbyPlugin {
  option: AutoStartTimerOption;
  lastMapId: number;
  useMapValidation: boolean = false;
  constructor(lobby: Lobby, option: Partial<AutoStartTimerOption> = {}) {
    super(lobby, 'AutoStartTimer', 'autostart');
    this.option = getConfig(this.pluginName, option) as AutoStartTimerOption;
    this.lastMapId = 0;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.player, a.command, a.param));
    this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
  }

  private onReceivedChatCommand(player: Player, command: string, param: string): void {
    if (this.lobby.isMatching) return;
    if (!player.isAuthorized) return;
    switch (command) {
      case '*autostart_enable':
        this.option.enabled = true;
        break;
      case '*autostart_disable':
        this.option.enabled = false;
        break;
      case '*autostart_time':
        let ct = parseInt(param);
        if (Number.isNaN(ct)) {
          this.logger.warn(`Invalid Auto Start Timer time parameter: ${param}`);
          return;
        }
        if (ct < WAITINGTIME_MIN) {
          ct = WAITINGTIME_MIN;
        }
        this.option.waitingTime = ct;
        break;
      case '*autostart_clearhost_enable':
        this.option.doClearHost = true;
        break;
      case '*atuostart_clearhost_disable':
        this.option.doClearHost = false;
        break;
    }
  }

  private onReceivedBanchoResponse(message: string, response: BanchoResponse): void {
    if (!this.option.enabled || this.option.waitingTime < WAITINGTIME_MIN) return;

    switch (response.type) {
      case BanchoResponseType.BeatmapChanged:
        if (this.lobby.players.size === 1 || response.params[0] === this.lastMapId || this.useMapValidation) break;
        this.startTimer();
        break;
      case BanchoResponseType.BeatmapChanging:
      case BanchoResponseType.HostChanged:
        if (this.lobby.isStartTimerActive) {
          this.lobby.SendMessage('!mp aborttimer');
        }
        this.SendPluginMessage('mp_abort_start');
        break;
      case BanchoResponseType.MatchStarted:
        this.lastMapId = this.lobby.mapId;
        break;
    }
  }

  private startTimer() {
    if (!this.option.enabled || this.option.waitingTime < WAITINGTIME_MIN) return;
    this.SendPluginMessage('mp_start', [this.option.waitingTime.toString(), 'withhelp']);
    if (this.option.doClearHost) {
      this.lobby.SendMessage('!mp clearhost');
    }
  }

  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    switch (type) {
      case 'enabledMapChecker':
        this.useMapValidation = true;
        break;
      case 'disabledMapChecker':
        this.useMapValidation = false;
        break;
      case 'validatedMap':
        this.startTimer();
        break;
    }
  }
}

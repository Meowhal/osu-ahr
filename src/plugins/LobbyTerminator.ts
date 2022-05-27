import { LobbyPlugin } from './LobbyPlugin';
import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { getConfig } from '../TypedConfig';

export interface LobbyTerminatorOption {
  terminate_time_ms: number;
}

export class LobbyTerminator extends LobbyPlugin {
  option: LobbyTerminatorOption;
  terminateTimer: NodeJS.Timer | undefined;
  multilimeMessageInterval: number = 1000;

  constructor(lobby: Lobby, option: Partial<LobbyTerminatorOption> = {}) {
    super(lobby, 'LobbyTerminator', 'terminator');
    this.option = getConfig(this.pluginName, option) as LobbyTerminatorOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p.player));
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player, p.slot));
    this.lobby.LeftChannel.on(p => {
      if (this.terminateTimer) {
        clearTimeout(this.terminateTimer);
      }
    });
  }

  private onPlayerJoined(player: Player, slot: number): void {
    if (this.terminateTimer) {
      clearTimeout(this.terminateTimer);
      this.terminateTimer = undefined;
      this.logger.trace('Cleared the lobby terminator timer.');
    }
  }

  private onPlayerLeft(p: Player): void {
    if (this.lobby.players.size === 0) {
      if (this.terminateTimer) {
        clearTimeout(this.terminateTimer);
      }
      this.logger.trace('Started the lobby terminator timer.');
      this.terminateTimer = setTimeout(() => {
        this.logger.info('Terminated the lobby.');
        this.lobby.CloseLobbyAsync();
      }, this.option.terminate_time_ms);
    }
  }

  CloseLobby(time_ms: number = 0): void {
    if (time_ms === 0) {
      if (this.lobby.players.size === 0) {
        this.logger.info('Terminated the lobby.');
        this.lobby.CloseLobbyAsync();
      } else {
        this.lobby.SendMultilineMessageWithInterval([
          '!mp password closed',
          'This lobby will be closed when everyone leaves.',
          'Thank you for playing with the auto host rotation lobby.'
        ], this.multilimeMessageInterval, 'close lobby announcement', 100000);
        this.option.terminate_time_ms = 1000;
      }
    } else {
      this.lobby.SendMultilineMessageWithInterval([
        '!mp password closed',
        `This lobby will be closed in ${(time_ms / 1000).toFixed(0)}sec(s).`,
        'Thank you for playing with the auto host rotation lobby.'
      ], this.multilimeMessageInterval, 'close lobby announcement', 100000)
        .then(() => this.sendMessageWithDelay('!mp close', time_ms));
    }
  }

  private sendMessageWithDelay(message: string, delay: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.lobby.SendMessage(message);
        resolve();
      }, delay);
    });
  }
}

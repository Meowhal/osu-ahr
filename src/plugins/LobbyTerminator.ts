import { LobbyPlugin } from "./LobbyPlugin";
import { ILobby, Player } from "..";
import { BanchoResponseType } from "../parsers";
import config from "config";

export interface LobbyTerminatorOption {
  terminate_time_ms: number;
  terminate_when_sleep_msg: boolean;
  sleep_message_interval: number;
}

const LobbyTerminatorDefaultOption = config.get<LobbyTerminatorOption>("LobbyTerminator");

export class LobbyTerminator extends LobbyPlugin {
  option: LobbyTerminatorOption;
  terminateTimer: NodeJS.Timer | undefined;

  constructor(lobby: ILobby, option: Partial<LobbyTerminatorOption> = {}) {
    super(lobby, "terminator");
    this.option = { ...LobbyTerminatorDefaultOption, ...option } as LobbyTerminatorOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player, p.slot));
    if (this.option.terminate_when_sleep_msg) {
      this.lobby.RecievedBanchoResponse.on(p => {
        if (p.response.type == BanchoResponseType.RequestSleep) {
          this.CloseLobby();
        }
      });
    }
  }
  onPlayerJoined(player: Player, slot: number): void {
    if (this.terminateTimer) {
      clearTimeout(this.terminateTimer);
      this.terminateTimer = undefined;
      this.logger.trace("terminate_timer canceled");
    }
  }
  onPlayerLeft(p: Player): void {
    if (this.lobby.players.size == 0) {
      if (this.terminateTimer) {
        clearTimeout(this.terminateTimer);
      }
      this.logger.trace("terminate_timer start")
      this.terminateTimer = setTimeout(() => {
        this.logger.info("terminated lobby");
        this.lobby.CloseLobbyAsync();
      }, this.option.terminate_time_ms);
    }
  }

  CloseLobby(time_ms: number = 0): void {
    if (time_ms == 0) {
      this.lobby.SendMultilineMessageWithInterval([
        "!mp password closed",
        "This lobby will be closed after everyone leaves.",
        "Thank you for playing with the auto host rotation lobby."
      ], this.option.sleep_message_interval, "close lobby announcement", 100000);
      this.option.terminate_time_ms = 1000;
    } else {
      this.lobby.SendMultilineMessageWithInterval([
        "!mp password closed",
        `This lobby will be closed in ${(time_ms / 1000).toFixed(0)}sec(s).`,
        "Thank you for playing with the auto host rotation lobby."
      ], this.option.sleep_message_interval, "close lobby announcement", 100000)
        .then(() => this.sendMessageWithDelay("!mp close", time_ms));
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
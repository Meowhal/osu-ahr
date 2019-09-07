import { LobbyPlugin } from "./LobbyPlugin";
import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { BanchoResponseType } from "../parsers";
import log4js from "log4js";
import config from "config";
import pkg from "../../package.json";

const logger = log4js.getLogger("lobbyTerminator");

export interface LobbyTerminatorOption {
  terminate_time_ms: number;
  terminate_when_sleep_msg: boolean;
  sleep_message_interval: number;

}
const LobbyTerminatorDefaultOption = config.get<LobbyTerminatorOption>("LobbyTerminator");

export class LobbyTerminator extends LobbyPlugin {
  option: LobbyTerminatorOption;
  terminateTimer: NodeJS.Timer | undefined;

  constructor(lobby: ILobby, option: any | null = null) {
    super(lobby);
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
      logger.trace("terminate_timer canceled");
    }
  }
  onPlayerLeft(p: Player): void {
    if (this.lobby.players.size == 0) {
      if (this.terminateTimer) {
        clearTimeout(this.terminateTimer);
      }
      logger.trace("terminate_timer start")
      this.terminateTimer = setTimeout(() => {
        logger.info("terminated lobby");
        this.lobby.CloseLobbyAsync();
      }, this.option.terminate_time_ms);
    }
  }

  CloseLobby(time_ms: number = 0): void {
    if (time_ms == 0) {
      this.sendMessageWithDelay("!mp password closed", this.option.sleep_message_interval)
        .then(() => this.sendMessageWithDelay("This lobby will be closed after everyone leaves.", this.option.sleep_message_interval))
        .then(() => this.sendMessageWithDelay("Thank you for playing with the auto host rotation bot.", this.option.sleep_message_interval))
        .then(() => this.sendMessageWithDelay(`- You can get the information about this bot from [${pkg.homepage} github:osu-ahr].`, this.option.sleep_message_interval));
      this.option.terminate_time_ms = 1000;
    } else {
      this.sendMessageWithDelay("!mp password closed", this.option.sleep_message_interval)
        .then(() => this.sendMessageWithDelay(`This lobby will be closed after ${(time_ms / 1000).toFixed(0)}sec(s).`, this.option.sleep_message_interval))
        .then(() => this.sendMessageWithDelay("Thank you for playing with the auto host rotation bot.", this.option.sleep_message_interval))
        .then(() => this.sendMessageWithDelay(`- You can get the information about this bot from [${pkg.homepage} github:osu-ahr].`, time_ms))
        .then(() => this.lobby.SendMessage("!mp close"));
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
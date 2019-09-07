import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import log4js from "log4js";
import config from "config";
const logger = log4js.getLogger("lobbyTerminator");

export interface LobbyTerminatorOption {
  terminate_time_ms: number;
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
    this.lobby.RecievedBanchoResponse.on(p => {
      
    });
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
}
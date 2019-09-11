import { LobbyPlugin } from "./LobbyPlugin";
import { ILobby, Player } from "..";
import { BanchoResponseType, BanchoResponse } from "../parsers";
import log4js from "log4js";

const logger = log4js.getLogger("InOut");

export class InOutLogger extends LobbyPlugin {
  players: Set<Player> = new Set<Player>();

  constructor(lobby: ILobby) {
    super(lobby);
    this.lobby.RecievedBanchoResponse.on(a => this.onRecievedBanchoResponse(a.message, a.response));
  }

  private onRecievedBanchoResponse(message: string, response: BanchoResponse): void {
    switch (response.type) {
      case BanchoResponseType.MatchStarted:
      case BanchoResponseType.MatchFinished:
      case BanchoResponseType.AbortedMatch:
        this.logInOutPlayers();
        this.saveCurrentPlayers();
        break;
    }
  }

  logInOutPlayers(): void {
    if (logger.isDebugEnabled) {
      const msgOut = Array.from(this.players).filter(p => !this.lobby.players.has(p)).map(p => p.id).join(", ");
      const msgIn = Array.from(this.lobby.players).filter(p => !this.players.has(p)).map(p => p.id).join(", ");
      let msg = "";

      if (msgIn != "") msg = "In > \x1b[32m" + msgIn +"\x1b[0m";
      if (msgOut != "") {
        if (msg != "") msg += ", "
        msg += "out < \x1b[31m" + msgOut + "\x1b[0m";
      }
      logger.debug(msg);
    }
  }

  saveCurrentPlayers(): void {
    this.players.clear();
    this.lobby.players.forEach(p => this.players.add(p));
  }
}
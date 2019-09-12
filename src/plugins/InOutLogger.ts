import { ILobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType, BanchoResponse } from "../parsers";

export class InOutLogger extends LobbyPlugin {
  players: Set<Player> = new Set<Player>();

  constructor(lobby: ILobby) {
    super(lobby, "inout");
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
    if (this.logger.isInfoEnabled) {
      const msgOut = Array.from(this.players).filter(p => !this.lobby.players.has(p)).map(p => p.id).join(", ");
      const msgIn = Array.from(this.lobby.players).filter(p => !this.players.has(p)).map(p => p.id).join(", ");
      let msg = "";
      if (msgIn != "") {
        msg = "+ \x1b[32m" + msgIn + "\x1b[0m";
      }
      if (msgOut != "") {
        if (msg != "") msg += ", "
        msg += "- \x1b[31m" + msgOut + "\x1b[0m";
      }
      if (msg != "") {
        this.logger.info(msg);
      }
    }
  }

  saveCurrentPlayers(): void {
    this.players.clear();
    this.lobby.players.forEach(p => this.players.add(p));
  }
}
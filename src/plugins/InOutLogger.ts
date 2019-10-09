import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType, BanchoResponse } from "../parsers";

export class InOutLogger extends LobbyPlugin {
  players: Set<Player> = new Set<Player>();

  constructor(lobby: Lobby) {
    super(lobby, "inout");
    this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
  }

  private onReceivedBanchoResponse(message: string, response: BanchoResponse): void {
    switch (response.type) {
      case BanchoResponseType.MatchStarted:
      case BanchoResponseType.MatchFinished:
      case BanchoResponseType.AbortedMatch:
        this.LogInOutPlayers();
        this.saveCurrentPlayers();
        break;
    }
  }

  GetInOutLog(useColor: boolean): string {
    const msgOut = Array.from(this.players).filter(p => !this.lobby.players.has(p)).map(p => p.id).join(", ");
    const msgIn = Array.from(this.lobby.players).filter(p => !this.players.has(p)).map(p => p.id).join(", ");
    let msg = "";
    const ctagIn = useColor ? "\x1b[32m" : "";
    const ctagOut = useColor ? "\x1b[31m" : "";
    const ctagEnd = useColor ? "\x1b[0m" : "";
    if (msgIn != "") {
      msg = `+${ctagIn} ${msgIn} ${ctagEnd}`;
    }
    if (msgOut != "") {
      if (msg != "") msg += ", "
      msg += `-${ctagOut} ${msgOut} ${ctagEnd}`;
    }
    return msg;
  }

  LogInOutPlayers(): void {
    if (this.logger.isInfoEnabled) {
      const msg = this.GetInOutLog(true);
      if (msg != "") {
        this.logger.info(msg);
      }
    }
  }

  private saveCurrentPlayers(): void {
    this.players.clear();
    this.lobby.players.forEach(p => this.players.add(p));
  }
}
import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { BanchoResponseType, BanchoResponse } from '../parsers/CommandParser';

export class InOutLogger extends LobbyPlugin {
  players: Map<Player, number> = new Map<Player, number>();
  withColorTag: boolean = true;

  constructor(lobby: Lobby) {
    super(lobby, 'InOutLogger', 'inout');
    this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
  }

  private onReceivedBanchoResponse(message: string, response: BanchoResponse): void {
    switch (response.type) {
      case BanchoResponseType.MatchFinished:
        this.countUp();
        this.LogInOutPlayers();
        this.saveCurrentPlayers();
        break;
      case BanchoResponseType.MatchStarted:
      case BanchoResponseType.AbortedMatch:
        this.LogInOutPlayers();
        this.saveCurrentPlayers();
        break;
    }
  }

  GetInOutPlayers() {
    const outa = Array.from(this.players.keys()).filter(p => !this.lobby.players.has(p));
    const ina = Array.from(this.lobby.players).filter(p => !this.players.has(p));
    return { in: ina, out: outa };
  }

  GetInOutLog(useColor: boolean): string {
    const arr = this.GetInOutPlayers();
    const msgOut = arr.out.map(p => {
      const num = this.players.get(p) || 0;
      return `${p.name}(${num})`;
    }).join(', ');
    const msgIn = arr.in.map(p => p.name).join(', ');
    let msg = '';
    const ctagIn = useColor ? '\x1b[32m' : '';
    const ctagOut = useColor ? '\x1b[31m' : '';
    const ctagEnd = useColor ? '\x1b[0m' : '';
    if (msgIn !== '') {
      msg = `+${ctagIn} ${msgIn} ${ctagEnd}`;
    }
    if (msgOut !== '') {
      if (msg !== '') msg += ', ';
      msg += `-${ctagOut} ${msgOut} ${ctagEnd}`;
    }
    return msg;
  }

  LogInOutPlayers(): void {
    if (this.logger.isInfoEnabled()) {
      const msg = this.GetInOutLog(this.withColorTag);
      if (msg !== '') {
        this.logger.info(msg);
      }
    }
  }

  private saveCurrentPlayers(): void {
    for (const p of this.lobby.players) {
      const num = this.players.get(p);
      if (num === undefined) {
        this.players.set(p, 0);
      }
    }
    for (const p of this.players.keys()) {
      if (!this.lobby.players.has(p)) {
        this.players.delete(p);
      }
    }
  }

  private countUp(): void {
    for (const p of this.players.keys()) {
      const num = this.players.get(p);
      if (num !== undefined) {
        this.players.set(p, num + 1);
      }
    }
  }

  GetPluginStatus(): string {
    const m = Array.from(this.players.keys()).map(p => {
      const num = this.players.get(p) || 0;
      return `${p.name}(${num})`;
    }).join(', ');
    return `-- In Out Logger -- 
  Player(s): ${m}`;
  }
}

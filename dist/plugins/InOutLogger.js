"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InOutLogger = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const CommandParser_1 = require("../parsers/CommandParser");
class InOutLogger extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby) {
        super(lobby, 'InOutLogger', 'inout');
        this.players = new Map();
        this.withColorTag = true;
        this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
    }
    onReceivedBanchoResponse(message, response) {
        switch (response.type) {
            case CommandParser_1.BanchoResponseType.MatchFinished:
                this.countUp();
                this.LogInOutPlayers();
                this.saveCurrentPlayers();
                break;
            case CommandParser_1.BanchoResponseType.MatchStarted:
            case CommandParser_1.BanchoResponseType.AbortedMatch:
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
    GetInOutLog(useColor) {
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
            if (msg !== '')
                msg += ', ';
            msg += `-${ctagOut} ${msgOut} ${ctagEnd}`;
        }
        return msg;
    }
    LogInOutPlayers() {
        if (this.logger.isInfoEnabled()) {
            const msg = this.GetInOutLog(this.withColorTag);
            if (msg !== '') {
                this.logger.info(msg);
            }
        }
    }
    saveCurrentPlayers() {
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
    countUp() {
        for (const p of this.players.keys()) {
            const num = this.players.get(p);
            if (num !== undefined) {
                this.players.set(p, num + 1);
            }
        }
    }
    GetPluginStatus() {
        const m = Array.from(this.players.keys()).map(p => {
            const num = this.players.get(p) || 0;
            return `${p.name}(${num})`;
        }).join(', ');
        return `-- In Out Logger -- 
  Player(s): ${m}`;
    }
}
exports.InOutLogger = InOutLogger;
//# sourceMappingURL=InOutLogger.js.map
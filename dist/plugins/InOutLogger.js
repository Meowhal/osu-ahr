"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InOutLogger = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const parsers_1 = require("../parsers");
class InOutLogger extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby) {
        super(lobby, "InOutLogger", "inout");
        this.players = new Map();
        this.withColorTag = true;
        this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
    }
    onReceivedBanchoResponse(message, response) {
        switch (response.type) {
            case parsers_1.BanchoResponseType.MatchFinished:
                this.countUp();
            case parsers_1.BanchoResponseType.MatchStarted:
            case parsers_1.BanchoResponseType.AbortedMatch:
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
            let num = this.players.get(p) || 0;
            return `${p.name}(${num})`;
        }).join(", ");
        const msgIn = arr.in.map(p => p.name).join(", ");
        let msg = "";
        const ctagIn = useColor ? "\x1b[32m" : "";
        const ctagOut = useColor ? "\x1b[31m" : "";
        const ctagEnd = useColor ? "\x1b[0m" : "";
        if (msgIn != "") {
            msg = `+${ctagIn} ${msgIn} ${ctagEnd}`;
        }
        if (msgOut != "") {
            if (msg != "")
                msg += ", ";
            msg += `-${ctagOut} ${msgOut} ${ctagEnd}`;
        }
        return msg;
    }
    LogInOutPlayers() {
        if (this.logger.isInfoEnabled()) {
            const msg = this.GetInOutLog(this.withColorTag);
            if (msg != "") {
                this.logger.info(msg);
            }
        }
    }
    saveCurrentPlayers() {
        for (let p of this.lobby.players) {
            let num = this.players.get(p);
            if (num === undefined) {
                this.players.set(p, 0);
            }
        }
        for (let p of this.players.keys()) {
            if (!this.lobby.players.has(p)) {
                this.players.delete(p);
            }
        }
    }
    countUp() {
        for (let p of this.players.keys()) {
            let num = this.players.get(p);
            if (num !== undefined) {
                this.players.set(p, num + 1);
            }
        }
    }
    GetPluginStatus() {
        const m = Array.from(this.players.keys()).map(p => {
            let num = this.players.get(p) || 0;
            return `${p.name}(${num})`;
        }).join(", ");
        return `-- InOut -- 
  players: ${m}`;
    }
}
exports.InOutLogger = InOutLogger;
//# sourceMappingURL=InOutLogger.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyTerminator = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const config_1 = __importDefault(require("config"));
class LobbyTerminator extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "LobbyTerminator", "terminator");
        this.multilimeMessageInterval = 1000;
        const d = config_1.default.get(this.pluginName);
        this.option = { ...d, ...option };
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p.player));
        this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player, p.slot));
        this.lobby.LeftChannel.on(p => {
            if (this.terminateTimer) {
                clearTimeout(this.terminateTimer);
            }
        });
    }
    onPlayerJoined(player, slot) {
        if (this.terminateTimer) {
            clearTimeout(this.terminateTimer);
            this.terminateTimer = undefined;
            this.logger.trace("terminate_timer canceled");
        }
    }
    onPlayerLeft(p) {
        if (this.lobby.players.size == 0) {
            if (this.terminateTimer) {
                clearTimeout(this.terminateTimer);
            }
            this.logger.trace("terminate_timer start");
            this.terminateTimer = setTimeout(() => {
                this.logger.info("terminated lobby");
                this.lobby.CloseLobbyAsync();
            }, this.option.terminate_time_ms);
        }
    }
    CloseLobby(time_ms = 0) {
        if (time_ms == 0) {
            if (this.lobby.players.size == 0) {
                this.logger.info("terminated lobby");
                this.lobby.CloseLobbyAsync();
            }
            else {
                this.lobby.SendMultilineMessageWithInterval([
                    "!mp password closed",
                    "This lobby will be closed after everyone leaves.",
                    "Thank you for playing with the auto host rotation lobby."
                ], this.multilimeMessageInterval, "close lobby announcement", 100000);
                this.option.terminate_time_ms = 1000;
            }
        }
        else {
            this.lobby.SendMultilineMessageWithInterval([
                "!mp password closed",
                `This lobby will be closed in ${(time_ms / 1000).toFixed(0)}sec(s).`,
                "Thank you for playing with the auto host rotation lobby."
            ], this.multilimeMessageInterval, "close lobby announcement", 100000)
                .then(() => this.sendMessageWithDelay("!mp close", time_ms));
        }
    }
    sendMessageWithDelay(message, delay) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.lobby.SendMessage(message);
                resolve();
            }, delay);
        });
    }
}
exports.LobbyTerminator = LobbyTerminator;
//# sourceMappingURL=LobbyTerminator.js.map
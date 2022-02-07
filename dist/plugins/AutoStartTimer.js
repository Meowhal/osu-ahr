"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoStartTimer = void 0;
const parsers_1 = require("../parsers");
const LobbyPlugin_1 = require("./LobbyPlugin");
const config_1 = __importDefault(require("config"));
const WAITINGTIME_MIN = 15;
class AutoStartTimer extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "AutoStartTimer", "autostart");
        this.useMapValidation = false;
        const d = config_1.default.get(this.pluginName);
        this.option = { ...d, ...option };
        this.lastMapId = 0;
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.player, a.command, a.param));
        this.lobby.ReceivedBanchoResponse.on(a => this.onReceivedBanchoResponse(a.message, a.response));
        this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
    }
    onReceivedChatCommand(player, command, param) {
        if (this.lobby.isMatching)
            return;
        if (!player.isAuthorized)
            return;
        switch (command) {
            case "*autostart_enable":
                this.option.enabled = true;
                break;
            case "*autostart_disable":
                this.option.enabled = false;
                break;
            case "*autostart_time":
                let ct = parseInt(param);
                if (Number.isNaN(ct)) {
                    this.logger.warn("invalid *autostart_time param : %s", param);
                    return;
                }
                if (ct < WAITINGTIME_MIN) {
                    ct = WAITINGTIME_MIN;
                }
                this.option.waitingTime = ct;
                break;
            case "*autostart_clearhost_enable":
                this.option.doClearHost = true;
                break;
            case "*atuostart_clearhost_disable":
                this.option.doClearHost = false;
                break;
        }
    }
    onReceivedBanchoResponse(message, response) {
        if (!this.option.enabled || this.option.waitingTime < WAITINGTIME_MIN)
            return;
        switch (response.type) {
            case parsers_1.BanchoResponseType.BeatmapChanged:
                if (this.lobby.players.size == 1 || response.params[0] == this.lastMapId || this.useMapValidation)
                    break;
                this.startTimer();
                break;
            case parsers_1.BanchoResponseType.BeatmapChanging:
            case parsers_1.BanchoResponseType.HostChanged:
                if (this.lobby.isStartTimerActive) {
                    this.lobby.SendMessage("!mp aborttimer");
                }
                this.SendPluginMessage("mp_abort_start");
                break;
            case parsers_1.BanchoResponseType.MatchStarted:
                this.lastMapId = this.lobby.mapId;
                break;
        }
    }
    startTimer() {
        if (!this.option.enabled || this.option.waitingTime < WAITINGTIME_MIN)
            return;
        this.SendPluginMessage("mp_start", [this.option.waitingTime.toString(), "withhelp"]);
        if (this.option.doClearHost) {
            this.lobby.SendMessage(`!mp clearhost`);
        }
    }
    onPluginMessage(type, args, src) {
        switch (type) {
            case "enabledMapChecker":
                this.useMapValidation = true;
                break;
            case "disabledMapChecker":
                this.useMapValidation = false;
                break;
            case "validatedMap":
                this.startTimer();
                break;
        }
    }
}
exports.AutoStartTimer = AutoStartTimer;
//# sourceMappingURL=AutoStartTimer.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regSwitch = exports.LobbyPlugin = void 0;
const log4js_1 = __importDefault(require("log4js"));
/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
class LobbyPlugin {
    constructor(lobby, pluginName, loggerTag = "default") {
        this.lobby = lobby;
        this.lobby.plugins.push(this);
        this.pluginName = pluginName;
        this.logger = log4js_1.default.getLogger(loggerTag);
        this.logger.addContext("channel", "lobby");
    }
    /**
     * 他のプラグインにメッセージを送信する。
     * @param type
     * @param args
     */
    SendPluginMessage(type, args = []) {
        this.lobby.PluginMessage.emit({ type, args, src: this });
    }
    /**
     * コンソール上で[i]nfo コマンドを実行した際に表示される、
     * プラグインごとのステータスメッセージを取得する
     */
    GetPluginStatus() {
        return "";
    }
    /**
     * すべてのプラグインが読み込まれたあとに実行される
     */
    OnLoaded() {
    }
    OnConfig(target, name, value) {
    }
}
exports.LobbyPlugin = LobbyPlugin;
function regSwitch(val, cases) {
    for (let c of cases) {
        let ea = c.case.exec(val);
        if (ea) {
            c.action(ea);
            return;
        }
    }
}
exports.regSwitch = regSwitch;
//# sourceMappingURL=LobbyPlugin.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regSwitch = exports.LobbyPlugin = void 0;
const Loggers_1 = require("../Loggers");
const TypedConfig_1 = require("../TypedConfig");
/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
class LobbyPlugin {
    constructor(lobby, pluginName, loggerTag = 'default') {
        this.lobby = lobby;
        this.lobby.plugins.push(this);
        this.pluginName = pluginName;
        this.logger = (0, Loggers_1.getLogger)(loggerTag);
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
        return '';
    }
    /**
     * すべてのプラグインが読み込まれたあとに実行される
     */
    OnLoaded() {
        /* do nothing. */
    }
    OnConfig(target, name, value) {
        /* do nothing. */
    }
    loadEnvSettings(option) {
        try {
            (0, TypedConfig_1.loadEnvConfig)(this.pluginName, option);
        }
        catch (e) {
            this.logger.error(`\n${e.message}\n${e.stack}`);
            process.exit(1);
        }
    }
}
exports.LobbyPlugin = LobbyPlugin;
function regSwitch(val, cases) {
    for (const c of cases) {
        const ea = c.case.exec(val);
        if (ea) {
            c.action(ea);
            return;
        }
    }
}
exports.regSwitch = regSwitch;
//# sourceMappingURL=LobbyPlugin.js.map
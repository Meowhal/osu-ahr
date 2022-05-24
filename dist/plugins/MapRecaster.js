"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapRecaster = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const CommandParser_1 = require("../parsers/CommandParser");
/**
 * ホストが古いバージョンのマップを選択した際に、コマンドでマップを貼り直して最新版にする。
 * !updateコマンドなどで発動。マップ選択後に1度だけ実行できる。
 */
class MapRecaster extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby) {
        super(lobby, 'MapRecaster', 'recaster');
        this.canRecast = true;
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player));
        this.lobby.ReceivedBanchoResponse.on(a => {
            if (a.response.type === CommandParser_1.BanchoResponseType.BeatmapChanged) {
                this.canRecast = true;
            }
        });
    }
    onReceivedChatCommand(command, param, player) {
        if (command === '!update') {
            if (this.canRecast) {
                this.canRecast = false;
                this.lobby.SendMessage(`!mp map ${this.lobby.mapId}`);
            }
        }
    }
}
exports.MapRecaster = MapRecaster;
//# sourceMappingURL=MapRecaster.js.map
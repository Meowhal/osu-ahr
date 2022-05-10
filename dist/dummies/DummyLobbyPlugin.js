"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummyLobbyPlugin = void 0;
const LobbyPlugin_1 = require("../plugins/LobbyPlugin");
class DummyLobbyPlugin extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby) {
        super(lobby, 'dummy');
    }
    GetPluginStatus() {
        return `-- Dummy Lobby Plugin --
  this is dummy lobby info
    `;
    }
}
exports.DummyLobbyPlugin = DummyLobbyPlugin;
//# sourceMappingURL=DummyLobbyPlugin.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryLoader = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const TypedConfig_1 = require("../TypedConfig");
/**
 * 定期的にhistoryを取得し、lobbyのhistoryrepositoryに保存する
 */
class HistoryLoader extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, 'HistoryLoader', 'history');
        this.fetchInvervalId = null;
        this.option = (0, TypedConfig_1.getConfig)(this.pluginName, option);
        this.repository = lobby.historyRepository;
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.FixedSettings.on(a => this.onFixedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
        this.lobby.JoinedLobby.on(a => this.onJoinedLobby(a.channel));
        this.lobby.MatchStarted.on(a => this.onMatchStarted());
        this.lobby.LeftChannel.on(a => this.stopFetch());
    }
    async onFixedSettings(result, playersIn, playersOut, hostChanged) {
        if (!this.repository)
            return;
        const order = (await this.repository.calcCurrentOrderAsName()).join(',');
        this.SendPluginMessage('reorder', [order]);
    }
    onJoinedLobby(channel) {
        if (this.lobby.lobbyId) {
            this.repository.lobbyId = parseInt(this.lobby.lobbyId);
            this.repository.gotUserProfile.on(a => this.onGotUserProfile(a.user));
            this.repository.changedLobbyName.on(a => this.onChangedLobbyName(a.newName, a.oldName));
            this.startFetch();
        }
    }
    onMatchStarted() {
        if (this.fetchInvervalId === null) {
            this.repository.updateToLatest();
        }
    }
    onGotUserProfile(user) {
        const p = this.lobby.GetOrMakePlayer(user.username);
        p.id = user.id;
    }
    onChangedLobbyName(newName, oldName) {
        this.lobby.lobbyName = newName;
        this.logger.info(`Lobby name has been changed: ${oldName} -> ${newName}, Host: ${this.lobby.host?.name}`);
    }
    startFetch() {
        this.stopFetch();
        if (this.option.fetch_interval_ms >= 5000) {
            this.logger.trace('Started fetching.');
            this.fetchInvervalId = setInterval(() => {
                if (!this.lobby.isMatching) {
                    this.repository.updateToLatest();
                }
            }, this.option.fetch_interval_ms);
        }
    }
    stopFetch() {
        if (this.fetchInvervalId) {
            this.logger.trace('Stopped fetching.');
            clearInterval(this.fetchInvervalId);
            this.fetchInvervalId = null;
        }
    }
    GetPluginStatus() {
        return `-- History Loader --
  hasError: ${this.repository?.hasError}
  Latest: ${this.repository?.latestEventId}
  Loaded events: ${this.repository?.events.length}`;
    }
}
exports.HistoryLoader = HistoryLoader;
//# sourceMappingURL=HistoryLoader.js.map
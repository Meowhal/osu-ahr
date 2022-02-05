"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileFecher = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const WebApiClient_1 = require("../webapi/WebApiClient");
const config_1 = __importDefault(require("config"));
class ProfileFecher extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "profile", "profile");
        this.hasError = false;
        const d = config_1.default.get(this.pluginName);
        this.option = { ...d, ...option };
        this.profileMap = new Map();
        this.pendingNames = new Set();
        this.task = this.initializeAsync();
        this.registerEvents();
    }
    async initializeAsync() {
        await WebApiClient_1.WebApiClient.updateToken();
    }
    registerEvents() {
        this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
    }
    onPlayerJoined(player) {
        if (this.hasError)
            return;
        this.addTaskQueueIfNeeded(player);
    }
    addTaskQueueIfNeeded(player) {
        if (player.id !== 0)
            return false;
        let profile = this.profileMap.get(player.name);
        if (profile && !this.isExpiredProfile(profile)) {
            player.id = profile.id;
            player.profile = profile;
            return true;
        }
        if (this.pendingNames.has(player.name)) {
            return false;
        }
        this.pendingNames.add(player.name);
        this.task = this.task.then(async () => {
            try {
                let profile = await this.getProfileFromWebApi(player);
                if (profile != null) {
                    player.id = profile.id;
                    player.profile = profile;
                    this.logger.info("fetch profile :" + player.name);
                }
                else {
                    this.logger.warn("user not found! " + player.name);
                }
                this.pendingNames.delete(player.name);
            }
            catch (e) {
                this.logger.error("@addTaskQueueIfNeeded" + e);
            }
        });
        return true;
    }
    getProfileFromWebApi(player) {
        return WebApiClient_1.WebApiClient.getUser(player.name);
    }
    isExpiredProfile(profile) {
        return Date.now() < this.option.profile_expired_day * 24 * 60 * 60 * 1000 + profile.get_time;
    }
}
exports.ProfileFecher = ProfileFecher;
//# sourceMappingURL=ProfileFecher.js.map
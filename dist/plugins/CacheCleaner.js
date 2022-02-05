"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheCleaner = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const config_1 = __importDefault(require("config"));
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const ProfileRepository_1 = require("../webapi/ProfileRepository");
class CacheCleaner extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "CacheCleaner", "cleaner");
        const d = config_1.default.get(this.pluginName);
        this.option = { ...d, ...option };
        this.cleanedAt = Date.now();
        this.lastHeapSize = process.memoryUsage().heapUsed;
        this.cleaning = false;
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.MatchStarted.on(() => {
            if (this.option.enabled && (this.cleanedAt + this.option.intervalMs < Date.now())) {
                setTimeout(() => {
                    this.clearCache();
                }, 5000);
            }
        });
        this.lobby.ReceivedChatCommand.on(({ player, command, param }) => this.onReceivedChatCommand(player, command, param));
    }
    onReceivedChatCommand(player, command, param) {
        if (!player.isAuthorized)
            return;
        switch (command.toLocaleLowerCase()) {
            case "*clearcache_enable":
                this.option.enabled = true;
                this.logger.info("CacheCleaner enabled");
                break;
            case "*clearcache_disable":
                this.option.enabled = false;
                this.logger.info("CacheCleaner disabled");
                break;
            case "*clearcache":
            case "*clear":
                this.clearCache();
                break;
        }
    }
    async clearCache() {
        try {
            await this.lobby.historyRepository.clearCache();
            BeatmapRepository_1.BeatmapRepository.discardExpiredCache(this.option.intervalMs);
            ProfileRepository_1.ProfileRepository.discardExpiredCache(this.option.intervalMs);
            if (global.gc) {
                global.gc();
            }
            const currentMem = process.memoryUsage().heapUsed;
            this.logger.info(`heap size: ${this.formatByte(this.lastHeapSize)} -> ${this.formatByte(currentMem)}`);
            this.lastHeapSize = currentMem;
            this.cleanedAt = Date.now();
        }
        catch (e) {
            this.logger.error(e);
        }
    }
    formatByte(numByte) {
        if (isNaN(numByte))
            return "NaN";
        if (!isFinite(numByte))
            return numByte > 0 ? "∞" : "-∞";
        const notations = ["", "Ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi", "Yi", "Ri", "Qi"];
        const sign = 0 <= numByte ? "" : "-";
        numByte = Math.abs(numByte);
        let idx = 0;
        while (1024 <= numByte) {
            numByte /= 1024;
            idx++;
        }
        const valueStr = numByte.toFixed(3).slice(0, 5);
        if (notations.length <= idx) {
            return `${sign}${valueStr}*2^${idx * 10}B`;
        }
        else {
            return `${sign}${valueStr}${notations[idx]}B`;
        }
    }
}
exports.CacheCleaner = CacheCleaner;
//# sourceMappingURL=CacheCleaner.js.map
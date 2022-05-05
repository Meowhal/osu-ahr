"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiscLoader = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const CommandParser_1 = require("../parsers/CommandParser");
const config_1 = __importDefault(require("config"));
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const ProfileRepository_1 = require("../webapi/ProfileRepository");
const WebApiClient_1 = require("../webapi/WebApiClient");
/**
 * Get beatmap mirror link from Beatconnect
 * Use !mirror to fetch the mirror link
 */
class MiscLoader extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "MiscLoader", "miscLoader");
        this.canResend = true;
        this.beatconnectURL = "https://beatconnect.io/b/${beatmapset_id}";
        this.kitsuURL = "https://kitsu.moe/d/${beatmapset_id}";
        this.canSeeRank = false;
        const d = config_1.default.get(this.pluginName);
        if (WebApiClient_1.WebApiClient.available) {
            this.canSeeRank = true;
        }
        this.option = { ...d, ...option };
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player));
        this.lobby.ReceivedBanchoResponse.on(a => {
            if (a.response.type == CommandParser_1.BanchoResponseType.BeatmapChanged) {
                this.canResend = true;
            }
        });
    }
    async onReceivedChatCommand(command, param, player) {
        if (command == "!mirror") {
            if (this.canResend) {
                this.checkMirror(this.lobby.mapId);
            }
        }
        if (command == "!rank") {
            this.getProfile(player);
        }
    }
    async getProfile(player) {
        try {
            if (!this.canSeeRank) {
                return;
            }
            let currentPlayer = this.lobby.GetPlayer(player.name);
            if (!currentPlayer)
                return;
            if (currentPlayer.id == 0 || this.lobby.gameMode == undefined) {
                this.lobby.SendMessageWithCoolTime("!stats " + currentPlayer.name, "!rank", 10000);
                return;
            }
            let selectedMode = "";
            switch (this.lobby.gameMode.value) {
                case "0":
                    selectedMode = "osu";
                    break;
                case "1":
                    selectedMode = "taiko";
                    break;
                case "2":
                    selectedMode = "fruits";
                    break;
                case "3":
                    selectedMode = "mania";
                    break;
            }
            const profile = await WebApiClient_1.WebApiClient.getPlayer(currentPlayer.id, selectedMode);
            const msg = profile.username + " your rank is #" + profile.statistics.global_rank;
            this.lobby.SendMessageWithCoolTime(msg, "!rank", 5000);
        }
        catch (e) {
            if (e instanceof ProfileRepository_1.FetchProfileError) {
                switch (e.reason) {
                    case ProfileRepository_1.FetchProfileErrorReason.FormatError:
                        this.logger.error(`Couldn't parse the webpage. checked:${player.id}`);
                        break;
                    case ProfileRepository_1.FetchProfileErrorReason.NotFound:
                        this.logger.info(`Profile not found. checked:${player.id}`);
                        break;
                }
            }
            else {
                this.logger.error(`unexpected error. checking:${player.id}, err:${e.message}`);
            }
        }
    }
    async checkMirror(mapId) {
        try {
            let map = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapId, this.lobby.gameMode);
            this.canResend = false;
            if (!map) {
                this.lobby.SendMessage("Current beatmap doesn't have mirror...");
                this.canResend = false;
                return;
            }
            this.canResend = true;
            var beatconnectLink = this.beatconnectURL.replace(/\$\{beatmapset_id\}/g, map.beatmapset_id.toString());
            var kitsuLink = this.kitsuURL.replace(/\$\{beatmapset_id\}/g, map.beatmapset_id.toString());
            var beatmapView = map.beatmapset?.title.toString();
            this.lobby.SendMessageWithCoolTime(`Alternative download link for ${beatmapView} : [${beatconnectLink} BeatConnect.io] | [${kitsuLink} Kitsu.moe]`, "!mirror", 5000);
        }
        catch (e) {
            this.canResend = false;
            if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                switch (e.reason) {
                    case BeatmapRepository_1.FetchBeatmapErrorReason.FormatError:
                        this.logger.error(`Couldn't parse the webpage. checked:${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotFound:
                        this.logger.info(`Map can not be found. checked:${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched:
                        this.logger.info(`Gamemode Mismatched. checked:${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotAvailable:
                        this.logger.info(`Map is not available. checked:${mapId}`);
                        break;
                }
            }
            else {
                this.logger.error(`unexpected error. checking:${mapId}, err:${e.message}`);
            }
        }
    }
}
exports.MiscLoader = MiscLoader;
//# sourceMappingURL=MiscLoader.js.map
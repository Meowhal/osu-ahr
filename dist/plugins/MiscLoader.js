"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiscLoader = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const CommandParser_1 = require("../parsers/CommandParser");
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const ProfileRepository_1 = require("../webapi/ProfileRepository");
const WebApiClient_1 = require("../webapi/WebApiClient");
/**
 * Get beatmap mirror link from Beatconnect
 * Use !mirror to fetch the mirror link
 */
class MiscLoader extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby) {
        super(lobby, 'MiscLoader', 'miscLoader');
        this.canResend = true;
        this.beatconnectURL = 'https://beatconnect.io/b/${beatmapset_id}';
        this.kitsuURL = 'https://kitsu.moe/d/${beatmapset_id}';
        this.canSeeRank = false;
        if (WebApiClient_1.WebApiClient.available) {
            this.canSeeRank = true;
        }
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player));
        this.lobby.ReceivedBanchoResponse.on(a => {
            if (a.response.type === CommandParser_1.BanchoResponseType.BeatmapChanged) {
                this.canResend = true;
            }
        });
    }
    async onReceivedChatCommand(command, param, player) {
        if (command === '!mirror') {
            if (this.canResend) {
                this.checkMirror(this.lobby.mapId);
            }
        }
        if (command === '!rank') {
            this.getProfile(player);
        }
    }
    async getProfile(player) {
        try {
            if (!this.canSeeRank) {
                return;
            }
            const currentPlayer = this.lobby.GetPlayer(player.name);
            if (!currentPlayer)
                return;
            if (currentPlayer.id === 0 || this.lobby.gameMode === undefined) {
                this.lobby.SendMessageWithCoolTime(`!stats ${currentPlayer.name}`, '!rank', 10000);
                return;
            }
            let selectedMode = '';
            switch (this.lobby.gameMode.value) {
                case '0':
                    selectedMode = 'osu';
                    break;
                case '1':
                    selectedMode = 'taiko';
                    break;
                case '2':
                    selectedMode = 'fruits';
                    break;
                case '3':
                    selectedMode = 'mania';
                    break;
            }
            const profile = await WebApiClient_1.WebApiClient.getPlayer(currentPlayer.id, selectedMode);
            const msg = `${profile.username} your rank is #${profile.statistics.global_rank}`;
            this.lobby.SendMessageWithCoolTime(msg, '!rank', 5000);
        }
        catch (e) {
            if (e instanceof ProfileRepository_1.FetchProfileError) {
                switch (e.reason) {
                    case ProfileRepository_1.FetchProfileErrorReason.FormatError:
                        this.logger.error(`Failed to parse the webpage. Checked player:${player.id}`);
                        break;
                    case ProfileRepository_1.FetchProfileErrorReason.NotFound:
                        this.logger.info(`Profile cannot be found. Checked player:${player.id}`);
                        break;
                }
            }
            else {
                this.logger.error(`@MiscLoader#getProfile: There was an error while checking player ${player.id}\n${e.message}\n${e.stack}`);
            }
        }
    }
    async checkMirror(mapId) {
        try {
            const map = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapId, this.lobby.gameMode);
            this.canResend = false;
            if (!map) {
                this.lobby.SendMessage('The current beatmap doesn\'t have a mirror.');
                this.canResend = false;
                return;
            }
            this.canResend = true;
            const beatconnectLink = this.beatconnectURL.replace(/\$\{beatmapset_id\}/g, map.beatmapset_id.toString());
            const kitsuLink = this.kitsuURL.replace(/\$\{beatmapset_id\}/g, map.beatmapset_id.toString());
            const beatmapView = map.beatmapset?.title.toString();
            this.lobby.SendMessageWithCoolTime(`Alternative download link for beatmap ${beatmapView}: [${beatconnectLink} BeatConnect.io] | [${kitsuLink} Kitsu.moe]`, '!mirror', 5000);
        }
        catch (e) {
            this.canResend = false;
            if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                switch (e.reason) {
                    case BeatmapRepository_1.FetchBeatmapErrorReason.FormatError:
                        this.logger.error(`Failed to parse the webpage. Checked beatmap: ${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotFound:
                        this.logger.info(`Beatmap cannot be found. Checked beatmap: ${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched:
                        this.logger.info(`Gamemode mismatched. Checked beatmap: ${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotAvailable:
                        this.logger.info(`Beatmap is not available. Checked beatmap: ${mapId}`);
                        break;
                }
            }
            else {
                this.logger.error(`@MiscLoader#checkMirror: There was an error while checking beatmap ${mapId}\n${e.message}\n${e.stack}`);
            }
        }
    }
}
exports.MiscLoader = MiscLoader;
//# sourceMappingURL=MiscLoader.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OahrBase = void 0;
const config_1 = __importDefault(require("config"));
const Lobby_1 = require("../Lobby");
const Loggers_1 = require("../Loggers");
const AutoHostSelector_1 = require("../plugins/AutoHostSelector");
const MatchStarter_1 = require("../plugins/MatchStarter");
const HostSkipper_1 = require("../plugins/HostSkipper");
const LobbyTerminator_1 = require("../plugins/LobbyTerminator");
const MatchAborter_1 = require("../plugins/MatchAborter");
const WordCounter_1 = require("../plugins/WordCounter");
const MapRecaster_1 = require("../plugins/MapRecaster");
const InOutLogger_1 = require("../plugins/InOutLogger");
const AutoStartTimer_1 = require("../plugins/AutoStartTimer");
const HistoryLoader_1 = require("../plugins/HistoryLoader");
const MapChecker_1 = require("../plugins/MapChecker");
const LobbyKeeper_1 = require("../plugins/LobbyKeeper");
const AfkKicker_1 = require("../plugins/AfkKicker");
const MiscLoader_1 = require("../plugins/MiscLoader");
const CommandParser_1 = require("../parsers/CommandParser");
const CacheCleaner_1 = require("../plugins/CacheCleaner");
const logger = (0, Loggers_1.getLogger)('ahr');
const OahrCliDefaultOption = config_1.default.get('OahrCli');
class OahrBase {
    constructor(client) {
        this.option = OahrCliDefaultOption;
        this.client = client;
        this.lobby = new Lobby_1.Lobby(this.client);
        this.selector = new AutoHostSelector_1.AutoHostSelector(this.lobby);
        this.starter = new MatchStarter_1.MatchStarter(this.lobby);
        this.skipper = new HostSkipper_1.HostSkipper(this.lobby);
        this.terminator = new LobbyTerminator_1.LobbyTerminator(this.lobby);
        this.aborter = new MatchAborter_1.MatchAborter(this.lobby);
        this.wordCounter = new WordCounter_1.WordCounter(this.lobby);
        this.inoutLogger = new InOutLogger_1.InOutLogger(this.lobby);
        this.autoTimer = new AutoStartTimer_1.AutoStartTimer(this.lobby);
        this.recaster = new MapRecaster_1.MapRecaster(this.lobby);
        this.history = new HistoryLoader_1.HistoryLoader(this.lobby);
        this.miscLoader = new MiscLoader_1.MiscLoader(this.lobby);
        this.checker = new MapChecker_1.MapChecker(this.lobby);
        this.keeper = new LobbyKeeper_1.LobbyKeeper(this.lobby);
        this.afkkicker = new AfkKicker_1.AfkKicker(this.lobby);
        this.cleaner = new CacheCleaner_1.CacheCleaner(this.lobby);
        this.lobby.RaisePluginsLoaded();
    }
    get isRegistered() {
        return this.client.hostMask !== '';
    }
    displayInfo() {
        logger.info(this.lobby.GetLobbyStatus());
    }
    ensureRegisteredAsync() {
        return new Promise((resolve, reject) => {
            if (!this.isRegistered) {
                logger.trace('Waiting for registration from osu!Bancho...');
                this.client.once('registered', () => {
                    logger.trace('Registered.');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    async makeLobbyAsync(name) {
        // Remove all but ascii graphic characters
        name = name.replace(/[^ -~]/g, '');
        if (!this.isRegistered)
            await this.ensureRegisteredAsync();
        logger.info(`Making a lobby... Name: ${name}`);
        await this.lobby.MakeLobbyAsync(name);
        this.lobby.SendMessage(`!mp password ${this.option.password}`);
        for (const p of this.option.invite_users) {
            this.lobby.SendMessage(`!mp invite ${p}`);
        }
        logger.info(`Successfully made the lobby. Channel: ${this.lobby.channel}`);
    }
    async enterLobbyAsync(id) {
        if (!this.isRegistered)
            await this.ensureRegisteredAsync();
        const channel = CommandParser_1.parser.EnsureMpChannelId(id);
        logger.info(`Entering a lobby... Channel: ${channel}`);
        await this.lobby.EnterLobbyAsync(channel);
        await this.lobby.LoadMpSettingsAsync();
        logger.info(`Successfully entered the lobby. Channel: ${this.lobby.channel}`);
    }
}
exports.OahrBase = OahrBase;
//# sourceMappingURL=OahrBase.js.map
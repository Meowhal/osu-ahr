"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OahrBase = void 0;
const __1 = require("..");
const config_1 = __importDefault(require("config"));
const log4js_1 = __importDefault(require("log4js"));
const plugins_1 = require("../plugins");
const parsers_1 = require("../parsers");
const CacheCleaner_1 = require("../plugins/CacheCleaner");
const logger = log4js_1.default.getLogger("cli");
const OahrCliDefaultOption = config_1.default.get("OahrCli");
class OahrBase {
    constructor(client) {
        this.option = OahrCliDefaultOption;
        this.client = client;
        this.lobby = new __1.Lobby(this.client);
        this.selector = new plugins_1.AutoHostSelector(this.lobby);
        this.starter = new plugins_1.MatchStarter(this.lobby);
        this.skipper = new plugins_1.HostSkipper(this.lobby);
        this.terminator = new plugins_1.LobbyTerminator(this.lobby);
        this.aborter = new plugins_1.MatchAborter(this.lobby);
        this.wordCounter = new plugins_1.WordCounter(this.lobby);
        this.inoutLogger = new plugins_1.InOutLogger(this.lobby);
        this.autoTimer = new plugins_1.AutoStartTimer(this.lobby);
        this.recaster = new plugins_1.MapRecaster(this.lobby);
        this.history = new plugins_1.HistoryLoader(this.lobby);
        this.miscLoader = new plugins_1.MiscLoader(this.lobby);
        this.checker = new plugins_1.MapChecker(this.lobby);
        this.keeper = new plugins_1.LobbyKeeper(this.lobby);
        this.afkkicker = new plugins_1.AfkKicker(this.lobby);
        this.cleaner = new CacheCleaner_1.CacheCleaner(this.lobby);
        this.lobby.RaisePluginsLoaded();
    }
    get isRegistered() {
        return this.client.hostMask != "";
    }
    displayInfo() {
        logger.info(this.lobby.GetLobbyStatus());
    }
    ensureRegisteredAsync() {
        return new Promise((resolve, reject) => {
            if (!this.isRegistered) {
                logger.trace("waiting for registration from bancho");
                this.client.once("registered", () => {
                    logger.trace("registerd");
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    async makeLobbyAsync(name) {
        name = name.replace(/[^ -/:-@\[-~0-9a-zA-Z]/g, "");
        if (!this.isRegistered)
            await this.ensureRegisteredAsync();
        logger.info("Making lobby, name : " + name);
        await this.lobby.MakeLobbyAsync(name);
        this.lobby.SendMessage("!mp password " + this.option.password);
        for (let p of this.option.invite_users) {
            this.lobby.SendMessage("!mp invite " + p);
        }
        logger.info(`Made lobby : ${this.lobby.channel}`);
    }
    async enterLobbyAsync(id) {
        if (!this.isRegistered)
            await this.ensureRegisteredAsync();
        const channel = parsers_1.parser.EnsureMpChannelId(id);
        logger.info("Entering lobby, channel : %s", channel);
        await this.lobby.EnterLobbyAsync(channel);
        await this.lobby.LoadMpSettingsAsync();
        logger.info(`Entered lobby : ${this.lobby.channel}`);
    }
}
exports.OahrBase = OahrBase;
//# sourceMappingURL=OahrBase.js.map
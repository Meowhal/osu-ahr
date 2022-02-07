"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const log4js_1 = __importDefault(require("log4js"));
const DiscordBot_1 = require("./DiscordBot");
const __1 = require("..");
const irc = __importStar(require("../libs/irc"));
const TypedConfig_1 = require("../TypedConfig");
const IIrcClient_1 = require("../IIrcClient");
const ChatLimiter_1 = require("../libs/ChatLimiter");
const logger = log4js_1.default.getLogger("cli");
console.log("starting up...");
const config_path = "./config/log_discord.json";
try {
    console.log("1");
    log4js_1.default.configure(config_path);
    console.log("2");
    const c = (0, TypedConfig_1.getIrcConfig)();
    if (c.nick == "your account id" || c.opt.password == "you can get password from 'https://osu.ppy.sh/p/irc'") {
        logger.error("you must enter your account name and irc password in the config file. ");
        logger.error("you can get the password from 'https://osu.ppy.sh/p/irc' ");
        logger.error("Copy config/default.json to config/local.json, and enter your id and irc password.");
        process.exit(1);
    }
    console.log("3");
    let ircClient = new irc.Client(c.server, c.nick, c.opt);
    ircClient.on("error", err => {
        if (err.command == "err_passwdmismatch") {
            logger.error('%s: %s', err.command, err.args.join(' '));
            logger.error("check your account id and password.");
            process.exit(1);
        }
    });
    console.log("aa");
    (0, ChatLimiter_1.applySpeedLimit)(ircClient, 10, 5000);
    (0, __1.logIrcEvent)(ircClient);
    (0, IIrcClient_1.logPrivateMessage)(ircClient);
    let discordClient = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_INTEGRATIONS] });
    logger.info("bb");
    const bot = new DiscordBot_1.DiscordBot(ircClient, discordClient);
    logger.info("cc");
    bot.start();
}
catch (e) {
    logger.error(e);
    process.exit(1);
}
//# sourceMappingURL=index.js.map
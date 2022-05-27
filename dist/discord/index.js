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
Object.defineProperty(exports, "__esModule", { value: true });
const Loggers_1 = require("../Loggers");
const irc = __importStar(require("../libs/irc"));
const discord_js_1 = require("discord.js");
const DiscordBot_1 = require("./DiscordBot");
const IIrcClient_1 = require("../IIrcClient");
const TypedConfig_1 = require("../TypedConfig");
const ChatLimiter_1 = require("../libs/ChatLimiter");
const logger = (0, Loggers_1.getLogger)('pre');
logger.info('Starting up...');
try {
    TypedConfig_1.CONFIG_OPTION.USE_ENV = true;
    const c = (0, TypedConfig_1.getIrcConfig)();
    if (c.nick === 'your account id' || c.opt.password === 'you can get password from \'https://osu.ppy.sh/p/irc\'') {
        logger.error('You must enter your account ID and IRC password in the config file.');
        logger.error('You can get your IRC password in \'https://osu.ppy.sh/p/irc\' ');
        logger.error('Copy config/default.json to config/local.json, and then enter your account ID and IRC password.');
        process.exit(1);
    }
    const ircClient = new irc.Client(c.server, c.nick, c.opt);
    ircClient.on('error', err => {
        if (err.command === 'err_passwdmismatch') {
            logger.error(`${err.command}: ${err.args.join(' ')}`);
            logger.error('Check your account ID and IRC password.');
            process.exit(1);
        }
    });
    (0, ChatLimiter_1.applySpeedLimit)(ircClient, 10, 5000);
    (0, IIrcClient_1.logIrcEvent)(ircClient);
    (0, IIrcClient_1.logPrivateMessage)(ircClient);
    const discordClient = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_INTEGRATIONS, discord_js_1.Intents.FLAGS.GUILD_MEMBERS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES] });
    const bot = new DiscordBot_1.DiscordBot(ircClient, discordClient);
    bot.start();
}
catch (e) {
    logger.error(`@discord-index\n${e}`);
    process.exit(1);
}
//# sourceMappingURL=index.js.map
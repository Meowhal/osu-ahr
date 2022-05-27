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
const OahrCli_1 = require("./OahrCli");
const OahrHeadless_1 = require("./OahrHeadless");
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
    const client = new irc.Client(c.server, c.nick, c.opt);
    client.on('error', err => {
        if (err.command === 'err_passwdmismatch') {
            logger.error(`${err.command}: ${err.args.join(' ')}`);
            logger.error('Check your account ID and IRC password.');
            process.exit(1);
        }
    });
    (0, ChatLimiter_1.applySpeedLimit)(client, 10, 5000);
    (0, IIrcClient_1.logIrcEvent)(client);
    (0, IIrcClient_1.logPrivateMessage)(client);
    if (process.argv.length > 2) {
        const command = process.argv[2];
        const oahr = new OahrHeadless_1.OahrHeadless(client);
        const arg = process.argv.slice(3).join(' ');
        oahr.start(command, arg);
    }
    else {
        const oahr = new OahrCli_1.OahrCli(client);
        oahr.start(null);
    }
}
catch (e) {
    logger.error(`@cli-index\n${e}`);
    process.exit(1);
}
//# sourceMappingURL=index.js.map
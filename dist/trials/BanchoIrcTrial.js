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
exports.ConnectionServerTrial = exports.trial = void 0;
const irc = __importStar(require("../libs/irc"));
const IIrcClient_1 = require("../IIrcClient");
const CommandParser_1 = require("../parsers/CommandParser");
const TypedConfig_1 = require("../TypedConfig");
function trial() {
    const c = (0, TypedConfig_1.getIrcConfig)();
    const bot = new irc.Client(c.server, c.nick, c.opt);
    bot.on('error', function (message) {
        console.error(`ERROR: ${message.command}: ${message.args.join(' ')}`);
    });
    bot.on('message', function (from, to, message) {
        console.log(`${from} => ${to}: ${message}`);
    });
    bot.on('pm', function (nick, message) {
        console.log(`Got private message from ${nick}: ${message}`);
        const v = CommandParser_1.parser.ParseMpMakeResponse(nick, message);
        if (v !== null) {
            console.log(`--- parsed pm id=${v.id} title=${v.title}`);
        }
    });
    let is_joined = false;
    bot.on('join', function (channel, who) {
        console.log(`${who} has joined ${channel}`);
        if (!is_joined) {
            is_joined = true;
            //bot.say(channel, "!mp password");
            //bot.say(channel, "!mp invite gnsksz");
            setTimeout(() => {
                //bot.say(channel, "!mp close");
            }, 30000);
        }
    });
    bot.on('part', function (channel, who, reason) {
        console.log(`${who} has left ${channel}: ${reason}`);
    });
    bot.on('kick', function (channel, who, by, reason) {
        console.log(`${who} was kicked from ${channel} by ${by}: ${reason}`);
    });
    bot.on('invite', (channel, from) => {
        console.log(`${from} invite you to ${channel}`);
    });
    bot.addListener('registered', function (message) {
        console.log(`registered ${message}`);
        //bot.say("BanchoBot", "!mp make irc test lobby4");
        bot.join('#lobby');
    });
}
exports.trial = trial;
function ConnectionServerTrial() {
    const c = (0, TypedConfig_1.getIrcConfig)();
    const bot = new irc.Client(c.server, c.nick, c.opt);
    (0, IIrcClient_1.logIrcEvent)(bot);
    console.log(`hostmask => ${bot.hostMask}`);
    bot.connect();
    bot.addListener('registered', function (message) {
        console.log(`hostmask => ${bot.hostMask}`);
        bot.disconnect('goodby', () => { console.log('disconnected'); });
    });
}
exports.ConnectionServerTrial = ConnectionServerTrial;
//# sourceMappingURL=BanchoIrcTrial.js.map
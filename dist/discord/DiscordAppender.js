"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = exports.setContext = void 0;
const discord_js_1 = require("discord.js");
const log4js_1 = __importDefault(require("log4js"));
let discordClient;
let ahrs;
const logger = log4js_1.default.getLogger("discord");
function setContext(client, ahrs_) {
    discordClient = client;
    ahrs = ahrs_;
}
exports.setContext = setContext;
const COLOR_MAP = {
    'white': "WHITE", 'grey': "GREY", 'black': "DARK_BUT_NOT_BLACK",
    'blue': "BLUE", 'cyan': "AQUA", 'green': "GREEN",
    'magenta': "LUMINOUS_VIVID_PINK", 'red': "RED", 'yellow': "YELLOW"
};
function configure(config, layouts) {
    let layout = layouts.colouredLayout;
    if (config.layout) {
        layout = layouts.layout(config.layout.type, config.layout);
    }
    //create a new appender instance
    /* loggingEvent sample
        categoryName:'default'
        context:{channel: 'mp_123'}
        data:(1) ['aaa']
        level:Level {level: 20000, levelStr: 'INFO', colour: 'green'}
        pid:18048
        startTime:Sat Aug 28 2021 22:30:41 GMT+0900  */
    return async (loggingEvent) => {
        if (discordClient) {
            try {
                let ch = getDiscordChannel(loggingEvent.context);
                if (ch) {
                    let msg = layout(loggingEvent, config.timezoneOffset);
                    let content = createContent(loggingEvent, msg);
                    await ch.send(content);
                }
            }
            catch (e) {
                logger.error(e.message);
                const ahr = ahrs[loggingEvent.context.channelId];
                if (ahr) {
                    ahr.stopTransferLog();
                }
            }
        }
    };
}
exports.configure = configure;
function getDiscordChannel(context) {
    if (discordClient && context && context.transfer && context.guildId && context.channelId) {
        let guild = discordClient.guilds.cache.get(context.guildId);
        let ch = guild?.channels.cache.get(context.channelId);
        if (ch && ch.isText()) {
            return ch;
        }
    }
    return undefined;
}
function createContent(ev, msg) {
    let color = COLOR_MAP[ev.level.colour] ?? "DEFAULT";
    switch (ev.categoryName) {
        case "chat":
            if (ev.data.length == 3) {
                return `> **${ev.data[1]}**: ${ev.data[2]}`;
            }
            else {
                return "> " + msg;
            }
        case "inout":
            let min = msg.match(/\+\x1b\[32m (.+?) \x1B\[0m/);
            let mout = msg.match(/\-\x1b\[31m (.+?) \x1B\[0m/);
            if (min || mout) {
                let msg = "";
                if (min) {
                    msg += "**in** " + min[1] + " ";
                }
                if (mout) {
                    msg += "**out** " + mout[1];
                }
                return { embeds: [new discord_js_1.MessageEmbed().setColor(color).setDescription(msg)] };
            }
            break;
    }
    if (log4js_1.default.levels.WARN.level <= ev.level.level) {
        return { embeds: [new discord_js_1.MessageEmbed().setColor(color).setDescription(msg)] };
    }
    return "`" + ev.categoryName + "` " + msg;
}
//# sourceMappingURL=DiscordAppender.js.map
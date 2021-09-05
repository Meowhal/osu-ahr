import { Client, ColorResolvable, MessageEmbed, TextBasedChannels, MessageOptions } from "discord.js";
import log4js from "log4js";

let discordClient: Client | undefined;
const logger = log4js.getLogger("discord");

export function setDiscordClient(client: Client) {
    discordClient = client;
}

const COLOR_MAP: { [key: string]: ColorResolvable } = {
    'white': "WHITE", 'grey': "GREY", 'black': "DARK_BUT_NOT_BLACK",
    'blue': "BLUE", 'cyan': "AQUA", 'green': "GREEN",
    'magenta': "LUMINOUS_VIVID_PINK", 'red': "RED", 'yellow': "YELLOW"
};

export function configure(config: any, layouts: any) {
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
    return async (loggingEvent: log4js.LoggingEvent) => {
        if (discordClient) {
            try {
                let ch = getDiscordChannel(loggingEvent.context);
                if (ch) {
                    let msg = layout(loggingEvent, config.timezoneOffset);
                    let content = createContent(loggingEvent, msg);
                    await ch.send(content);
                }
            } catch (e) {
                logger.error(e.message);
            }
        }
    };
}

function getDiscordChannel(context: any): TextBasedChannels | undefined {
    if (discordClient && context && context.guildId && context.channelId) {
        let guild = discordClient.guilds.cache.get(context.guildId);
        let ch = guild?.channels.cache.get(context.channelId)
        if (ch?.isText()) {
            return ch;
        }
    }
    return undefined;
}

function createContent(ev: log4js.LoggingEvent, msg: string): string | MessageOptions {
    let color = COLOR_MAP[ev.level.colour] ?? "DEFAULT";
    switch (ev.categoryName) {
        case "chat":
            if (ev.data.length == 3) {
                return `> **${ev.data[1]}** ${ev.data[2]}`;
            } else {
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
                return { embeds: [new MessageEmbed().setColor(color).setDescription(msg)] };
            }
            break;
    }
    if (log4js.levels.WARN.level <= ev.level.level) {
        return { embeds: [new MessageEmbed().setColor(color).setDescription(msg)] };
    }
    return "`" + ev.categoryName + "` " + msg;
}
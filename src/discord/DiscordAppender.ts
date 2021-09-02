import { Client, TextBasedChannels } from "discord.js";
import log4js from "log4js";

let discordClient: Client | undefined;
const logger = log4js.getLogger("discord");

export function setDiscordClient(client: Client) {
    discordClient = client;
}

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
    return async (loggingEvent: any) => {
        if (discordClient) {
            try {

                let ch = getDiscordChannel(loggingEvent.context);
                if (ch) {
                    await ch.send(`${layout(loggingEvent, config.timezoneOffset)}`);
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
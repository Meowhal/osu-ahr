import { Channel, Client, GuildChannel, ThreadChannel } from "discord.js";

let discordClient: Client | undefined;

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
                let ch = getDiscordChannel(loggingEvent.context) as any;
                if (ch) {
                    ch.send(`${layout(loggingEvent, config.timezoneOffset)}`);
                }
            } catch (e) {
                process.stderr.write(`Discord Error ${e}\n`);
            }
        } else {
            process.stdout.write(`${layout(loggingEvent, config.timezoneOffset)}\n`);
        }
    };
}

function getDiscordChannel(context: any): GuildChannel | ThreadChannel | undefined {

    if (discordClient && context && context.guildId && context.channelId) {
        let guild = discordClient.guilds.cache.get(context.guildId);
        return guild?.channels.cache.get(context.channelId);
    } else {
        return undefined;
    }
}
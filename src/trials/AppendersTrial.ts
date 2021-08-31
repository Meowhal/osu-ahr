import log4js from "log4js";

export async function trial() {
    log4js.configure({
        appenders: {
            custom: {
                type: "src/discord/DiscordAppender",
                layout: {
                    type: "pattern",
                    pattern: "%[[%p] %c -%] %m"
                }
            }
        },
        categories: { default: { appenders: ['custom'], level: 'debug' } }
    });

    let l = log4js.getLogger();
    l.addContext("channel", "mp_123");
    l.info("aaa");
}
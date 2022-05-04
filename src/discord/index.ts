import { Client, Intents } from 'discord.js';
import log4js from 'log4js';
import { DiscordBot } from './DiscordBot.js';
import { logIrcEvent } from '../IIrcClient.js';
import * as irc from '../libs/irc.js';
import { getIrcConfig } from '../TypedConfig.js';
import { logPrivateMessage } from '../IIrcClient.js';
import { applySpeedLimit } from '../libs/ChatLimiter.js';

const logger = log4js.getLogger("cli");

console.log("starting up...");

const config_path = "./config/log_discord.json";

log4js.configure(config_path);

try {
    const c = getIrcConfig();
    if (c.nick == "your account id" || c.opt.password == "you can get password from 'https://osu.ppy.sh/p/irc'") {
        logger.error("you must enter your account name and irc password in the config file. ");
        logger.error("you can get the password from 'https://osu.ppy.sh/p/irc' ");
        logger.error("Copy config/default.json to config/local.json, and enter your id and irc password.");
        process.exit(1);
    }

    let ircClient = new irc.Client(c.server, c.nick, c.opt);
    ircClient.on("error", err => {
        if (err.command == "err_passwdmismatch") {
            logger.error('%s: %s', err.command, err.args.join(' '));
            logger.error("check your account id and password.");
            process.exit(1);
        }
    });
    applySpeedLimit(ircClient, 10, 5000);
    logIrcEvent(ircClient);
    logPrivateMessage(ircClient);

    let discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });

    const bot = new DiscordBot(ircClient, discordClient);
    bot.start();
} catch (e: any) {
    logger.error(e);
    process.exit(1);
}

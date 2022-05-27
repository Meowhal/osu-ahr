import { getLogger } from '../Loggers';

import * as irc from '../libs/irc';
import { Client, Intents } from 'discord.js';
import { DiscordBot } from './DiscordBot';
import { logIrcEvent, logPrivateMessage } from '../IIrcClient';
import { CONFIG_OPTION, getIrcConfig } from '../TypedConfig';
import { applySpeedLimit } from '../libs/ChatLimiter';

const logger = getLogger('pre');
logger.info('Starting up...');

try {
  CONFIG_OPTION.USE_ENV = true;
  const c = getIrcConfig();
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
  applySpeedLimit(ircClient, 10, 5000);
  logIrcEvent(ircClient);
  logPrivateMessage(ircClient);

  const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES] });

  const bot = new DiscordBot(ircClient, discordClient);
  bot.start();
} catch (e: any) {
  logger.error(`@discord-index\n${e}`);
  process.exit(1);
}

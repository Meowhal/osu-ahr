import { getLogger } from '../Loggers';

import * as irc from '../libs/irc';
import { OahrCli } from './OahrCli';
import { OahrHeadless } from './OahrHeadless';
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

  const client = new irc.Client(c.server, c.nick, c.opt);
  client.on('error', err => {
    if (err.command === 'err_passwdmismatch') {
      logger.error(`${err.command}: ${err.args.join(' ')}`);
      logger.error('Check your account ID and IRC password.');
      process.exit(1);
    }
  });

  applySpeedLimit(client, 10, 5000);

  logIrcEvent(client);
  logPrivateMessage(client);

  if (process.argv.length > 2) {
    const command = process.argv[2];
    const oahr = new OahrHeadless(client);
    const arg = process.argv.slice(3).join(' ');
    oahr.start(command, arg);
  } else {
    const oahr = new OahrCli(client);
    oahr.start(null);
  }
} catch (e: any) {
  logger.error(`@cli-index\n${e}`);
  process.exit(1);
}

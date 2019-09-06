import { OahrCli } from './OahrCli';
import { OahrNohup } from "./OahrNohup";
import * as irc from '../libs/irc';
import { logIrcEvent } from "..";
import { getIrcConfig } from "../TypedConfig";
import log4js from "log4js";
import { logPrivateMessage } from '../IIrcClient';
const logger = log4js.getLogger("cli");

if (process.env.NODE_ENV === 'production') {
  log4js.configure("./config/log_cli_prod.json");
} else {
  log4js.configure("./config/log_cli_dev.json");
}

const c = getIrcConfig();
if (c.nick == "your account name" || c.opt.password == "you can get password from 'https://osu.ppy.sh/p/irc'") {
  logger.error("you need to enter your account name and password to the config file. ")
  if (process.env.NODE_ENV === 'production') {
    logger.error("copy config/default.json to config/production.json, and enter your account and password.");
  } else {
    logger.error("copy config/default.json to config/development.json, and enter your account and password.");
  }
  process.exit(1);
}

let client = new irc.Client(c.server, c.nick, c.opt);
client.on("error", err => {
  if (err.command == "err_passwdmismatch") {
    logger.error('%s: %s', err.command, err.args.join(' '));
    logger.error("check your account id and password.");
    process.exit(1);
  }
});
logIrcEvent(client);
logPrivateMessage(client);

if (process.argv.length > 2) {
  const oahr = new OahrNohup(client);
  const command = process.argv[2];
  const arg = process.argv.slice(3).join(" ");
  oahr.startApp(command, arg);
} else {
  const oahr = new OahrCli(client);
  oahr.startApp(null);
}



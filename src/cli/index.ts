import { OahrCli } from './OahrCli';
import { OahrHeadless } from "./OahrHeadless";
import * as irc from '../libs/irc';
import { logIrcEvent } from "..";
import { getIrcConfig } from "../TypedConfig";
import log4js from "log4js";
import { logPrivateMessage } from '../IIrcClient';
const logger = log4js.getLogger("cli");

const config_path = (process.env.NODE_ENV === 'production')
  ? "./config/log_cli_prod.json"
  : "./config/log_cli_dev.json";

log4js.configure(config_path);

const c = getIrcConfig();
if (c.nick == "your account id" || c.opt.password == "you can get password from 'https://osu.ppy.sh/p/irc'") {
  logger.error("you must enter your account name and irc password in the config file. ");
  logger.error("you can get the password from 'https://osu.ppy.sh/p/irc' ");
  logger.error("Copy config/default.json to %s, and enter your id and irc password.", config_path);
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
  const oahr = new OahrHeadless(client);
  const command = process.argv[2];
  const arg = process.argv.slice(3).join(" ");
  oahr.startApp(command, arg);
} else {
  const oahr = new OahrCli(client);
  oahr.startApp(null);
}



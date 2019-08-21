import { OahrCli } from './OahrCli';
import * as irc from './libs/irc';
import { logIrcEvent } from "./models";
import { getIrcConfig } from "./config";
import log4js from "log4js";

if (process.env.NODE_ENV === 'production') {
  log4js.configure("./config/log_cli_prod.json");
} else {
  log4js.configure("./config/log_cli_dev.json");
}


const c = getIrcConfig();
let client = new irc.Client(c.server, c.nick, c.opt);

logIrcEvent(client);
let cli = new OahrCli(client);
cli.startApp(null);

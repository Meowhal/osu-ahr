import { OahrCli } from './OahrCli';
import { OahrNohup } from "./OahrNohup";
import * as irc from '../libs/irc';
import { logIrcEvent } from "..";
import { getIrcConfig } from "../TypedConfig";
import log4js from "log4js";

if (process.env.NODE_ENV === 'production') {
  log4js.configure("./config/log_cli_prod.json");
} else {
  log4js.configure("./config/log_cli_dev.json");
}

const c = getIrcConfig();
let client = new irc.Client(c.server, c.nick, c.opt);

logIrcEvent(client);


if (process.argv.length > 2) {
  const oahr = new OahrNohup(client);
  const command = process.argv[2];
  const arg = process.argv.slice(3).join(" ");
  oahr.connectAsync().then(() => {
    switch (command) {
      case "m":
        oahr.makeLobby(arg);
        break;
      case "e":
        oahr.enterLobbyAsync(arg);
        break;
      default:
        process.exit(1);
        break;
    }
  });

} else {
  const oahr = new OahrCli(client);
  oahr.startApp(null);
}


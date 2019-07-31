import { OahrCli } from './OahrCli';
import * as irc from 'irc';
import { logIrcEvent } from "./models";
import { DummyIrcClient } from './models/dummies';
import { getIrcConfig, getTrialConfig } from "./config";

const c = getIrcConfig();
let client = new irc.Client(c.server, c.nick, c.opt);
//let client = new DummyIrcClient(c.server, c.nick, c.opt);

logIrcEvent(client);
let cli = new OahrCli(client);
cli.startApp(null);

//startApp();
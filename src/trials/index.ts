import log4js from 'log4js';
log4js.configure("config/log_mocha.json");

//import * as trial from './WebServerTrial.js';
//trial.webServerTrial();

import { trial } from './DiscordTrial';
trial();

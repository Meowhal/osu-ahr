import log4js from "log4js";
log4js.configure("config/log_mocha.json");

//import * as trial from './WebServerTrial';
//trial.webServerTrial();

import { trial } from './WebApiTrial';
trial();

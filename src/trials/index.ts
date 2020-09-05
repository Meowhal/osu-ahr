import * as trial from './WebApiTrial';
import log4js from "log4js";
log4js.configure("config/log_mocha.json");
trial.webApiTrial();
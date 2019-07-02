import log4js from "log4js";
import config from "config";
import { IClientOpts } from "irc";

export interface IAhrConfig {
  log4js: log4js.Configuration;
  trial: ITrialConfg;
  irc: IIrcConfig;
}

export interface ITrialConfg {
  env: string;
  default_value: string;
}

export interface IIrcConfig {
  server: string;
  nick: string;
  opt: IClientOpts;
}

export function getIrcConfig(): IIrcConfig {
  return config.get<IIrcConfig>("irc");
}

export function getLog4jsConfig(): log4js.Configuration {
  return config.get<log4js.Configuration>("log4js");
}

export function getTrialConfig(): ITrialConfg {
  return config.get<ITrialConfg>("trial");
}
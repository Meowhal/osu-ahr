import config from "config";
import { IClientOpts } from "irc";

export interface IAhrConfig {
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

export function getTrialConfig(): ITrialConfg {
  return config.get<ITrialConfg>("trial");
}
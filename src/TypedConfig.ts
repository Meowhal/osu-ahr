import config from "config";
import { IClientOpts } from "./libs/irc";

export interface IAhrConfig {
  irc: IIrcConfig;
}

export interface IIrcConfig {
  server: string;
  nick: string;
  opt: IClientOpts;
}

export function getIrcConfig(): IIrcConfig {
  return config.get<IIrcConfig>("irc");
}

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

export function getConfig<T>(ctor: { new(init?: Partial<T>): T }): T {
  let tag = "";
  let c = config.get<T>(tag);
  return new ctor(c);
}
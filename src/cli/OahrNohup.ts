import { Lobby, IIrcClient } from "..";
import config from "config";
import log4js from "log4js";
import { AutoHostSelector, MatchStarter, HostSkipper, LobbyTerminator, MatchAborter } from "../plugins";
import { parser } from "../parsers";
import { OahrBase } from "./OahrBase";

const logger = log4js.getLogger("cli");

export class OahrNohup extends OahrBase {

  constructor(client: IIrcClient) {
    super(client);
  }

  startApp(command: string, arg: string): void {
    try {
      switch (command) {
        case "m":
          this.makeLobbyAsync(arg);
          break;
        case "e":
          this.enterLobbyAsync(arg);
          break;
        default:
          process.exit(1);
          break;
      }
    } catch(e) {
      logger.error(e);
      process.exit(1);
    }
    
  }
}
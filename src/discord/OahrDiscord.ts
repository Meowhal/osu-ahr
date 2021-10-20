import { IIrcClient } from "..";

import log4js from "log4js";
import { OahrBase } from "../cli/OahrBase";
import { OahrSharedObjects } from "./DiscordBot";


const logger = log4js.getLogger("discord");

export class OahrDiscord extends OahrBase {
  guildId: string = "";
  channelId: string = "";

  constructor(client: IIrcClient, sh: OahrSharedObjects) {
    super(client);
    this.checker.osuMaps = sh.osuMaps;
    this.checker.ctbMaps = sh.ctbMaps;
    this.checker.taikoMaps = sh.taikoMaps;
    this.checker.maniaMaps = sh.maniaMaps;
  }

  setDiscordId(guildId: string, channelId: string) {
    this.guildId = guildId;
    this.channelId = channelId;

    for (let l of this.lobby.plugins.map(p => p.logger).concat([logger, this.lobby.logger, this.lobby.chatlogger])) {
      l.addContext("guildId", guildId);
      l.addContext("channelId", channelId);
    }
  }
}
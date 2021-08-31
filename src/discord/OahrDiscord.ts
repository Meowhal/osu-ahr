import { IIrcClient, Lobby, LobbyStatus, Player } from "..";

import log4js from "log4js";
import { parser } from "../parsers";
import { OahrBase } from "../cli/OahrBase";
import { Client, Intents, Permissions, Guild } from "discord.js";
import config from "config";

const logger = log4js.getLogger("discord");

export class OahrDiscord extends OahrBase {
  guildId: string = "";
  channelId: string = "";

  constructor(client: IIrcClient) {
    super(client);
    this.inoutLogger.withColorTag = false;
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
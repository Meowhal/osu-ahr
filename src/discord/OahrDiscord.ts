import { IIrcClient, Lobby, LobbyStatus, Player } from "..";

import log4js from "log4js";
import { parser } from "../parsers";
import { OahrBase } from "../cli/OahrBase";
import { Client, Intents } from "discord.js";
import config from "config";

const logger = log4js.getLogger("cli");

export interface OahrDiscordConfig {
    token: string; // ボットのトークン https://discord.com/developers/applications
  }

export class OahrDiscord extends OahrBase {
  discordClient : Client;
  cfg : OahrDiscordConfig;
  lobbies: Map<string, Lobby>;

  constructor(client: IIrcClient) {
    super(client);
    this.discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });
    this.cfg = config.get<OahrDiscordConfig>("Discord");
    this.lobbies = new Map();
  }

  async start() {
    this.discordClient.once('ready', async cl => {
    });

    this.discordClient.login(this.cfg.token);
  }

}
/**
 * command
 * コマンドは全体コマンドとロビーコマンドの二種類
 * /make ロビーの作成
 * /enter 既存のロビーに入る
 * /list 現在稼働中のロビー一覧を表示
 */
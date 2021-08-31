import { IIrcClient } from "..";

import log4js from "log4js";
import { Client, Permissions, Guild, Interaction, GuildChannel, ThreadChannel, CommandInteraction } from "discord.js";
import config from "config";
import { OahrDiscord } from "./OahrDiscord";
import { setDiscordClient } from "./DiscordAppender";

const logger = log4js.getLogger("discord");

// coded by https://autocode.com/tools/discord/command-builder/
const commands = [
  {
    name: "make",
    description: "Make a tournament lobby",
    options: [
      {
        type: 3,
        name: "lobby_name",
        description: "Initial lobby Name e.g. \"4.00-5.99 auto host rotation\"",
        required: true
      }
    ]
  },
  {
    name: "enter",
    description: "Enter a lobby.",
    options: [
      {
        type: 4,
        name: "lobby_id",
        description: " Tournament lobby ID",
        required: false
      }
    ]
  },
  {
    name: "say",
    description: "send a message",
    options: [
      {
        type: 3,
        name: "message",
        description: "message",
        required: true
      },
      {
        type: 4,
        name: "lobby_id",
        description: " Tournament lobby ID",
        required: false
      }
    ]
  },
  {
    name: "config",
    description: "configure ahrbot",
    options: [
      {
        type: 3,
        name: "section",
        description: "specify config section",
        required: true
      },
      {
        type: 3,
        name: "name",
        description: "option name",
        required: true
      },
      {
        type: 3,
        name: "value",
        description: "new value",
        required: true
      }
    ]
  },
  {
    name: "close",
    description: "close the lobby",
    options: [
      {
        type: 4,
        name: "lobby_id",
        description: " Tournament lobby ID",
        required: false
      }
    ]
  },
  {
    name: "quit",
    description: "quit managing the lobby",
    options: [
      {
        type: 4,
        name: "lobby_id",
        description: "Tournament lobby ID",
        required: false
      }
    ]
  }
];

export interface DiscordBotConfig {
  token: string; // ボットのトークン https://discord.com/developers/applications
}

export class DiscordBot {
  ircClient: IIrcClient;
  discordClient: Client;
  cfg: DiscordBotConfig;
  ahrs: { [index: string]: OahrDiscord };

  constructor(client: IIrcClient, discordClient: Client) {
    this.ircClient = client;
    this.discordClient = discordClient;
    this.cfg = config.get<DiscordBotConfig>("Discord");
    this.ahrs = {};
  }

  async start() {
    this.discordClient.once('ready', async cl => {
      for (let g of cl.guilds.cache.values()) {
        await this.registerCommands(g);
      }
      setDiscordClient(cl);
      logger.info("discord bot is ready.");
      logger.info(`invite link => ${this.generateInviteLink()}`);
    });

    this.discordClient.on("guildCreate", async guild => {
      console.log("guildCreate " + guild.name);
      await this.registerCommands(guild);
    });

    this.discordClient.on("interactionCreate", async interaction => {
      if (!interaction.isCommand()) return;

      switch (interaction.commandName) {
        case "make":
          await interaction.reply("making...");
          await this.make(interaction);
          break;
        case "enter":
          await interaction.reply("entering...");
          await this.enter(interaction);
          break;
        case "say":
          break;
        case "config":
          break;
        case "close":
          await interaction.reply("closing...");
          await this.close(interaction);
          break;
        case "quit":
          await interaction.reply("quitting...");
          await this.quit(interaction);
          break;
      }
    });

    await this.discordClient.login(this.cfg.token);
  }


  async registerCommands(guild: Guild) {
    await guild.commands.set(commands);
  }

  async make(interaction: CommandInteraction) {
    let name = interaction.options.getString("lobby_name", true)
    let ahr = new OahrDiscord(this.ircClient);
    if (!interaction.guild) return;
    try {
      await ahr.makeLobbyAsync(name);
      let lobbyId = ahr.lobby.lobbyId ?? "new_lobby";
      let dc = await interaction.guild.channels.create(`mp_${lobbyId}`, {
        type: "GUILD_TEXT",
        topic: `created by ahr bot. #mp_${lobbyId}`
      });
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply("😀 done!");
    } catch (e) {
      logger.error("@discordbot.make " + e);
      await interaction.editReply("😫 error! " + e);
    }
  }

  async enter(interaction: CommandInteraction) {
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      interaction.channel?.send("error lobby_id required.");
      return;
    }

    if (this.ahrs[lobbyId]) {
      this.ahrs[lobbyId].lobby.logger.warn(`bot have already entered the lobby`);
      interaction.editReply("bot have already entered the lobby.");
      return;
    }

    await interaction.channel?.sendTyping();
    let ahr = new OahrDiscord(this.ircClient);
    if (!interaction.guild) return;
    try {
      await ahr.enterLobbyAsync(lobbyId);
      let dc = interaction.guild.channels.cache.find(c => `#${c.name}` == lobbyId);
      if (!dc) {
        dc = await interaction.guild.channels.create(lobbyId.replace("#", ""), {
          type: "GUILD_TEXT",
          topic: `created by ahr bot. #mp_${lobbyId}`
        });
      }
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply("😀 done!");
    } catch (e) {
      logger.error("@discordbot.enter " + e);
      await interaction.editReply("😫 error! " + e);
    }
  }


  async close(interaction: CommandInteraction) {
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      interaction.channel?.send("error lobby_id required.");
      return;
    }
    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      interaction.editReply("Invalid lobby specified");
      return;
    }

    try {
      await ahr.lobby.CloseLobbyAsync();
    } catch (e) {
      logger.error("@discordbot.close " + e);
      await interaction.editReply("😫 error! " + e);
    }
  }

  async quit(interaction: CommandInteraction) {
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      interaction.channel?.send("error lobby_id required.");
      return;
    }
    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      interaction.editReply("Invalid lobby specified");
      return;
    }

    try {
      await ahr.lobby.QuitLobbyAsync();
    } catch (e) {
      logger.error("@discordbot.quit " + e);
      await interaction.editReply("😫 error! " + e);
    }

  }


  registeAhr(ahr: OahrDiscord, interaction: Interaction, channel: GuildChannel | ThreadChannel) {
    if (interaction.guildId && channel) {
      ahr.setDiscordId(interaction.guildId, channel.id);
    } else {
      throw new Error("interaction.guildId is null!");
    }
    if (!ahr.lobby.channel) {
      throw new Error("lobbyId not defined");
    }
    let lid = ahr.lobby.channel;
    ahr.lobby.LeftChannel.once(() => {
      delete this.ahrs[lid];
      delete this.ahrs[channel.id];
    });
    this.ahrs[lid] = ahr;
    this.ahrs[channel.id] = ahr;
  }


  /**
   * スラッシュコマンドの対象ロビーIDを取得する。
   * コマンドのパラメータで与えられている場合はそれを使用する。
   * コマンドを実行したチャンネルがロビーに紐付けされていればそれを使用する。
   * チャンネル名が mp_*** の形式であれば *** 部分を使用する。
   * @param interaction 1
   * @returns 
   */
  resolveLobbyId(interaction: CommandInteraction): string | undefined {
    if (!interaction.inGuild()) return;

    let op = interaction.options.getInteger("lobby_id", false);
    if (op) {
      return `#mp_${op}`;
    }

    let ahr = this.ahrs[interaction.channelId];
    if (ahr && ahr.lobby.channel) {
      return ahr.lobby.channel;
    }

    let gc = interaction.guild?.channels.cache.get(interaction.channelId);

    let m = gc?.name.match(/mp_\d+/);
    if (m) {
      return "#" + m[0];
    }
    return undefined;
  }

  generateInviteLink(): string {
    return this.discordClient.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        Permissions.FLAGS.MANAGE_CHANNELS
      ]
    });
  }

}






/**
 * command
 * コマンドは全体コマンドとロビーコマンドの二種類
 * /make ロビーの作成
 * /enter 既存のロビーに入る
 * /list 現在稼働中のロビー一覧を表示
 */
import log4js from "log4js";
import { Client, Permissions, Guild, GuildChannel, ThreadChannel, CommandInteraction, ApplicationCommandData, ApplicationCommandPermissionData, CreateRoleOptions } from "discord.js";
import config from "config";

import { IIrcClient } from "..";
import { OahrDiscord } from "./OahrDiscord";
import { setDiscordClient } from "./DiscordAppender";

const logger = log4js.getLogger("discord");

const ADMIN_ROLE: CreateRoleOptions = {
  name: "ahr-admin",
  color: "ORANGE",
  reason: "ahr-bot administrator"
};

// coded by https://autocode.com/tools/discord/command-builder/
const COMMANDS: ApplicationCommandData[] = [
  {
    name: "make",
    description: "Make a tournament lobby",
    defaultPermission: false,
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
    defaultPermission: false,
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
    name: "info",
    description: "Print lobby status.",
    defaultPermission: false,
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
    defaultPermission: false,
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
    defaultPermission: false,
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
    defaultPermission: false,
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
    defaultPermission: false,
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

type GuildCommandInteraction = CommandInteraction & { guildId: string; }

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
      if (!interaction.inGuild()) return;

      switch (interaction.commandName) {
        case "make":
          await this.make(interaction);
          break;
        case "enter":
          await this.enter(interaction);
          break;
        case "info":
          await this.info(interaction);
          break;
        case "say":
          await this.say(interaction);
          break;
        case "config":
          break;
        case "close":
          await this.close(interaction);
          break;
        case "quit":
          await this.quit(interaction);
          break;
      }
    });

    await this.discordClient.login(this.cfg.token);
  }

  async registerCommands(guild: Guild) {
    let results = await guild.commands.set(COMMANDS);
    let roleId = await this.registerRole(guild);
    const permissions: ApplicationCommandPermissionData[] = [
      {
        id: roleId,
        type: 'ROLE',
        permission: true,
      },
    ];

    results.forEach(c => {
      c.permissions.add({ permissions });
    });
  }

  async registerRole(guild: Guild) {
    let role = guild.roles.cache.find(r => r.name == ADMIN_ROLE.name);
    if (!role) {
      role = await guild.roles.create(ADMIN_ROLE);
    }
    return role.id;
  }

  async make(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    if (!interaction.guild) {
      logger.error("interaction.guild must not be null");
      await interaction.editReply("😫 interaction.guild must not be null");
      return;
    }

    let name = interaction.options.getString("lobby_name", true);
    let ahr;

    try {
      ahr = new OahrDiscord(this.ircClient);
      await ahr.makeLobbyAsync(name);
    } catch (e) {
      logger.error("couldn't make a tournament lobby. " + e);
      await interaction.editReply("😫 couldn't make a tournament lobby. " + e.message);
      ahr?.lobby.destroy();
      return;
    }

    try {
      let lobbyId = ahr.lobby.lobbyId ?? "new_lobby";
      let dc = await interaction.guild.channels.create(`mp_${lobbyId}`, {
        type: "GUILD_TEXT",
        topic: `created by ahr bot. #mp_${lobbyId}`
      });
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply(`😀 Created the lobby https://osu.ppy.sh/mp/${lobbyId}`);
    } catch (e) {
      logger.error("couldn't make a discord channel. " + e);
      await interaction.editReply("couldn't make a discord channel. " + e.message);
    }
  }

  async enter(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      await interaction.editReply("error lobby_id required.");
      return;
    }

    if (!interaction.guild) {
      logger.error("interaction.guild must not be null");
      await interaction.editReply("😫 interaction.guild must not be null");
      return;
    }

    if (this.ahrs[lobbyId]) {
      this.ahrs[lobbyId].lobby.logger.warn(`bot has already entered the lobby`);
      await interaction.editReply("bot has already entered the lobby.");
      return;
    }

    let ahr;

    try {
      ahr = new OahrDiscord(this.ircClient);
      await ahr.enterLobbyAsync(lobbyId);
    } catch (e) {
      logger.error("couldn't enter the tournament lobby. " + e);
      await interaction.editReply("😫 couldn't enter the tournament lobby. " + e);
      ahr?.lobby.destroy();
      return;
    }

    try {
      let dc = interaction.guild.channels.cache.find(c => `#${c.name}` == lobbyId);
      if (!dc) {
        dc = await interaction.guild.channels.create(lobbyId.replace("#", ""), {
          type: "GUILD_TEXT",
          topic: `created by ahr bot. #mp_${lobbyId}`
        });
      }
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply(`😀 Entered the lobby https://osu.ppy.sh/mp/${lobbyId}`);
    } catch (e) {
      logger.error("couldn't make a discord channel.  " + e);
      await interaction.editReply("😫 couldn't make a discord channel.  " + e);
    }
  }

  async info(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      await interaction.editReply("error lobby_id required.");
      return;
    }

    if (!interaction.guild) {
      logger.error("interaction.guild must not be null");
      await interaction.editReply("😫 interaction.guild must not be null");
      return;
    }

    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      await interaction.editReply("Invalid lobby specified");
      return;
    }

    try {
      await interaction.editReply(ahr.lobby.GetLobbyStatus());
    } catch (e) {
      logger.error("@discordbot.info " + e);
      await interaction.editReply("😫 error! " + e.message);
    }
  }

  async say(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      await interaction.editReply("error lobby_id required.");
      return;
    }
    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      await interaction.editReply("Invalid lobby specified");
      return;
    }
    let msg = interaction.options.getString("message", true);
    if ((msg.startsWith("!") && !msg.startsWith("!mp ")) || msg.startsWith("*")) {
      ahr.lobby.RaiseReceivedChatCommand(ahr.lobby.GetOrMakePlayer(ahr.client.nick), msg);
      await interaction.editReply("executed: " + msg);
    } else {
      ahr.lobby.SendMessage(msg);
      await interaction.editReply("sent: " + msg);
    }

  }

  async close(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      await interaction.editReply("error lobby_id required.");
      return;
    }
    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      await interaction.editReply("Invalid lobby specified");
      return;
    }

    try {
      await ahr.lobby.CloseLobbyAsync();
      await interaction.editReply("😀 Closed the lobby");
    } catch (e) {
      logger.error("@discordbot.close " + e);
      await interaction.editReply("😫 error! " + e);
    }
  }

  async quit(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyId = this.resolveLobbyId(interaction);
    if (!lobbyId) {
      await interaction.editReply("error lobby_id required.");
      return;
    }
    let ahr = this.ahrs[lobbyId];
    if (!ahr) {
      await interaction.editReply("Invalid lobby specified");
      return;
    }

    try {
      await ahr.lobby.QuitLobbyAsync();
      await interaction.editReply("😀 Stopped managing the lobby");
    } catch (e) {
      logger.error("@discordbot.quit " + e);
      await interaction.editReply("😫 error! " + e);
    }

  }

  registeAhr(ahr: OahrDiscord, interaction: GuildCommandInteraction, channel: GuildChannel | ThreadChannel) {
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
        Permissions.FLAGS.MANAGE_CHANNELS,
        Permissions.FLAGS.MANAGE_ROLES
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
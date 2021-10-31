/**
 * check list
 * admin roleが正しく登録される
 * admin role以外のユーザーはスラッシュコマンド、ボタンコマンドを利用できない
 * 
 */

import log4js from "log4js";
import { Client, Permissions, Guild, GuildChannel, ThreadChannel, CommandInteraction, ApplicationCommandData, ApplicationCommandPermissionData, CreateRoleOptions, MessageEmbed, MessageActionRow, MessageButton, DiscordAPIError, Message, Role, TextChannel, GuildMember, ButtonInteraction } from "discord.js";
import config from "config";

import { IIrcClient, LobbyStatus, Player } from "..";
import { OahrDiscord } from "./OahrDiscord";
import { setContext } from "./DiscordAppender";
import { BotCommands } from "./BotCommand";
import { BanchoResponse, BanchoResponseType } from "../parsers";

const logger = log4js.getLogger("discord");

const ADMIN_ROLE: CreateRoleOptions = {
  name: "ahr-admin",
  color: "ORANGE",
  reason: "ahr-bot administrator"
};

export interface DiscordBotConfig {
  token: string; // ボットのトークン https://discord.com/developers/applications
}

type GuildCommandInteraction = CommandInteraction & { guildId: string; }
export type OahrSharedObjects = {
}

export class DiscordBot {
  ircClient: IIrcClient;
  discordClient: Client;
  cfg: DiscordBotConfig;
  ahrs: { [index: string]: OahrDiscord };
  sharedObjects: OahrSharedObjects;

  constructor(client: IIrcClient, discordClient: Client) {
    this.ircClient = client;
    this.discordClient = discordClient;
    this.cfg = config.get<DiscordBotConfig>("Discord");
    this.ahrs = {};
    this.sharedObjects = {}
  }

  async start() {
    this.discordClient.once('ready', async cl => {
      for (let g of cl.guilds.cache.values()) {
        await this.registerCommandsAndRoles(g);
      }
      setContext(cl, this.ahrs);
      logger.info("discord bot is ready.");
      logger.info(`invite link => ${this.generateInviteLink()}`);
    });

    this.discordClient.on("guildCreate", async guild => {
      console.log("guildCreate " + guild.name);
      await this.registerCommandsAndRoles(guild);
    });

    this.discordClient.on("interactionCreate", async interaction => {
      if (!interaction.inGuild()) return;
      if (!this.checkMemberHasAhrAdminRole(interaction.member as GuildMember)) return;
      if (interaction.isCommand()) {
        await this.handleCommandInteraction(interaction);
      }
      if (interaction.isButton()) {
        const m = /^(\w+),#mp_(\d+)$/.exec(interaction.customId);
        if (m) {
          await this.handleButtonInteraction(interaction, m[1], m[2]);
        }
      }
    });

    try {
      await this.discordClient.login(this.cfg.token);
    } catch (e: any) {
      if (e?.code == "TOKEN_INVALID" && e.message) {
        logger.error(e.message);
        if (this.cfg.token == "") {
          logger.error(`your token is Empty`);
        } else {
          logger.error(`your token is invalid. "${this.cfg.token}"`);
        }
        logger.error("Check the setup guide -> https://github.com/Meowhal/osu-ahr#discord-integration");

      } else {
        logger.error(e);
      }
      process.exit();
    }

  }

  checkMemberHasAhrAdminRole(member: GuildMember) {
    return member.roles.cache.find(f => f.name == ADMIN_ROLE.name) !== undefined;
  }

  async registerCommandsAndRoles(guild: Guild) {
    let results = await guild.commands.set(BotCommands);
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

  async handleCommandInteraction(interaction: GuildCommandInteraction) {
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
      ahr = new OahrDiscord(this.ircClient, this.sharedObjects);
      await ahr.makeLobbyAsync(name);
    } catch (e: any) {
      logger.error("couldn't make a tournament lobby. " + e);
      await interaction.editReply("😫 couldn't make a tournament lobby. " + e.message);
      ahr?.lobby.destroy();
      return;
    }

    try {
      let lobbyNumber = ahr.lobby.lobbyId ?? "new_lobby";
      this.registeAhr(ahr, interaction);
      await this.updateMatchSummary(ahr);
      await interaction.editReply(`😀 Created the lobby [Lobby Histroy](https://osu.ppy.sh/mp/${lobbyNumber})`);
    } catch (e: any) {
      logger.error("couldn't make a discord channel. " + e);
      await interaction.editReply("couldn't make a discord channel. " + e.message);
    }
  }

  async enter(interaction: GuildCommandInteraction) {
    await interaction.deferReply();
    let lobbyNumber = this.resolveLobbyId(interaction, true);
    let lobbyId = "#mp_" + lobbyNumber;
    if (!lobbyNumber) {
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
      ahr = new OahrDiscord(this.ircClient, this.sharedObjects);
      await ahr.enterLobbyAsync(lobbyId);
    } catch (e) {
      logger.error("couldn't enter the tournament lobby. " + e);
      await interaction.editReply("😫 couldn't enter the tournament lobby. " + e);
      ahr?.lobby.destroy();
      return;
    }

    try {
      this.registeAhr(ahr, interaction);
      // ロビー用チャンネルからenterコマンドを引数無しで呼び出している場合はそのチャンネルでログ転送を開始する
      const ch = interaction.guild?.channels.cache.get(interaction.channelId);
      if (ch && lobbyId == ("#" + ch.name)) {
        ahr.startTransferLog(ch.id);
      }
      await this.updateMatchSummary(ahr);
      await interaction.editReply(`😀 Entered the lobby [Lobby Histroy](https://osu.ppy.sh/mp/${lobbyNumber})`);
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
      await interaction.editReply({ embeds: [ahr.createDetailInfoEmbed()] });
    } catch (e: any) {
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
      await interaction.editReply("Closed the lobby");
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
      await interaction.editReply("Stopped managing the lobby");
    } catch (e) {
      logger.error("@discordbot.quit " + e);
      await interaction.editReply("😫 error! " + e);
    }
  }

  async handleButtonInteraction(interaction: ButtonInteraction<"present">, command: string, lobbyNumber: string) {
    if (!interaction.guild) return;
    const lobbyId = "#mp_" + lobbyNumber;
    let ahr = this.ahrs[lobbyId];
    if (!ahr) return;

    try {
      switch (command) {
        case "close":
          await ahr.lobby.CloseLobbyAsync();
          break;
        case "startLog":
          await this.getOrCreateMatchChannel(interaction.guild, lobbyNumber);
          this.startTransferLog(ahr, interaction.guild);
          break;
        case "stopLog":
          ahr.stopTransferLog();
          break;
      }

      await interaction.reply("ok");
      await interaction.deleteReply();
      await this.updateMatchSummary(ahr);
    } catch (e) {
      logger.error("@handleButtonInteraction " + e);
    }
  }

  async getOrCreateMatchChannel(guild: Guild, lobbyNumber: string): Promise<TextChannel> {
    const lobbyId = "mp_" + lobbyNumber;
    const dc = guild.channels.cache.find(c => c.name == lobbyId);
    if (dc) return dc as TextChannel;
    const role = guild.roles.cache.find(r => r.name == ADMIN_ROLE.name);
    return await guild.channels.create(lobbyId, {
      type: "GUILD_TEXT",
      topic: `created by ${this.discordClient.user?.username}. [history](https://osu.ppy.sh/community/matches/${lobbyNumber})`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
        },
        {
          id: role ?? "",
          allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
        },
        {
          id: this.discordClient.user?.id ?? "",
          allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
        }
      ]
    });
  }

  async getOrCreateMatchesChannel(guild: Guild): Promise<TextChannel> {
    const dc = guild.channels.cache.find(c => c.name.toLowerCase() == "matches");
    if (dc) return dc as TextChannel;
    const role = guild.roles.cache.find(r => r.name == ADMIN_ROLE.name);
    return await guild.channels.create("matches", {
      type: "GUILD_TEXT",
      topic: `created by ${this.discordClient.user?.username}.`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
        },
        {
          id: role ?? "",
          allow: [Permissions.FLAGS.VIEW_CHANNEL]
        },
        {
          id: this.discordClient.user?.id ?? "",
          allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES]
        }
      ]
    });
  }

  registeAhr(ahr: OahrDiscord, interaction: GuildCommandInteraction) {
    if (!ahr.lobby.channel) {
      throw new Error("lobbyId not defined");
    }
    let lid = ahr.lobby.channel;
    const updateHandler = (a: { message: string, response: BanchoResponse, }) => {
      switch (a.response.type) {
        case BanchoResponseType.BeatmapChanged:
        case BanchoResponseType.MatchStarted:
        case BanchoResponseType.MatchFinished:
        case BanchoResponseType.AbortedMatch:
        case BanchoResponseType.HostChanged:
          this.updateMatchSummary(ahr);
          break;
      }
    }
    ahr.lobby.ReceivedBanchoResponse.on(updateHandler);
    ahr.lobby.LeftChannel.once(() => {
      delete this.ahrs[lid];
      delete this.ahrs[ahr.discordChannelId];
      ahr.lobby.ReceivedBanchoResponse.off(updateHandler);
      this.deleteMatchSummary(ahr);
    });
    ahr.setGuildId(interaction.guildId);
    ahr.stopTransferLog();
    this.ahrs[lid] = ahr;

  }

  async startTransferLog(ahr: OahrDiscord, guild: Guild) {
    const dc = await this.getOrCreateMatchChannel(guild, ahr.lobby.lobbyId ?? "");
    ahr.startTransferLog(dc.id);
    this.ahrs[ahr.discordChannelId] = ahr;
  }

  /**
   * スラッシュコマンドの対象ロビーIDを取得する。
   * コマンドのパラメータで与えられている場合はそれを使用する。
   * コマンドを実行したチャンネルがロビーに紐付けされていればそれを使用する。
   * チャンネル名が mp_*** の形式であれば *** 部分を使用する。
   * @param interaction 1
   * @returns 
   */
  resolveLobbyId(interaction: CommandInteraction, asNumber: boolean = false): string | undefined {
    if (!interaction.inGuild()) return;

    let op = interaction.options.getInteger("lobby_id", false);
    if (op) {
      if (asNumber) {
        return op.toString();
      } else {
        return `#mp_${op}`;
      }
    }

    let ahr = this.ahrs[interaction.channelId];
    if (ahr && ahr.lobby.channel) {
      if (asNumber) {
        return ahr.lobby.lobbyId;
      } else {
        return ahr.lobby.channel;
      }
    }

    let gc = interaction.guild?.channels.cache.get(interaction.channelId);

    let m = gc?.name.match(/mp_(\d+)/);
    if (m) {
      if (asNumber) {
        return m[1];
      } else {
        return "#" + m[0];
      }

    }
    return undefined;
  }

  generateInviteLink(): string {
    return this.discordClient.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        Permissions.FLAGS.MANAGE_CHANNELS,
        Permissions.FLAGS.MANAGE_ROLES,
        Permissions.FLAGS.MANAGE_MESSAGES
      ]
    });
  }

  createLinkButton(lobbyNumber: string) {
    return new MessageActionRow().addComponents(
      new MessageButton().setStyle("LINK").setLabel("Lobby Histroy").setURL(`https://osu.ppy.sh/community/matches/${lobbyNumber}`),
      new MessageButton().setStyle("LINK").setLabel("Channel").setURL(``)
    )
  }

  async updateMatchSummary(ahr: OahrDiscord) {
    if (!ahr.updateSummaryMessage) return;
    try {
      const guild = this.discordClient.guilds.cache.find(f => f.id == ahr.guildId);
      if (guild == undefined) throw new Error("guild not found");
      const channel = await this.getOrCreateMatchesChannel(guild);
      const embed = ahr.createSummaryInfoEmbed();
      const btns = ahr.createInteractionButtons();
      let message: Message | undefined = await this.findMatchSummaryMessage(channel, ahr);
      if (message) {
        message.edit({ embeds: [embed], components: [btns] });
      } else {
        message = await channel.send({ embeds: [embed], components: [btns] });
      }
      ahr.matchSummaryMessageId = message.id;
    } catch (e: any) {
      if (e instanceof DiscordAPIError) {
        if (e.message == "Missing Permissions") {
          logger.error(`Missing Permissions. Invite this bot again. invite link => ${this.generateInviteLink()}`);
          return;
        }
      }
      logger.error(e);
      ahr.updateSummaryMessage = false;
    }
  }

  async findMatchSummaryMessage(channel: TextChannel, ahr: OahrDiscord) {
    let message: Message | undefined;
    if (ahr.matchSummaryMessageId != "") {
      message = await channel.messages.fetch(ahr.matchSummaryMessageId);
    }
    if (message) return message;
    const msgs = await channel.messages.fetch({ limit: 10 });
    const recent = msgs.find(f => (f.embeds && f.embeds.length > 0 && f.embeds[0].title == `#mp_${ahr.lobby.lobbyId ?? ""}`));
    if (recent) return recent;
  }

  async deleteMatchSummary(ahr: OahrDiscord) {
    if (!ahr.updateSummaryMessage) return;
    try {
      const guild = await this.discordClient.guilds.fetch(ahr.guildId);
      const channel = await this.getOrCreateMatchesChannel(guild);
      const message: Message | undefined = await this.findMatchSummaryMessage(channel, ahr);
      if (message) {
        await message.delete();
      }
    } catch (e: any) {
      logger.error(e);
    }
  }
}
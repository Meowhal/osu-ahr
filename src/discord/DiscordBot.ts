import log4js from "log4js";
import { Client, Permissions, Guild, GuildChannel, ThreadChannel, CommandInteraction, ApplicationCommandData, ApplicationCommandPermissionData, CreateRoleOptions, MessageEmbed, MessageActionRow, MessageButton } from "discord.js";
import config from "config";

import { IIrcClient, Player } from "..";
import { OahrDiscord } from "./OahrDiscord";
import { setDiscordClient } from "./DiscordAppender";
import { Beatmap } from "../webapi/Beatmapsets";
import { BotCommands } from "./BotCommand";

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
  osuMaps: { [id: number]: Beatmap & { fetchedAt: number } };
  ctbMaps: { [id: number]: Beatmap & { fetchedAt: number } };
  taikoMaps: { [id: number]: Beatmap & { fetchedAt: number } };
  maniaMaps: { [id: number]: Beatmap & { fetchedAt: number } };
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
    this.sharedObjects = {
      osuMaps: {},
      ctbMaps: {},
      taikoMaps: {},
      maniaMaps: {}
    }
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

    try {
      await this.discordClient.login(this.cfg.token);
    } catch(e: any) {
      if (e?.code == "TOKEN_INVALID" && e.message) {
        logger.error(e.message);
        if (this.cfg.token == "") {
          logger.error(`your token is Empty`);
        } else {
          logger.error(`your token is "${this.cfg.token}"`);
        }
        logger.error("Check the setup guide -> https://github.com/Meowhal/osu-ahr#discord-integration");
        
      } else {
        logger.error(e);
      }      
      process.exit();
    }
    
  }

  async registerCommands(guild: Guild) {
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
      let dc = await this.createChannel(interaction.guild, lobbyNumber);
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply(`😀 Created the lobby [Lobby Histroy](https://osu.ppy.sh/mp/${lobbyNumber}) [#mp_${lobbyNumber}](https://discord.com/channels/${interaction.guildId}/${dc.id})`);
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
      let dc = interaction.guild.channels.cache.find(c => `#${c.name}` == lobbyId);
      if (!dc) {
        dc = await this.createChannel(interaction.guild, lobbyNumber);
      }
      this.registeAhr(ahr, interaction, dc);
      await interaction.editReply(`😀 Entered the lobby [Lobby Histroy](https://osu.ppy.sh/mp/${lobbyNumber}) [#mp_${lobbyNumber}](https://discord.com/channels/${interaction.guildId}/${dc.id})`);
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
      await interaction.editReply({ embeds: [this.createInfoEmbed(ahr)] });
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

  async createChannel(guild: Guild, lobbyNumber: string) {
    return await guild.channels.create("mp_" + lobbyNumber, {
      type: "GUILD_TEXT",
      topic: `created by ${this.discordClient.user?.username}. [history](https://osu.ppy.sh/community/matches/${lobbyNumber})`
    });
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
        Permissions.FLAGS.MANAGE_ROLES
      ]
    });
  }

  createLinkButton(lobbyNumber: string) {
    return new MessageActionRow().addComponents(
      new MessageButton().setStyle("LINK").setLabel("Lobby Histroy").setURL(`https://osu.ppy.sh/community/matches/${lobbyNumber}`),
      new MessageButton().setStyle("LINK").setLabel("Channel").setURL(``)
    )
  }

  createInfoEmbed(ahr: OahrDiscord) {
    let lobby = ahr.lobby;

    let lid = lobby.lobbyId ?? "";
    let name = lobby.lobbyName ?? "";
    let host = lobby.host?.name ?? "none";
    let embed = new MessageEmbed().setColor("BLURPLE").setTitle("Lobby Information - " + name).setURL(`https://osu.ppy.sh/community/matches/${lid}`);
    embed.addField("lobby", `id:${lid}, status:${lobby.status}, host:${host}, players:${lobby.players.size}, name:${name}`,);
    let refs = Array.from(lobby.playersMap.values()).filter(v => v.isReferee).map(v => v.name).join(",");
    if (refs) {
      embed.addField("referee", refs, false);
    }

    embed.addField("order", `${ahr.selector.hostQueue.map(p => p.name).join(", ")}`, false);
    let denylist = ahr.selector.getDeniedPlayerNames();
    if (denylist.length != 0) {
      embed.addField("denylist", `${denylist.join(", ")}`);
    }    
    embed.addField("selector", `changer:${ahr.selector.mapChanger?.name ?? "none"}, rflag:${ahr.selector.needsRotate ? "true" : "false"}`, false);

    const playcounts = Array.from(ahr.inoutLogger.players.keys()).map(p => {
      let num = ahr.inoutLogger?.players.get(p) || 0;
      return `${p.name}(${num})`;
    }).join(", ");
    if (playcounts) {
      embed.addField("playcount", playcounts, false);
    }

    embed.addField("history", `${ahr.history.repository.hasError ? "stopped" : "active"}, latest:${ahr.history.repository?.latestEventId.toString() ?? "0"}, loaded:${ahr.history.repository?.events.length.toString() ?? "0"}`, false);
    embed.addField("regulation", ahr.checker.getRegulationDescription(), false);

    return embed;
  }
}
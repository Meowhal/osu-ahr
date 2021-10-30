import { IIrcClient, LobbyStatus, Player } from "..";

import log4js from "log4js";
import { OahrBase } from "../cli/OahrBase";
import { OahrSharedObjects } from "./DiscordBot";
import { MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import { MessageButtonStyles } from "discord.js/typings/enums";

const logger = log4js.getLogger("discord");

const LOBBY_STAT = {
  match: {
    text: "match",
    color: 0x33ff33
  },
  idle: {
    text: "idle",
    color: 0x00ccff
  },
  closed: {
    text: "closed",
    color: 0x800000
  }
}

export class OahrDiscord extends OahrBase {
  guildId: string = "";
  discordChannelId: string = "";
  transferLog: boolean = false;
  updateSummaryMessage: boolean = true;
  matchSummaryMessageId: string = "";

  constructor(client: IIrcClient, sh: OahrSharedObjects) {
    super(client);
  }

  setGuildId(guildId: string) {
    this.guildId = guildId;
    for (const l of this.getLoggers()) {
      l.addContext("guildId", guildId);
    }
  }

  startTransferLog(discordChannelId: string) {
    for (const l of this.getLoggers()) {
      l.addContext("channelId", discordChannelId);
      l.addContext("transfer", true);
    }
    this.transferLog = true;
  }

  stopTransferLog() {
    for (const l of this.getLoggers()) {
      l.addContext("transfer", false);
    }
    this.transferLog = false;
  }

  getLoggers() {
    return this.lobby.plugins.map(p => p.logger).concat([logger, this.lobby.logger, this.lobby.chatlogger]);
  }

  createDetailInfoEmbed() {
    const lobby = this.lobby;
    const lid = lobby.lobbyId ?? "";
    const name = lobby.lobbyName ?? "";
    const host = lobby.host?.name ?? "none";


    const embed = new MessageEmbed().setColor("BLURPLE").setTitle("Lobby Information - " + name).setURL(`https://osu.ppy.sh/community/matches/${lid}`);
    embed.addField("lobby", `id:${lid}, status:${LobbyStatus[lobby.status]}, host:${host}, players:${lobby.players.size}, name:${name}`,);
    const refs = Array.from(lobby.playersMap.values()).filter(v => v.isReferee).map(v => v.name).join(",");
    if (refs) {
      embed.addField("referee", refs, false);
    }

    const ho = this.getPlayerOrders();
    if (ho != "") {
      embed.addField("host order", ho, false);
    }

    embed.addField(`map - ${lobby.mapTitle}`, `https://osu.ppy.sh/b/${lobby.mapId}`, false);
    embed.addField("selector", `changer:${this.selector.mapChanger?.name ?? "none"}, rflag:${this.selector.needsRotate ? "true" : "false"}`, false);

    const denylist = this.selector.getDeniedPlayerNames();
    if (denylist.length != 0) {
      embed.addField("denylist", `${denylist.join(", ")}`);
    }

    embed.addField("history", `${this.history.repository.hasError ? "stopped" : "active"}, latest:${this.history.repository?.latestEventId.toString() ?? "0"}, loaded:${this.history.repository?.events.length.toString() ?? "0"}`, false);
    embed.addField("regulation", this.checker.getRegulationDescription(), false);

    const keeps = this.keeper.getDescription();
    if (keeps != "") {
      embed.addField("keeps", keeps, false);
    }

    return embed;
  }

  createSummaryInfoEmbed() {
    const lobby = this.lobby;
    const stat = lobby.status == LobbyStatus.Left ? LOBBY_STAT.closed : lobby.isMatching ? LOBBY_STAT.match : LOBBY_STAT.idle;
    const lid = lobby.lobbyId ?? "";
    const name = lobby.lobbyName ?? "";
    const host = lobby.host?.name ?? "none";

    const embed = new MessageEmbed().setColor(stat.color).setTitle(`#mp_${lid}`).setURL(`https://osu.ppy.sh/community/matches/${lid}`);
    embed.addField("title", name, true);
    embed.addField("status", stat.text, true);
    embed.addField("host", host, true);
    embed.addField("regulation", this.checker.getRegulationDescription(), true);
    embed.addField(`map - ${lobby.mapTitle}`, `https://osu.ppy.sh/b/${lobby.mapId}`, false);
    const ho = this.getPlayerOrders();
    if (ho != "") {
      embed.addField("host order", ho, false);
    }
    const keeps = this.keeper.getDescription();
    if (keeps != "") {
      embed.addField("keeps", keeps, false);
    }
    embed.setTimestamp();
    return embed;
  }

  createInteractionButtons() {
    const cid = this.lobby.channel; // #mp_xxxx
    if (cid == undefined) throw new Error("invalid ahr lobby state. channel is undefined");
    const btn1 = new MessageButton();
    const btn2 = new MessageButton().setLabel("close").setStyle(MessageButtonStyles.DANGER).setCustomId("close," + cid); // close,#mp_xxxx

    if (this.transferLog) {
      btn1.setLabel("stop logging").setStyle(MessageButtonStyles.SECONDARY).setCustomId("stopLog," + cid); // stopLog,#mp_xxxx
    } else {
      btn1.setLabel("start logging").setStyle(MessageButtonStyles.PRIMARY).setCustomId("startLog," + cid); // stopLog,#mp_xxxx
    }

    const row = new MessageActionRow().addComponents(btn1, btn2);

    return row;
  }

  getPlayerOrders() {
    const map = new Map<Player, { name: string, playcount: number, order: number, slot: number }>();
    for (const p of this.lobby.players) {
      const info = {
        name: p.name,
        playcount: this.inoutLogger.players.get(p) ?? 0,
        slot: p.slot,
        order: 16
      }
      map.set(p, info);
    }
    for (const [i, p] of this.selector.hostQueue.entries()) {
      const info = map.get(p);
      if (info) {
        info.order = i;
      }
    }

    const fields = [...map.values()].sort((a, b) => a.order - b.order).map((info) => `${info.name}(${info.playcount})`);
    return fields.join(", ");
  }
}
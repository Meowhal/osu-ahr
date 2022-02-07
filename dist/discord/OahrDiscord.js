"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OahrDiscord = void 0;
const __1 = require("..");
const log4js_1 = __importDefault(require("log4js"));
const OahrBase_1 = require("../cli/OahrBase");
const discord_js_1 = require("discord.js");
const logger = log4js_1.default.getLogger("discord");
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
};
class OahrDiscord extends OahrBase_1.OahrBase {
    constructor(client, sh) {
        super(client);
        this.guildId = "";
        this.discordChannelId = "";
        this.transferLog = false;
        this.updateSummaryMessage = true;
        this.matchSummaryMessageId = "";
    }
    setGuildId(guildId) {
        this.guildId = guildId;
        for (const l of this.getLoggers()) {
            l.addContext("guildId", guildId);
        }
    }
    startTransferLog(discordChannelId) {
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
        const embed = new discord_js_1.MessageEmbed().setColor("BLURPLE").setTitle("Lobby Information - " + name).setURL(`https://osu.ppy.sh/community/matches/${lid}`);
        embed.addField("lobby", `id:${lid}, status:${__1.LobbyStatus[lobby.status]}, host:${host}, players:${lobby.players.size}, name:${name}`);
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
        const stat = lobby.status == __1.LobbyStatus.Left ? LOBBY_STAT.closed : lobby.isMatching ? LOBBY_STAT.match : LOBBY_STAT.idle;
        const lid = lobby.lobbyId ?? "";
        const name = lobby.lobbyName ?? "";
        const host = lobby.host?.name ?? "none";
        const embed = new discord_js_1.MessageEmbed().setColor(stat.color).setTitle(`#mp_${lid}`).setURL(`https://osu.ppy.sh/community/matches/${lid}`);
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
    createMenuButton() {
        const cid = this.lobby.channel; // #mp_xxxx
        if (cid == undefined)
            throw new Error("invalid ahr lobby state. channel is undefined");
        return new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton().setLabel("Menu").setStyle(1 /* PRIMARY */).setCustomId("menu," + cid));
    }
    createControllButtons() {
        const cid = this.lobby.channel; // #mp_xxxx
        if (cid == undefined)
            throw new Error("invalid ahr lobby state. channel is undefined");
        const btn1 = new discord_js_1.MessageButton();
        const btn2 = new discord_js_1.MessageButton().setLabel("close").setStyle(4 /* DANGER */).setCustomId("close," + cid); // close,#mp_xxxx
        if (this.transferLog) {
            btn1.setLabel("Stop transfer").setStyle(2 /* SECONDARY */).setCustomId("stopLog," + cid); // stopLog,#mp_xxxx
        }
        else {
            btn1.setLabel("Start transfer").setStyle(1 /* PRIMARY */).setCustomId("startLog," + cid); // stopLog,#mp_xxxx
        }
        const row = new discord_js_1.MessageActionRow().addComponents(btn1, btn2);
        return row;
    }
    getPlayerOrders() {
        const map = new Map();
        for (const p of this.lobby.players) {
            const info = {
                name: p.name,
                playcount: this.inoutLogger.players.get(p) ?? 0,
                slot: p.slot,
                order: 16
            };
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
exports.OahrDiscord = OahrDiscord;
//# sourceMappingURL=OahrDiscord.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobby = exports.LobbyStatus = void 0;
const Player_1 = require("./Player");
const parsers_1 = require("./parsers");
const libs_1 = require("./libs");
const MpSettingsParser_1 = require("./parsers/MpSettingsParser");
const HistoryRepository_1 = require("./webapi/HistoryRepository");
const config_1 = __importDefault(require("config"));
const log4js_1 = __importDefault(require("log4js"));
var LobbyStatus;
(function (LobbyStatus) {
    LobbyStatus[LobbyStatus["Standby"] = 0] = "Standby";
    LobbyStatus[LobbyStatus["Making"] = 1] = "Making";
    LobbyStatus[LobbyStatus["Made"] = 2] = "Made";
    LobbyStatus[LobbyStatus["Entering"] = 3] = "Entering";
    LobbyStatus[LobbyStatus["Entered"] = 4] = "Entered";
    LobbyStatus[LobbyStatus["Leaving"] = 5] = "Leaving";
    LobbyStatus[LobbyStatus["Left"] = 6] = "Left";
})(LobbyStatus = exports.LobbyStatus || (exports.LobbyStatus = {}));
const LobbyDefaultOption = config_1.default.get("Lobby");
class Lobby {
    constructor(ircClient, option = {}) {
        this.mapTitle = "";
        this.mapId = 0;
        this.host = null;
        this.hostPending = null;
        this.players = new Set();
        this.playersMap = new Map();
        this.isMatching = false;
        this.isStartTimerActive = false;
        this.isClearedHost = false;
        this.listRefStart = 0;
        this.plugins = [];
        this.coolTimes = {};
        this.deferredMessages = {};
        this.infoMessageAnnouncementTimeId = null;
        // Events
        this.JoinedLobby = new libs_1.TypedEvent();
        this.PlayerJoined = new libs_1.TypedEvent();
        this.PlayerLeft = new libs_1.TypedEvent();
        this.PlayerMoved = new libs_1.TypedEvent();
        this.HostChanged = new libs_1.TypedEvent();
        this.MatchStarted = new libs_1.TypedEvent();
        this.PlayerFinished = new libs_1.TypedEvent();
        this.MatchFinished = new libs_1.TypedEvent();
        this.AbortedMatch = new libs_1.TypedEvent();
        this.UnexpectedAction = new libs_1.TypedEvent();
        this.NetError = new libs_1.TypedEvent();
        this.PlayerChated = new libs_1.TypedEvent();
        this.ReceivedChatCommand = new libs_1.TypedEvent();
        this.PluginMessage = new libs_1.TypedEvent();
        this.SentMessage = new libs_1.TypedEvent();
        this.ReceivedBanchoResponse = new libs_1.TypedEvent();
        this.ParsedStat = new libs_1.TypedEvent();
        this.FixedSettings = new libs_1.TypedEvent();
        this.ParsedSettings = new libs_1.TypedEvent();
        this.LeftChannel = new libs_1.TypedEvent();
        this.events = {};
        if (ircClient.conn == null) {
            throw new Error("clientが未接続です");
        }
        this.option = { ...LobbyDefaultOption, ...option };
        this.status = LobbyStatus.Standby;
        this.settingParser = new MpSettingsParser_1.MpSettingsParser();
        this.statParser = new parsers_1.StatParser();
        this.ircClient = ircClient;
        this.logger = log4js_1.default.getLogger("lobby");
        this.logger.addContext("channel", "lobby");
        this.chatlogger = log4js_1.default.getLogger("chat");
        this.chatlogger.addContext("channel", "lobby");
        this.historyRepository = new HistoryRepository_1.HistoryRepository(0);
        this.transferHostTimeout = new libs_1.DeferredAction(() => this.onTimeoutedTransferHost());
        this.registerEvents();
    }
    registerEvents() {
        this.events = {
            message: (from, to, message) => {
                if (to == this.channel) {
                    this.handleMessage(from, to, message);
                }
            },
            action: (from, to, message) => {
                if (to == this.channel) {
                    this.handleAction(from, to, message);
                }
            },
            netError: (err) => {
                this.RaiseNetError(err);
            },
            registered: async () => {
                if (this.status == LobbyStatus.Entered && this.channel) {
                    this.logger.warn("network reconnection detected!");
                    await this.LoadMpSettingsAsync();
                }
            },
            pm: (nick, message) => {
                this.handlePrivateMessage(nick, message);
            },
            kick: (channel, who, by, reason) => {
                this.logger.info('%s was kicked from %s by %s: %s', who, channel, by, reason);
            },
            part: (channel, nick) => {
                if (channel == this.channel) {
                    this.stopInfoMessageAnnouncement();
                    this.CancelAllDeferredMessages();
                    this.historyRepository.lobbyClosed = true;
                    this.logger.info("part");
                    this.status = LobbyStatus.Left;
                    this.destroy();
                }
            },
            selfMessage: (target, toSend) => {
                if (target == this.channel) {
                    const r = toSend.replace(/\[http\S+\s([^\]]+)\]/g, "[http... $1]");
                    this.chatlogger.info("bot:%s", r);
                }
            }
        };
        for (let key in this.events) {
            this.ircClient.on(key, this.events[key]);
        }
        this.events.join = (channel, who) => {
            this.logger.trace("raised join event");
            if (who == this.ircClient.nick && this.status != LobbyStatus.Entered) {
                this.RaiseJoinedLobby(channel);
            }
        };
        this.ircClient.once("join", this.events.join);
    }
    destroy() {
        this.LeftChannel.emit();
        this.removeEvents();
    }
    removeEvents() {
        for (let key in this.events) {
            this.ircClient.off(key, this.events[key]);
        }
    }
    /**
     * 試合を終えて待機中の人数を数える
     */
    get playersFinished() {
        let i = 0;
        for (let p of this.players) {
            if (p.mpstatus == Player_1.MpStatuses.Finished)
                i++;
        }
        return i;
    }
    /**
     * 試合中の人数を数える
     */
    get playersInGame() {
        let i = 0;
        for (let p of this.players) {
            if (p.mpstatus == Player_1.MpStatuses.Finished || p.mpstatus == Player_1.MpStatuses.Playing)
                i++;
        }
        return i;
    }
    /**
     * プレイヤーたちの状況を項目ごとに数える
     */
    CountPlayersStatus() {
        const r = { inGame: 0, playing: 0, finished: 0, inlobby: 0, total: this.players.size };
        for (let p of this.players) {
            switch (p.mpstatus) {
                case Player_1.MpStatuses.InLobby:
                    r.inlobby++;
                    break;
                case Player_1.MpStatuses.Playing:
                    r.playing++;
                    break;
                case Player_1.MpStatuses.Finished:
                    r.finished++;
                    break;
            }
        }
        r.inGame = r.finished + r.playing;
        return r;
    }
    /**
     * usernameからプレイヤーオブジェクトを取得または作成する
     * nameに対してPlayerは一意のインスタンスで直接比較可能
     * この関数以外でPlayerを作成してはならない
     * 再入室してきたユーザーの情報を参照したい場合に備えてプレイヤーをマップで保持しておく
     * @param username
     */
    GetOrMakePlayer(username) {
        const ename = (0, Player_1.escapeUserName)(username);
        if (this.playersMap.has(ename)) {
            return this.playersMap.get(ename);
        }
        else {
            const nu = new Player_1.Player(username);
            this.playersMap.set(ename, nu);
            if (this.option.authorized_users.includes(username)) {
                nu.setRole(Player_1.Roles.Authorized);
            }
            return nu;
        }
    }
    /**
     * username からプレイヤーオブジェクトを取得する
     * まだ作成されていないプレイヤーだった場合nullを返す
     * @param username
     */
    GetPlayer(username) {
        const ename = (0, Player_1.escapeUserName)(username);
        if (this.playersMap.has(ename)) {
            return this.playersMap.get(ename);
        }
        else {
            return null;
        }
    }
    // username のプレイヤーがゲームに参加しているか調べる
    Includes(username) {
        const ename = (0, Player_1.escapeUserName)(username);
        let p = this.playersMap.get(ename);
        if (p === undefined)
            return false;
        return this.players.has(p);
    }
    TransferHostAsync(user) {
        this.hostPending = user;
        return new Promise((resolve, reject) => {
            const d1 = this.HostChanged.on((a) => {
                dispose();
                if (a.player == user) {
                    resolve();
                }
                else {
                    reject("Another player became host.");
                }
            });
            const d2 = this.PlayerLeft.on((a) => {
                if (a.player == user) {
                    dispose();
                    reject("Pending host left the lobby.");
                }
            });
            const t1 = setTimeout(() => {
                dispose();
                reject("!mp host command timed out.");
            }, this.option.transferhost_timeout_ms);
            const dispose = () => {
                d1.dispose();
                d2.dispose();
                clearTimeout(t1);
            };
        });
    }
    TransferHost(user) {
        this.transferHostTimeout.cancel();
        this.hostPending = user;
        this.transferHostTimeout.start(this.option.transferhost_timeout_ms);
        if (user.id != 0) {
            this.SendMessage("!mp host #" + user.id);
        }
        else {
            this.SendMessage("!mp host " + user.name);
        }
    }
    onTimeoutedTransferHost() {
        this.logger.warn("!mp host timeout");
        if (this.hostPending) {
            if (this.players.has(this.hostPending)) {
                this.LoadMpSettingsAsync();
            }
            this.hostPending = null;
        }
    }
    AbortMatch() {
        if (this.isMatching) {
            this.SendMessage("!mp abort");
        }
    }
    SendMessage(message) {
        if (this.channel != undefined) {
            this.ircClient.say(this.channel, message);
            this.ircClient.emit("sentMessage", this.channel, message);
            this.SentMessage.emit({ message });
            //this.chatlogger.trace("%s:%s", "bot", message);
        }
    }
    SendPrivateMessage(message, target) {
        this.ircClient.say(target, message);
        this.ircClient.emit("sentPrivateMessage", target, message);
        this.SentMessage.emit({ message });
        this.chatlogger.info("%s:%s", "botbot->" + target, message);
    }
    SendMessageWithCoolTime(message, tag, cooltimeMs) {
        const now = Date.now();
        if (tag in this.coolTimes) {
            if (now - this.coolTimes[tag] < cooltimeMs) {
                return false;
            }
        }
        this.coolTimes[tag] = now;
        if (typeof message == "function") {
            message = message();
        }
        this.SendMessage(message);
        return true;
    }
    SendPrivateMessageWithCoolTime(message, target, tag, cooltimeMs) {
        const now = Date.now();
        if (tag in this.coolTimes) {
            if (now - this.coolTimes[tag] < cooltimeMs) {
                return false;
            }
        }
        this.coolTimes[tag] = now;
        if (typeof message == "function") {
            message = message();
        }
        this.SendPrivateMessage(message, target);
        return true;
    }
    SendMessageWithDelayAsync(message, delay) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.SendMessage(message);
                resolve();
            }, delay);
        });
    }
    DeferMessage(message, tag, delayMs, resetTimer = false) {
        if (message == "") {
            this.CancelDeferredMessage(tag);
            return;
        }
        if (!(tag in this.deferredMessages)) {
            this.deferredMessages[tag] = new libs_1.DeferredAction(msg => {
                this.SendMessage(msg);
            });
        }
        this.deferredMessages[tag].start(delayMs, message, resetTimer);
    }
    CancelDeferredMessage(tag) {
        if (tag in this.deferredMessages) {
            this.deferredMessages[tag].cancel();
        }
    }
    CancelAllDeferredMessages() {
        for (let tag in this.deferredMessages) {
            this.deferredMessages[tag].cancel();
        }
    }
    async RequestStatAsync(player, byPm, timeout = this.option.stat_timeout_ms) {
        return new Promise((resolve, reject) => {
            const tm = setTimeout(() => {
                reject("stat timeout");
            }, timeout);
            const d = this.ParsedStat.on(({ result }) => {
                if ((0, Player_1.escapeUserName)(result.name) == player.escaped_name) {
                    clearTimeout(tm);
                    d.dispose();
                    resolve(result);
                }
            });
            this.ircClient.say(byPm || this.channel == null ? "BanchoBot" : this.channel, "!stat " + player.escaped_name);
        });
    }
    async SendMultilineMessageWithInterval(lines, intervalMs, tag, cooltimeMs) {
        if (lines.length == 0)
            return;
        const totalTime = lines.length * intervalMs + cooltimeMs;
        if (this.SendMessageWithCoolTime(lines[0], tag, totalTime)) {
            for (let i = 1; i < lines.length; i++) {
                await this.SendMessageWithDelayAsync(lines[i], intervalMs);
            }
        }
    }
    // #region message handling
    handleMessage(from, to, message) {
        if (from == "BanchoBot") {
            this.handleBanchoResponse(message);
        }
        else {
            const p = this.GetPlayer(from);
            if (p != null) {
                if (parsers_1.parser.IsChatCommand(message)) {
                    this.RaiseReceivedChatCommand(p, message);
                }
                this.PlayerChated.emit({ player: p, message });
                if ((0, parsers_1.IsStatResponse)(message)) {
                    this.chatlogger.trace("%s:%s", p.name, message);
                }
                else {
                    this.chatlogger.info("%s:%s", p.name, message);
                }
            }
        }
    }
    handleAction(from, to, message) {
        this.chatlogger.info("*%s:%s", from, message);
    }
    handlePrivateMessage(from, message) {
        if (from == "BanchoBot") {
            if ((0, parsers_1.IsStatResponse)(message)) {
                if (this.statParser.feedLine(message)) {
                    this.RaiseParsedStat(true);
                }
            }
        }
        else {
            const user = this.GetPlayer(from);
            if (!user)
                return;
            if ((message == "!info" || message == "!help") && this.players.has(user)) {
                this.sendInfoMessagePM(user);
            }
        }
    }
    handleBanchoResponse(message) {
        const c = parsers_1.parser.ParseBanchoResponse(message);
        switch (c.type) {
            case parsers_1.BanchoResponseType.HostChanged:
                this.RaiseHostChanged(c.params[0]);
                this.isClearedHost = false;
                break;
            case parsers_1.BanchoResponseType.UserNotFound:
                this.OnUserNotFound();
                break;
            case parsers_1.BanchoResponseType.MatchFinished:
                this.RaiseMatchFinished();
                break;
            case parsers_1.BanchoResponseType.MatchStarted:
                this.isStartTimerActive = false;
                this.RaiseMatchStarted();
                break;
            case parsers_1.BanchoResponseType.BeganStartTimer:
                this.isStartTimerActive = true;
                break;
            case parsers_1.BanchoResponseType.AbortedStartTimer:
                this.isStartTimerActive = false;
                break;
            case parsers_1.BanchoResponseType.PlayerFinished:
                this.RaisePlayerFinished(c.params[0], c.params[1], c.params[2]);
                break;
            case parsers_1.BanchoResponseType.PlayerJoined:
                this.RaisePlayerJoined(c.params[0], c.params[1], c.params[2]);
                break;
            case parsers_1.BanchoResponseType.PlayerLeft:
                this.RaisePlayerLeft(c.params[0]);
                break;
            case parsers_1.BanchoResponseType.AbortedMatch:
            case parsers_1.BanchoResponseType.AbortMatchFailed:
                this.RaiseAbortedMatch();
                break;
            case parsers_1.BanchoResponseType.AddedReferee:
                this.GetOrMakePlayer(c.params[0]).setRole(Player_1.Roles.Referee);
                this.logger.trace("AddedReferee : %s", c.params[0]);
                break;
            case parsers_1.BanchoResponseType.RemovedReferee:
                this.GetOrMakePlayer(c.params[0]).removeRole(Player_1.Roles.Referee);
                this.logger.trace("RemovedReferee : %s", c.params[0]);
                break;
            case parsers_1.BanchoResponseType.ListRefs:
                this.listRefStart = Date.now();
                break;
            case parsers_1.BanchoResponseType.PlayerMovedSlot:
                this.RaisePlayerMoved(c.params[0], c.params[1]);
                break;
            case parsers_1.BanchoResponseType.TeamChanged:
                this.GetOrMakePlayer(c.params[0]).team = c.params[1];
                this.logger.trace("team changed : %s, %s", c.params[0], Player_1.Teams[c.params[1]]);
                break;
            case parsers_1.BanchoResponseType.BeatmapChanged:
            case parsers_1.BanchoResponseType.MpBeatmapChanged:
                if (this.mapId != c.params[0]) {
                    this.mapId = c.params[0];
                    this.mapTitle = c.params[1];
                    const changer = this.host ? `(by ${c.type == parsers_1.BanchoResponseType.BeatmapChanged ? this.host.name : "bot"})` : "";
                    this.logger.info("beatmap changed%s : %s %s", changer, "https://osu.ppy.sh/b/" + this.mapId, this.mapTitle);
                }
                break;
            case parsers_1.BanchoResponseType.Settings:
                if (this.settingParser.feedLine(message)) {
                    this.RaiseParsedSettings();
                }
                break;
            case parsers_1.BanchoResponseType.Stats:
                if (this.statParser.feedLine(message)) {
                    this.RaiseParsedStat(false);
                }
                break;
            case parsers_1.BanchoResponseType.ClearedHost:
                this.logger.info("cleared host");
                this.isClearedHost = true;
                if (this.host != null) {
                    this.host.removeRole(Player_1.Roles.Host);
                }
                this.host = null;
                this.hostPending = null;
                break;
            case parsers_1.BanchoResponseType.Unhandled:
                if (this.checkListRef(message))
                    break;
                this.logger.debug("unhandled bancho response : %s", message);
                break;
        }
        this.ReceivedBanchoResponse.emit({ message, response: c });
    }
    checkListRef(message) {
        if (this.listRefStart != 0) {
            if (Date.now() < this.listRefStart + this.option.listref_duration_ms) {
                const p = this.GetOrMakePlayer(message);
                p.setRole(Player_1.Roles.Referee);
                this.logger.trace("AddedReferee : %s", p.escaped_name);
                return true;
            }
            else {
                this.listRefStart = 0;
                this.logger.trace("check list ref ended");
            }
        }
        return false;
    }
    RaiseReceivedChatCommand(player, message) {
        this.logger.trace("custom command %s:%s", player.name, message);
        if (player.isReferee && message.startsWith("!mp"))
            return;
        const { command, param } = parsers_1.parser.ParseChatCommand(message);
        if (command == "!info" || command == "!help") {
            this.showInfoMessage();
        }
        if (command == "!version" || command == "!v") {
            this.showVersionMessage();
        }
        this.ReceivedChatCommand.emit({ player, command, param });
    }
    // #endregion
    // #region event handling
    RaisePlayerJoined(username, slot, team, asHost = false) {
        const player = this.GetOrMakePlayer(username);
        if (this.addPlayer(player, slot, team)) {
            this.PlayerJoined.emit({ player, slot, team, fromMpSettings: false });
        }
        else {
            this.LoadMpSettingsAsync();
        }
    }
    RaisePlayerLeft(username) {
        const player = this.GetOrMakePlayer(username);
        const slot = player.slot;
        if (this.removePlayer(player)) {
            this.PlayerLeft.emit({ player, fromMpSettings: false, slot });
        }
        else {
            this.LoadMpSettingsAsync();
        }
    }
    RaisePlayerMoved(username, slot) {
        const player = this.GetOrMakePlayer(username);
        const from = player.slot;
        player.slot = slot;
        this.logger.trace("slot moved : %s, %d", username, slot);
        this.PlayerMoved.emit({ player, from, to: slot });
    }
    RaiseHostChanged(username) {
        const player = this.GetOrMakePlayer(username);
        if (this.setAsHost(player)) {
            this.HostChanged.emit({ player });
        }
        else {
            this.LoadMpSettingsAsync();
        }
    }
    RaiseMatchStarted() {
        this.logger.info("match started");
        this.isMatching = true;
        this.players.forEach(p => p.mpstatus = Player_1.MpStatuses.Playing);
        this.MatchStarted.emit({ mapId: this.mapId, mapTitle: this.mapTitle });
    }
    RaisePlayerFinished(username, score, isPassed) {
        const player = this.GetOrMakePlayer(username);
        player.mpstatus = Player_1.MpStatuses.Finished;
        const sc = this.CountPlayersStatus();
        this.PlayerFinished.emit({ player, score, isPassed, playersFinished: sc.finished, playersInGame: sc.inGame });
        if (!this.players.has(player)) {
            this.logger.warn("未参加のプレイヤーがゲームを終えた: %s", username);
            this.LoadMpSettingsAsync();
        }
    }
    RaiseMatchFinished() {
        let count = this.players.size;
        this.logger.info(`match finished (${count} players)`);
        this.isMatching = false;
        this.players.forEach(p => p.mpstatus = Player_1.MpStatuses.InLobby);
        this.MatchFinished.emit();
    }
    RaiseAbortedMatch() {
        const sc = this.CountPlayersStatus();
        this.logger.info("match aborted %d / %d", sc.finished, sc.inGame);
        this.isMatching = false;
        this.players.forEach(p => p.mpstatus = Player_1.MpStatuses.InLobby);
        this.AbortedMatch.emit({ playersFinished: sc.finished, playersInGame: sc.inGame });
    }
    RaiseNetError(err) {
        this.logger.error("error occured : " + err.message);
        this.logger.error(err.stack);
        this.NetError.emit(err);
    }
    RaiseJoinedLobby(channel) {
        this.players.clear();
        this.channel = channel;
        this.lobbyId = channel.replace("#mp_", "");
        this.historyRepository.setLobbyId(this.lobbyId);
        this.status = LobbyStatus.Entered;
        this.logger.addContext("channel", this.lobbyId);
        this.chatlogger.addContext("channel", this.lobbyId);
        for (let p of this.plugins) {
            p.logger.addContext("channel", this.lobbyId);
        }
        this.assignCreatorRole();
        this.JoinedLobby.emit({ channel: this.channel, creator: this.GetOrMakePlayer(this.ircClient.nick) });
        this.startInfoMessageAnnouncement();
    }
    RaiseParsedSettings() {
        if (!this.settingParser.isParsing && this.settingParser.result != null) {
            this.logger.info("parsed mp settings");
            const result = this.settingParser.result;
            const r = this.margeMpSettingsResult(result);
            if (r.hostChanged || r.playersIn.length != 0 || r.playersOut.length != 0) {
                this.logger.info("applied mp settings");
                this.FixedSettings.emit({ result, ...r });
            }
            this.ParsedSettings.emit({ result, ...r });
        }
    }
    RaiseParsedStat(isPm) {
        if (!this.statParser.isParsing && this.statParser.result != null) {
            const p = this.GetPlayer(this.statParser.result.name);
            if (p != null) {
                p.laststat = this.statParser.result;
                this.logger.info("parsed stat %s -> %s", p.name, parsers_1.StatStatuses[p.laststat.status]);
                this.ParsedStat.emit({ result: this.statParser.result, player: p, isPm });
            }
        }
    }
    /**
     * pluginに読み込み作業が完了したことを通知する
     */
    RaisePluginsLoaded() {
        for (let p of this.plugins) {
            p.OnLoaded();
        }
    }
    OnUserNotFound() {
        if (this.hostPending != null) {
            const p = this.hostPending;
            this.logger.warn("occured OnUserNotFound : " + p.name);
            this.hostPending = null;
        }
    }
    // #endregion
    // #region lobby management
    MakeLobbyAsync(title) {
        if (title === "") {
            throw new Error("title is empty");
        }
        if (this.status != LobbyStatus.Standby) {
            throw new Error("A lobby has already been made.");
        }
        this.status = LobbyStatus.Making;
        this.logger.trace("start makeLobby");
        return new Promise(resolve => {
            if (this.ircClient.hostMask != "") {
                this.makeLobbyAsyncCore(title).then(v => resolve(v));
            }
            else {
                this.logger.trace("waiting registered");
                this.ircClient.once("registered", () => {
                    this.makeLobbyAsyncCore(title).then(v => resolve(v));
                });
            }
        });
    }
    makeLobbyAsyncCore(title) {
        return new Promise((resolve, reject) => {
            this.JoinedLobby.once(a => {
                this.lobbyName = title;
                this.logger.trace("completed makeLobby");
                if (this.lobbyId) {
                    resolve(this.lobbyId);
                }
                else {
                    reject("missing lobby id");
                }
            });
            const trg = "BanchoBot";
            const msg = "!mp make " + title;
            this.ircClient.say(trg, msg);
            this.ircClient.emit("sentMessage", trg, msg);
        });
    }
    EnterLobbyAsync(channel) {
        this.logger.trace("start EnterLobby");
        return new Promise((resolve, reject) => {
            let ch = parsers_1.parser.EnsureMpChannelId(channel);
            if (ch == "") {
                this.logger.error("invalid channel: %s", channel);
                reject("invalid channel");
                return;
            }
            let joinhandler = () => {
                this.ircClient.off('error', errhandler);
                this.lobbyName = "__";
                this.logger.trace("completed EnterLobby");
                if (this.lobbyId) {
                    resolve(this.lobbyId);
                }
                else {
                    this.destroy();
                    reject("missing lobby id");
                }
            };
            let errhandler = (message) => {
                this.ircClient.off('join', joinhandler);
                this.destroy();
                reject(`${message.args[2]}`);
            };
            this.ircClient.once('error', errhandler);
            this.ircClient.once('join', joinhandler);
            this.ircClient.join(ch);
        });
    }
    CloseLobbyAsync() {
        this.logger.trace("start CloseLobby");
        if (this.status != LobbyStatus.Entered) {
            this.logger.error("無効な呼び出し:CloseLobbyAsync");
            throw new Error("閉じるロビーがありません。");
        }
        return new Promise((resolve, reject) => {
            this.ircClient.once("part", (channel, nick) => {
                resolve();
            });
            if (this.channel != undefined) {
                this.SendMessage("!mp close");
                this.status = LobbyStatus.Leaving;
            }
            else {
                reject();
            }
        });
    }
    QuitLobbyAsync() {
        this.logger.trace("start QuitLobby");
        if (this.status != LobbyStatus.Entered) {
            this.logger.error("無効な呼び出し:QuitLobbyAsync");
            throw new Error("閉じるロビーがありません。");
        }
        return new Promise((resolve, reject) => {
            this.ircClient.once("part", (channel, nick) => {
                resolve();
            });
            if (this.channel != undefined) {
                this.ircClient.part(this.channel, "part", () => { });
                this.status = LobbyStatus.Leaving;
            }
            else {
                reject();
            }
        });
    }
    LoadMpSettingsAsync() {
        if (this.status != LobbyStatus.Entered) {
            return Promise.reject("invalid lobby status @LoadMpSettingsAsync");
        }
        if (this.SendMessageWithCoolTime("!mp settings", "mpsettings", 15000)) {
            this.logger.trace("start loadLobbySettings");
            const p = new Promise(resolve => {
                this.FixedSettings.once(() => {
                    this.SendMessage("!mp listrefs");
                    this.logger.trace("completed loadLobbySettings");
                    resolve();
                });
            });
            return p;
        }
        else {
            this.logger.trace("load mp settings skiped by cool time");
            return Promise.resolve();
        }
    }
    addPlayer(player, slot, team, asHost = false) {
        player.setRole(Player_1.Roles.Player);
        player.slot = slot;
        player.team = team;
        player.mpstatus = Player_1.MpStatuses.InLobby;
        if (!this.players.has(player)) {
            this.players.add(player);
            if (asHost) {
                this.setAsHost(player);
            }
            if (16 < this.players.size) {
                this.logger.warn("joined 17th players: %s", player.name);
                this.UnexpectedAction.emit(new Error("unexpected join"));
                return false;
            }
            return true;
        }
        else {
            this.logger.warn("参加済みのプレイヤーが再度参加した: %s", player.name);
            this.UnexpectedAction.emit(new Error("unexpected join"));
            return false;
        }
    }
    removePlayer(player) {
        player.removeRole(Player_1.Roles.Player);
        player.removeRole(Player_1.Roles.Host);
        player.mpstatus = Player_1.MpStatuses.None;
        if (this.players.has(player)) {
            this.players.delete(player);
            if (this.host == player) {
                this.host = null;
            }
            if (this.hostPending == player) {
                this.logger.warn("pending中にユーザーが離脱した pending host: %s", player.name);
                this.hostPending = null;
            }
            return true;
        }
        else {
            this.logger.warn("未参加のプレイヤーが退出した: %s", player.name);
            this.UnexpectedAction.emit(new Error("unexpected left"));
            return false;
        }
    }
    setAsHost(player) {
        if (!this.players.has(player)) {
            this.transferHostTimeout.cancel();
            this.logger.warn("未参加のプレイヤーがホストになった: %s", player.name);
            return false;
        }
        if (this.hostPending == player) {
            this.transferHostTimeout.cancel();
            this.hostPending = null;
        }
        else if (this.hostPending != null) {
            this.logger.warn("pending中に別のユーザーがホストになった pending: %s, host: %s", this.hostPending.name, player.name);
        } // pending == null は有効
        if (this.host != null) {
            this.host.removeRole(Player_1.Roles.Host);
        }
        this.host = player;
        player.setRole(Player_1.Roles.Host);
        return true;
    }
    /**
     * MpSettingsの結果を取り込む。join/left/hostの発生しない
     * @param result
     */
    margeMpSettingsResult(result) {
        this.lobbyName = result.name;
        this.mapId = result.beatmapId;
        this.mapTitle = result.beatmapTitle;
        const mpPlayers = result.players.map(r => this.GetOrMakePlayer(r.name));
        const playersIn = [];
        const playersOut = [];
        let hostChanged = false;
        for (let p of this.players) {
            if (!mpPlayers.includes(p)) {
                const slot = p.slot;
                this.removePlayer(p);
                playersOut.push(p);
                this.PlayerLeft.emit({ player: p, fromMpSettings: true, slot });
            }
        }
        for (let r of result.players) {
            let p = this.GetOrMakePlayer(r.name);
            if (!this.players.has(p)) {
                this.addPlayer(p, r.slot, r.team);
                playersIn.push(p);
                this.PlayerJoined.emit({ player: p, slot: p.slot, team: p.team, fromMpSettings: true });
            }
            else {
                p.slot = r.slot;
                p.team = r.team;
            }
            if (r.isHost && p != this.host) {
                this.setAsHost(p);
                hostChanged = true;
            }
        }
        return { playersIn, playersOut, hostChanged };
    }
    // #endregion
    GetLobbyStatus() {
        const pc = this.CountPlayersStatus();
        let s = `=== lobby status ===
  lobby id : ${this.lobbyId}, name : ${this.lobbyName},  status : ${LobbyStatus[this.status]}
  players : ${this.players.size}, inGame : ${pc.inGame} (playing : ${pc.playing})
  refs : ${Array.from(this.playersMap.values()).filter(v => v.isReferee).map(v => v.name).join(",")}
  timer : ${this.isStartTimerActive}, clearedhost : ${this.isClearedHost}
  host : ${this.host ? this.host.name : "null"}, pending : ${this.hostPending ? this.hostPending.name : "null"}`;
        for (let p of this.plugins) {
            const ps = p.GetPluginStatus();
            if (ps != "") {
                s += "\n" + ps;
            }
        }
        return s;
    }
    showInfoMessage() {
        this.SendMessageWithCoolTime(this.getInfoMessage(), "infomessage", this.option.info_message_cooltime_ms);
    }
    showVersionMessage() {
        this.SendMessageWithCoolTime(`osu! Auto Host Rotation Bot v. ${process.env.npm_package_version}`, "versionmessage", this.option.info_message_cooltime_ms);
    }
    sendInfoMessagePM(player) {
        this.SendPrivateMessageWithCoolTime(this.getInfoMessage(), player.escaped_name, "infomessage", this.option.info_message_cooltime_ms);
    }
    getInfoMessage() {
        return this.option.info_message.replace("${version}", process.env.npm_package_version ?? "0.0.0");
    }
    // ircでログインしたユーザーに権限を与える
    assignCreatorRole() {
        if (!this.ircClient.nick) {
            this.ircClient.once("registered", () => {
                this.assignCreatorRole();
            });
        }
        else {
            var c = this.GetOrMakePlayer(this.ircClient.nick);
            c.setRole(Player_1.Roles.Authorized);
            c.setRole(Player_1.Roles.Referee);
            c.setRole(Player_1.Roles.Creator);
            this.logger.info("assigned %s creators role", this.ircClient.nick);
        }
    }
    startInfoMessageAnnouncement() {
        // ensure time is stop
        this.stopInfoMessageAnnouncement();
        if (this.option.info_message_announcement_interval_ms > 3 * 60 * 1000) {
            this.logger.trace("started InfoMessageAnnouncement. interval = " + this.option.info_message_announcement_interval_ms);
            this.infoMessageAnnouncementTimeId = setInterval(() => {
                this.showInfoMessage();
                if (this.status != LobbyStatus.Entered) {
                    this.stopInfoMessageAnnouncement();
                }
            }, this.option.info_message_announcement_interval_ms);
        }
    }
    stopInfoMessageAnnouncement() {
        if (this.infoMessageAnnouncementTimeId != null) {
            this.logger.trace("stopped InfoMessageAnnouncement.");
            clearInterval(this.infoMessageAnnouncementTimeId);
            this.infoMessageAnnouncementTimeId = null;
        }
    }
}
exports.Lobby = Lobby;
//# sourceMappingURL=Lobby.js.map
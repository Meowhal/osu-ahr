"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobby = exports.LobbyStatus = void 0;
const Player_1 = require("./Player");
const CommandParser_1 = require("./parsers/CommandParser");
const StatParser_1 = require("./parsers/StatParser");
const TypedEvent_1 = require("./libs/TypedEvent");
const DeferredAction_1 = require("./libs/DeferredAction");
const MpSettingsParser_1 = require("./parsers/MpSettingsParser");
const HistoryRepository_1 = require("./webapi/HistoryRepository");
const TypedConfig_1 = require("./TypedConfig");
const Loggers_1 = require("./Loggers");
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
class Lobby {
    constructor(ircClient, option = {}) {
        this.mapTitle = '';
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
        this.JoinedLobby = new TypedEvent_1.TypedEvent();
        this.PlayerJoined = new TypedEvent_1.TypedEvent();
        this.PlayerLeft = new TypedEvent_1.TypedEvent();
        this.PlayerMoved = new TypedEvent_1.TypedEvent();
        this.HostChanged = new TypedEvent_1.TypedEvent();
        this.MatchStarted = new TypedEvent_1.TypedEvent();
        this.PlayerFinished = new TypedEvent_1.TypedEvent();
        this.MatchFinished = new TypedEvent_1.TypedEvent();
        this.AbortedMatch = new TypedEvent_1.TypedEvent();
        this.UnexpectedAction = new TypedEvent_1.TypedEvent();
        this.NetError = new TypedEvent_1.TypedEvent();
        this.PlayerChated = new TypedEvent_1.TypedEvent();
        this.ReceivedChatCommand = new TypedEvent_1.TypedEvent();
        this.PluginMessage = new TypedEvent_1.TypedEvent();
        this.SentMessage = new TypedEvent_1.TypedEvent();
        this.ReceivedBanchoResponse = new TypedEvent_1.TypedEvent();
        this.ParsedStat = new TypedEvent_1.TypedEvent();
        this.FixedSettings = new TypedEvent_1.TypedEvent();
        this.ParsedSettings = new TypedEvent_1.TypedEvent();
        this.LeftChannel = new TypedEvent_1.TypedEvent();
        this.events = {};
        if (!ircClient.conn) {
            throw new Error('Client is not connected');
        }
        this.option = (0, TypedConfig_1.getConfig)('Lobby', option);
        this.status = LobbyStatus.Standby;
        this.settingParser = new MpSettingsParser_1.MpSettingsParser();
        this.statParser = new StatParser_1.StatParser();
        this.ircClient = ircClient;
        this.logger = (0, Loggers_1.getLogger)('lobby');
        this.chatlogger = (0, Loggers_1.getLogger)('chat');
        this.historyRepository = new HistoryRepository_1.HistoryRepository(0);
        this.transferHostTimeout = new DeferredAction_1.DeferredAction(() => this.onTimeoutedTransferHost());
        this.registerEvents();
    }
    registerEvents() {
        this.events = {
            message: (from, to, message) => {
                if (to === this.channel) {
                    this.handleMessage(from, to, message);
                }
            },
            action: (from, to, message) => {
                if (to === this.channel) {
                    this.handleAction(from, to, message);
                }
            },
            netError: (err) => {
                this.RaiseNetError(err);
            },
            registered: async () => {
                if (this.status === LobbyStatus.Entered && this.channel) {
                    this.logger.warn('Detected a network reconnection! Loading multiplayer settings...');
                    await this.LoadMpSettingsAsync();
                }
            },
            pm: (nick, message) => {
                this.handlePrivateMessage(nick, message);
            },
            kick: (channel, who, by, reason) => {
                this.logger.info(`${who} was kicked from ${channel} by ${by}: ${reason}`);
            },
            part: (channel, nick) => {
                if (channel === this.channel) {
                    this.stopInfoMessageAnnouncement();
                    this.CancelAllDeferredMessages();
                    this.historyRepository.lobbyClosed = true;
                    this.logger.info('Detected a part event. Destroying the lobby...');
                    this.status = LobbyStatus.Left;
                    this.destroy();
                }
            },
            selfMessage: (target, toSend) => {
                if (target === this.channel) {
                    const r = toSend.replace(/\[http\S+\s([^\]]+)\]/g, '[http... $1]');
                    this.chatlogger.info(`Bot: ${r}`);
                }
            }
        };
        for (const key in this.events) {
            this.ircClient.on(key, this.events[key]);
        }
        this.events.join = (channel, who) => {
            this.logger.trace('Raised a join event.');
            if (who === this.ircClient.nick && this.status !== LobbyStatus.Entered) {
                this.RaiseJoinedLobby(channel);
            }
        };
        this.ircClient.once('join', this.events.join);
    }
    destroy() {
        this.LeftChannel.emit();
        this.removeEvents();
    }
    removeEvents() {
        for (const key in this.events) {
            this.ircClient.off(key, this.events[key]);
        }
    }
    /**
     * Count the number of people who finished the match.
     */
    get playersFinished() {
        let i = 0;
        for (const p of this.players) {
            if (p.mpstatus === Player_1.MpStatuses.Finished)
                i++;
        }
        return i;
    }
    /**
     * Count the number of people in the match.
     */
    get playersInGame() {
        let i = 0;
        for (const p of this.players) {
            if (p.mpstatus === Player_1.MpStatuses.Finished || p.mpstatus === Player_1.MpStatuses.Playing)
                i++;
        }
        return i;
    }
    /**
     * Count the number of players in each situation.
     */
    CountPlayersStatus() {
        const r = { inGame: 0, playing: 0, finished: 0, inlobby: 0, total: this.players.size };
        for (const p of this.players) {
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
     * Get or create a player object from username
     * Player is a unique instance, so it is directly comparable
     * Player must not be created outside of this function
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
     * Get a player object from username
     * Return null if the player has not been created yet
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
    // Check if the player is participating in the Lobby
    Includes(username) {
        const ename = (0, Player_1.escapeUserName)(username);
        const p = this.playersMap.get(ename);
        if (p === undefined)
            return false;
        return this.players.has(p);
    }
    TransferHostAsync(user) {
        this.hostPending = user;
        return new Promise((resolve, reject) => {
            const d1 = this.HostChanged.on((a) => {
                dispose();
                if (a.player === user) {
                    resolve();
                }
                else {
                    reject('Another player became a host');
                }
            });
            const d2 = this.PlayerLeft.on((a) => {
                if (a.player === user) {
                    dispose();
                    reject('A pending host has left the lobby');
                }
            });
            const t1 = setTimeout(() => {
                dispose();
                reject('The !mp host command has timed out');
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
        if (user.id !== 0) {
            this.SendMessage(`!mp host #${user.id}`);
        }
        else {
            this.SendMessage(`!mp host ${user.name}`);
        }
    }
    onTimeoutedTransferHost() {
        this.logger.warn('!mp host timeout');
        if (this.hostPending) {
            if (this.players.has(this.hostPending)) {
                this.LoadMpSettingsAsync();
            }
            this.hostPending = null;
        }
    }
    AbortMatch() {
        if (this.isMatching) {
            this.SendMessage('!mp abort');
        }
    }
    SendMessage(message) {
        if (this.channel) {
            this.ircClient.say(this.channel, message);
            this.ircClient.emit('sentMessage', this.channel, message);
            this.SentMessage.emit({ message });
            //this.chatlogger.trace(`bot:${message}`);
        }
    }
    SendPrivateMessage(message, target) {
        this.ircClient.say(target, message);
        this.ircClient.emit('sentPrivateMessage', target, message);
        this.SentMessage.emit({ message });
        this.chatlogger.info(`Bot -> ${target}: ${message}`);
    }
    SendMessageWithCoolTime(message, tag, cooltimeMs) {
        const now = Date.now();
        if (tag in this.coolTimes) {
            if (now - this.coolTimes[tag] < cooltimeMs) {
                return false;
            }
        }
        this.coolTimes[tag] = now;
        if (typeof message === 'function') {
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
        if (typeof message === 'function') {
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
        if (message === '') {
            this.CancelDeferredMessage(tag);
            return;
        }
        if (!(tag in this.deferredMessages)) {
            this.deferredMessages[tag] = new DeferredAction_1.DeferredAction(msg => {
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
        for (const tag in this.deferredMessages) {
            this.deferredMessages[tag].cancel();
        }
    }
    async RequestStatAsync(player, byPm, timeout = this.option.stat_timeout_ms) {
        return new Promise((resolve, reject) => {
            const tm = setTimeout(() => {
                reject('Stat request has timed out');
            }, timeout);
            const d = this.ParsedStat.on(({ result }) => {
                if ((0, Player_1.escapeUserName)(result.name) === player.escaped_name) {
                    clearTimeout(tm);
                    d.dispose();
                    resolve(result);
                }
            });
            this.ircClient.say(byPm || !this.channel ? 'BanchoBot' : this.channel, `!stat ${player.escaped_name}`);
        });
    }
    async SendMultilineMessageWithInterval(lines, intervalMs, tag, cooltimeMs) {
        if (lines.length === 0)
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
        if (from === 'BanchoBot') {
            this.handleBanchoResponse(message);
        }
        else {
            const p = this.GetPlayer(from);
            if (p) {
                if (CommandParser_1.parser.IsChatCommand(message)) {
                    this.RaiseReceivedChatCommand(p, message);
                }
                this.PlayerChated.emit({ player: p, message });
                if ((0, StatParser_1.IsStatResponse)(message)) {
                    this.chatlogger.trace(`${p.name}:${message}`);
                }
                else {
                    this.chatlogger.info(`${p.name}:${message}`);
                }
            }
        }
    }
    handleAction(from, to, message) {
        this.chatlogger.info(`*${from}:${message}`);
    }
    handlePrivateMessage(from, message) {
        if (from === 'BanchoBot') {
            if ((0, StatParser_1.IsStatResponse)(message)) {
                if (this.statParser.feedLine(message)) {
                    this.RaiseParsedStat(true);
                }
            }
        }
        else {
            const user = this.GetPlayer(from);
            if (!user)
                return;
            if ((message === '!info' || message === '!help') && this.players.has(user)) {
                this.sendInfoMessagePM(user);
            }
        }
    }
    handleBanchoResponse(message) {
        const c = CommandParser_1.parser.ParseBanchoResponse(message);
        switch (c.type) {
            case CommandParser_1.BanchoResponseType.HostChanged:
                this.RaiseHostChanged(c.params[0]);
                this.isClearedHost = false;
                break;
            case CommandParser_1.BanchoResponseType.UserNotFound:
                this.OnUserNotFound();
                break;
            case CommandParser_1.BanchoResponseType.MatchFinished:
                this.RaiseMatchFinished();
                break;
            case CommandParser_1.BanchoResponseType.MatchStarted:
                this.isStartTimerActive = false;
                this.RaiseMatchStarted();
                break;
            case CommandParser_1.BanchoResponseType.BeganStartTimer:
                this.isStartTimerActive = true;
                break;
            case CommandParser_1.BanchoResponseType.AbortedStartTimer:
                this.isStartTimerActive = false;
                break;
            case CommandParser_1.BanchoResponseType.PlayerFinished:
                this.RaisePlayerFinished(c.params[0], c.params[1], c.params[2]);
                break;
            case CommandParser_1.BanchoResponseType.PlayerJoined:
                this.RaisePlayerJoined(c.params[0], c.params[1], c.params[2]);
                break;
            case CommandParser_1.BanchoResponseType.PlayerLeft:
                this.RaisePlayerLeft(c.params[0]);
                break;
            case CommandParser_1.BanchoResponseType.AbortedMatch:
            case CommandParser_1.BanchoResponseType.AbortMatchFailed:
                this.RaiseAbortedMatch();
                break;
            case CommandParser_1.BanchoResponseType.AddedReferee:
                this.GetOrMakePlayer(c.params[0]).setRole(Player_1.Roles.Referee);
                this.logger.trace(`Added a referee: ${c.params[0]}`);
                break;
            case CommandParser_1.BanchoResponseType.RemovedReferee:
                this.GetOrMakePlayer(c.params[0]).removeRole(Player_1.Roles.Referee);
                this.logger.trace(`Removed a referee: ${c.params[0]}`);
                break;
            case CommandParser_1.BanchoResponseType.ListRefs:
                this.listRefStart = Date.now();
                break;
            case CommandParser_1.BanchoResponseType.PlayerMovedSlot:
                this.RaisePlayerMoved(c.params[0], c.params[1]);
                break;
            case CommandParser_1.BanchoResponseType.TeamChanged:
                this.GetOrMakePlayer(c.params[0]).team = c.params[1];
                this.logger.trace(`Team has been changed: ${c.params[0]}, ${Player_1.Teams[c.params[1]]}`);
                break;
            case CommandParser_1.BanchoResponseType.BeatmapChanged:
            case CommandParser_1.BanchoResponseType.MpBeatmapChanged:
                if (this.mapId !== c.params[0]) {
                    this.mapId = c.params[0];
                    this.mapTitle = c.params[1];
                    const changer = this.host ? `by ${c.type === CommandParser_1.BanchoResponseType.BeatmapChanged ? this.host.name : 'Bot'}` : '';
                    this.logger.info(`Beatmap has been changed ${changer}: https://osu.ppy.sh/b/${this.mapId} ${this.mapTitle}`);
                }
                break;
            case CommandParser_1.BanchoResponseType.Settings:
                if (this.settingParser.feedLine(message)) {
                    this.RaiseParsedSettings();
                }
                break;
            case CommandParser_1.BanchoResponseType.Stats:
                if (this.statParser.feedLine(message)) {
                    this.RaiseParsedStat(false);
                }
                break;
            case CommandParser_1.BanchoResponseType.ClearedHost:
                this.logger.info('Cleared the host.');
                this.isClearedHost = true;
                if (this.host) {
                    this.host.removeRole(Player_1.Roles.Host);
                }
                this.host = null;
                this.hostPending = null;
                break;
            case CommandParser_1.BanchoResponseType.Unhandled:
                if (this.checkListRef(message))
                    break;
                this.logger.debug(`Detected an unhandled bancho response:\n${message}`);
                break;
        }
        this.ReceivedBanchoResponse.emit({ message, response: c });
    }
    checkListRef(message) {
        if (this.listRefStart !== 0) {
            if (Date.now() < this.listRefStart + this.option.listref_duration_ms) {
                const p = this.GetOrMakePlayer(message);
                p.setRole(Player_1.Roles.Referee);
                this.logger.trace(`Added a referee: ${p.escaped_name}`);
                return true;
            }
            else {
                this.listRefStart = 0;
                this.logger.trace('Referee list check has ended.');
            }
        }
        return false;
    }
    RaiseReceivedChatCommand(player, message) {
        this.logger.trace(`Executing a command by ${player.name}: ${message}`);
        if (player.isReferee && message.startsWith('!mp'))
            return;
        const { command, param } = CommandParser_1.parser.ParseChatCommand(message);
        if (command === '!info' || command === '!help') {
            this.showInfoMessage();
        }
        if (command === '!version' || command === '!v') {
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
        this.logger.trace(`A slot has been moved. Player: ${username}, Slot: ${slot}`);
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
        this.logger.info('The match has started!');
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
            this.logger.warn(`A player that did not participate finished a match: ${username}`);
            this.LoadMpSettingsAsync();
        }
    }
    RaiseMatchFinished() {
        const count = this.players.size;
        this.logger.info(`The match has finished! (${count} player(s))`);
        this.isMatching = false;
        this.players.forEach(p => p.mpstatus = Player_1.MpStatuses.InLobby);
        this.MatchFinished.emit();
    }
    RaiseAbortedMatch() {
        const sc = this.CountPlayersStatus();
        this.logger.info(`Match has been aborted. (${sc.finished} / ${sc.inGame})`);
        this.isMatching = false;
        this.players.forEach(p => p.mpstatus = Player_1.MpStatuses.InLobby);
        this.AbortedMatch.emit({ playersFinished: sc.finished, playersInGame: sc.inGame });
    }
    RaiseNetError(err) {
        this.logger.error(`@Lobby#raiseNetError\n${err.message}\n${err.stack}`);
        this.NetError.emit(err);
    }
    RaiseJoinedLobby(channel) {
        this.players.clear();
        this.channel = channel;
        this.lobbyId = channel.replace('#mp_', '');
        this.historyRepository.setLobbyId(this.lobbyId);
        this.status = LobbyStatus.Entered;
        this.logger.addContext('channel', this.lobbyId);
        this.chatlogger.addContext('channel', this.lobbyId);
        for (const p of this.plugins) {
            p.logger.addContext('channel', this.lobbyId);
        }
        this.assignCreatorRole();
        this.JoinedLobby.emit({ channel: this.channel, creator: this.GetOrMakePlayer(this.ircClient.nick) });
        this.startInfoMessageAnnouncement();
    }
    RaiseParsedSettings() {
        if (!this.settingParser.isParsing && this.settingParser.result) {
            this.logger.info('Parsed multiplayer settings.');
            const result = this.settingParser.result;
            const r = this.margeMpSettingsResult(result);
            if (r.hostChanged || r.playersIn.length !== 0 || r.playersOut.length !== 0) {
                this.logger.info('Applied multiplayer settings.');
                this.FixedSettings.emit({ result, ...r });
            }
            this.ParsedSettings.emit({ result, ...r });
        }
    }
    RaiseParsedStat(isPm) {
        if (!this.statParser.isParsing && this.statParser.result) {
            const p = this.GetPlayer(this.statParser.result.name);
            if (p) {
                p.laststat = this.statParser.result;
                this.logger.info(`Parsed a player's stat: ${p.name} -> ${StatParser_1.StatStatuses[p.laststat.status]}`);
                this.ParsedStat.emit({ result: this.statParser.result, player: p, isPm });
            }
        }
    }
    /**
     * Notify plugins that the loading operation is complete
     */
    RaisePluginsLoaded() {
        for (const p of this.plugins) {
            p.OnLoaded();
        }
    }
    OnUserNotFound() {
        if (this.hostPending) {
            const p = this.hostPending;
            this.logger.warn(`@Lobby#onUserNotFound\nA user cannot be found: ${p.name}`);
            this.hostPending = null;
        }
    }
    // #endregion
    // #region lobby management
    MakeLobbyAsync(title) {
        if (title === '') {
            throw new Error('The lobby title is empty');
        }
        if (this.status !== LobbyStatus.Standby) {
            throw new Error('A lobby has already been made');
        }
        this.status = LobbyStatus.Making;
        this.logger.trace('Making a lobby...');
        return new Promise(resolve => {
            if (this.ircClient.hostMask !== '') {
                this.makeLobbyAsyncCore(title).then(v => resolve(v));
            }
            else {
                this.logger.trace('Waiting for registration...');
                this.ircClient.once('registered', () => {
                    this.makeLobbyAsyncCore(title).then(v => resolve(v));
                });
            }
        });
    }
    makeLobbyAsyncCore(title) {
        return new Promise((resolve, reject) => {
            this.JoinedLobby.once(a => {
                this.lobbyName = title;
                this.logger.trace('Finished making a lobby.');
                if (this.lobbyId) {
                    resolve(this.lobbyId);
                }
                else {
                    reject('Missing lobby ID');
                }
            });
            const trg = 'BanchoBot';
            const msg = `!mp make ${title}`;
            this.ircClient.say(trg, msg);
            this.ircClient.emit('sentMessage', trg, msg);
        });
    }
    EnterLobbyAsync(channel) {
        this.logger.trace('Entering a lobby...');
        return new Promise((resolve, reject) => {
            const ch = CommandParser_1.parser.EnsureMpChannelId(channel);
            if (ch === '') {
                this.logger.error(`@Lobby#enterLobbyAsync: Invalid channel specified: ${channel}`);
                reject('Invalid channel');
                return;
            }
            const joinhandler = () => {
                this.ircClient.off('error', errhandler);
                this.lobbyName = '__';
                this.logger.trace('Successfully entered the lobby.');
                if (this.lobbyId) {
                    resolve(this.lobbyId);
                }
                else {
                    this.destroy();
                    reject('Missing lobby ID');
                }
            };
            const errhandler = (message) => {
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
        this.logger.trace('Closing the lobby...');
        if (this.status !== LobbyStatus.Entered) {
            this.logger.error('@Lobby#closeLobbyAsync: Invalid lobby status.');
            throw new Error('No lobby to close');
        }
        return new Promise((resolve, reject) => {
            this.ircClient.once('part', (channel, nick) => {
                resolve();
            });
            if (this.channel !== undefined) {
                this.SendMessage('!mp close');
                this.status = LobbyStatus.Leaving;
            }
            else {
                reject();
            }
        });
    }
    QuitLobbyAsync() {
        this.logger.trace('Quiting the lobby...');
        if (this.status !== LobbyStatus.Entered) {
            this.logger.error('@Lobby#quitLobbyAsync: Invalid lobby status.');
            throw new Error('No lobby to close');
        }
        return new Promise((resolve, reject) => {
            this.ircClient.once('part', (channel, nick) => {
                resolve();
            });
            if (this.channel) {
                this.ircClient.part(this.channel, 'part', () => { });
                this.status = LobbyStatus.Leaving;
            }
            else {
                reject();
            }
        });
    }
    LoadMpSettingsAsync() {
        if (this.status !== LobbyStatus.Entered) {
            return Promise.reject('@loadMpSettingsAsync: Invalid lobby status');
        }
        if (this.SendMessageWithCoolTime('!mp settings', 'mpsettings', 15000)) {
            this.logger.trace('Loading multiplayer settings...');
            const p = new Promise(resolve => {
                this.FixedSettings.once(() => {
                    this.SendMessage('!mp listrefs');
                    this.logger.trace('Successfully loaded multiplayer settings.');
                    resolve();
                });
            });
            return p;
        }
        else {
            this.logger.trace('Multiplayer settings loading process has been skipped due to cooltime.');
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
            if (this.players.size > 16) {
                this.logger.warn(`A player has joined the lobby with more than 16 players: ${player.name}`);
                this.UnexpectedAction.emit(new Error('A player has joined the lobby with more than 16 players'));
                return false;
            }
            return true;
        }
        else {
            this.logger.warn(`A player inside the lobby has joined for the second time: ${player.name}`);
            this.UnexpectedAction.emit(new Error('A player inside the lobby has joined for the second time'));
            return false;
        }
    }
    removePlayer(player) {
        player.removeRole(Player_1.Roles.Player);
        player.removeRole(Player_1.Roles.Host);
        player.mpstatus = Player_1.MpStatuses.None;
        if (this.players.has(player)) {
            this.players.delete(player);
            if (this.host === player) {
                this.host = null;
            }
            if (this.hostPending === player) {
                this.logger.warn(`A pending user has left: ${player.name}`);
                this.hostPending = null;
            }
            return true;
        }
        else {
            this.logger.warn(`A player outside the lobby has left: ${player.name}`);
            this.UnexpectedAction.emit(new Error('A player outside the lobby has left'));
            return false;
        }
    }
    setAsHost(player) {
        if (!this.players.has(player)) {
            this.transferHostTimeout.cancel();
            this.logger.warn(`A player outside the lobby became a host: ${player.name}`);
            return false;
        }
        if (this.hostPending === player) {
            this.transferHostTimeout.cancel();
            this.hostPending = null;
        }
        else if (this.hostPending !== null) {
            this.logger.warn(`Another player became host during host assignment. Pending: ${this.hostPending.name}, Host: ${player.name}`);
        } // pending === null means Manual changes
        if (this.host) {
            this.host.removeRole(Player_1.Roles.Host);
        }
        this.host = player;
        player.setRole(Player_1.Roles.Host);
        return true;
    }
    /**
     * Import MpSettings result. no join/left/changehost occurences
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
        for (const p of this.players) {
            if (!mpPlayers.includes(p)) {
                const slot = p.slot;
                this.removePlayer(p);
                playersOut.push(p);
                this.PlayerLeft.emit({ player: p, fromMpSettings: true, slot });
            }
        }
        for (const r of result.players) {
            const p = this.GetOrMakePlayer(r.name);
            if (!this.players.has(p)) {
                this.addPlayer(p, r.slot, r.team);
                playersIn.push(p);
                this.PlayerJoined.emit({ player: p, slot: p.slot, team: p.team, fromMpSettings: true });
            }
            else {
                p.slot = r.slot;
                p.team = r.team;
            }
            if (r.isHost && p !== this.host) {
                this.setAsHost(p);
                hostChanged = true;
            }
        }
        return { playersIn, playersOut, hostChanged };
    }
    // #endregion
    GetLobbyStatus() {
        const pc = this.CountPlayersStatus();
        let s = `
=== Lobby Status ===
  Lobby ID: ${this.lobbyId}
  Lobby name: ${this.lobbyName}
  Lobby status: ${LobbyStatus[this.status]}
  Player(s): ${this.players.size} (In-game: ${pc.inGame}, Playing: ${pc.playing})
  Referee(s): ${Array.from(this.playersMap.values()).filter(v => v.isReferee).map(v => v.name).join(',')}
  Timer: ${this.isStartTimerActive}
  Cleared host: ${this.isClearedHost}
  Host: ${this.host ? this.host.name : 'Null'}
  Pending host: ${this.hostPending ? this.hostPending.name : 'Null'}`;
        for (const p of this.plugins) {
            const ps = p.GetPluginStatus();
            if (ps !== '') {
                s += `\n${ps}`;
            }
        }
        return s;
    }
    showInfoMessage() {
        this.SendMessageWithCoolTime(this.getInfoMessage(), 'infomessage', this.option.info_message_cooltime_ms);
    }
    showVersionMessage() {
        const version = this.tryGetVersion();
        this.SendMessageWithCoolTime(`osu! Auto Host Rotation Bot v. ${version}`, 'versionmessage', this.option.info_message_cooltime_ms);
    }
    sendInfoMessagePM(player) {
        this.SendPrivateMessageWithCoolTime(this.getInfoMessage(), player.escaped_name, 'infomessage', this.option.info_message_cooltime_ms);
    }
    getInfoMessage() {
        const version = this.tryGetVersion();
        return this.option.info_message.replace('${version}', version);
    }
    tryGetVersion() {
        if (process.env.npm_package_version)
            return process.env.npm_package_version;
        try {
            return require('../package.json').version ?? '0.0.0';
        }
        catch {
            return '0.0.0';
        }
    }
    // Grant privileges to the owner
    assignCreatorRole() {
        if (!this.ircClient.nick) {
            this.ircClient.once('registered', () => {
                this.assignCreatorRole();
            });
        }
        else {
            const c = this.GetOrMakePlayer(this.ircClient.nick);
            c.setRole(Player_1.Roles.Authorized);
            c.setRole(Player_1.Roles.Referee);
            c.setRole(Player_1.Roles.Creator);
            this.logger.info(`Assigned creators role to ${this.ircClient.nick}`);
        }
    }
    startInfoMessageAnnouncement() {
        // ensure time is stop
        this.stopInfoMessageAnnouncement();
        if (this.option.info_message_announcement_interval_ms > 3 * 60 * 1000) {
            this.logger.trace(`Started info message announcement timer. Interval: ${this.option.info_message_announcement_interval_ms}`);
            this.infoMessageAnnouncementTimeId = setInterval(() => {
                this.showInfoMessage();
                if (this.status !== LobbyStatus.Entered) {
                    this.stopInfoMessageAnnouncement();
                }
            }, this.option.info_message_announcement_interval_ms);
        }
    }
    stopInfoMessageAnnouncement() {
        if (this.infoMessageAnnouncementTimeId !== null) {
            this.logger.trace('Stopped the info message announcement.');
            clearInterval(this.infoMessageAnnouncementTimeId);
            this.infoMessageAnnouncementTimeId = null;
        }
    }
}
exports.Lobby = Lobby;
//# sourceMappingURL=Lobby.js.map
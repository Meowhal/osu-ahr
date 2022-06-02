import { Player, escapeUserName, Roles, Teams, MpStatuses } from './Player';
import { parser, BanchoResponseType, BanchoResponse } from './parsers/CommandParser';
import { StatResult, StatParser, IsStatResponse, StatStatuses } from './parsers/StatParser';
import { IIrcClient } from './IIrcClient';
import { TypedEvent } from './libs/TypedEvent';
import { DeferredAction } from './libs/DeferredAction';
import { MpSettingsParser, MpSettingsResult } from './parsers/MpSettingsParser';
import { LobbyPlugin } from './plugins/LobbyPlugin';
import { HistoryRepository } from './webapi/HistoryRepository';
import { PlayMode } from './Modes';
import { getConfig } from './TypedConfig';
import { getLogger, Logger } from './Loggers';

export enum LobbyStatus {
  Standby,
  Making,
  Made,
  Entering,
  Entered,
  Leaving,
  Left
}

export interface LobbyOption {
  authorized_users: string[],
  listref_duration_ms: number,
  info_message: string,
  info_message_cooltime_ms: number,
  stat_timeout_ms: number,
  info_message_announcement_interval_ms: number,
  transferhost_timeout_ms: number
}

export class Lobby {
  // Members
  option: LobbyOption;
  ircClient: IIrcClient;
  lobbyName: string | undefined;
  lobbyId: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  mapTitle: string = '';
  mapId: number = 0;
  host: Player | null = null;
  hostPending: Player | null = null;
  players: Set<Player> = new Set<Player>();
  playersMap: Map<string, Player> = new Map<string, Player>();
  isMatching: boolean = false;
  isStartTimerActive: boolean = false;
  isClearedHost: boolean = false;
  listRefStart: number = 0;
  plugins: LobbyPlugin[] = [];
  coolTimes: { [key: string]: number } = {};
  deferredMessages: { [key: string]: DeferredAction<string> } = {};
  settingParser: MpSettingsParser;
  statParser: StatParser;
  logger: Logger;
  chatlogger: Logger;
  historyRepository: HistoryRepository;
  infoMessageAnnouncementTimeId: NodeJS.Timeout | null = null;
  transferHostTimeout: DeferredAction<void>;
  gameMode: PlayMode | undefined;

  // Events
  JoinedLobby = new TypedEvent<{ channel: string, creator: Player }>();
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; team: Teams; fromMpSettings: boolean; }>();
  PlayerLeft = new TypedEvent<{ player: Player, slot: number, fromMpSettings: boolean }>();
  PlayerMoved = new TypedEvent<{ player: Player, from: number, to: number }>();
  HostChanged = new TypedEvent<{ player: Player }>();
  MatchStarted = new TypedEvent<{ mapId: number, mapTitle: string }>();
  PlayerFinished = new TypedEvent<{ player: Player, score: number, isPassed: boolean, playersFinished: number, playersInGame: number }>();
  MatchFinished = new TypedEvent<void>();
  AbortedMatch = new TypedEvent<{ playersFinished: number, playersInGame: number }>();
  UnexpectedAction = new TypedEvent<Error>();
  NetError = new TypedEvent<Error>();
  PlayerChated = new TypedEvent<{ player: Player, message: string }>();
  ReceivedChatCommand = new TypedEvent<{ player: Player, command: string, param: string }>();
  PluginMessage = new TypedEvent<{ type: string, args: string[], src: LobbyPlugin | null }>();
  SentMessage = new TypedEvent<{ message: string }>();
  ReceivedBanchoResponse = new TypedEvent<{ message: string, response: BanchoResponse }>();
  ParsedStat = new TypedEvent<{ result: StatResult, player: Player, isPm: boolean }>();
  FixedSettings = new TypedEvent<{ result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean }>();
  ParsedSettings = new TypedEvent<{ result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean }>();
  LeftChannel = new TypedEvent<void>();
  events: { [eventtype: string]: any } = {};

  constructor(ircClient: IIrcClient, option: Partial<LobbyOption> = {}) {
    if (!ircClient.conn) {
      throw new Error('Client is not connected');
    }
    this.option = getConfig('Lobby', option) as LobbyOption;
    this.status = LobbyStatus.Standby;
    this.settingParser = new MpSettingsParser();
    this.statParser = new StatParser();

    this.ircClient = ircClient;
    this.logger = getLogger('lobby');
    this.chatlogger = getLogger('chat');
    this.historyRepository = new HistoryRepository(0);
    this.transferHostTimeout = new DeferredAction(() => this.onTimeoutedTransferHost());
    this.registerEvents();
  }

  private registerEvents(): void {
    this.events = {
      message: (from: any, to: any, message: any) => {
        if (to === this.channel) {
          this.handleMessage(from, to, message);
        }
      },
      action: (from: any, to: any, message: any) => {
        if (to === this.channel) {
          this.handleAction(from, to, message);
        }
      },
      netError: (err: any) => {
        this.RaiseNetError(err);
      },
      registered: async () => {
        if (this.status === LobbyStatus.Entered && this.channel) {
          this.logger.warn('Detected a network reconnection! Loading multiplayer settings...');
          await this.LoadMpSettingsAsync();
        }
      },
      pm: (nick: any, message: any) => {
        this.handlePrivateMessage(nick, message);
      },
      kick: (channel: any, who: any, by: any, reason: any) => {
        this.logger.info(`${who} was kicked from ${channel} by ${by}: ${reason}`);
      },
      part: (channel: string, nick: string) => {
        if (channel === this.channel) {
          this.stopInfoMessageAnnouncement();
          this.CancelAllDeferredMessages();
          this.historyRepository.lobbyClosed = true;

          this.logger.info('Detected a part event. Destroying the lobby...');
          this.status = LobbyStatus.Left;
          this.destroy();
        }
      },
      selfMessage: (target: string, toSend: any) => {
        if (target === this.channel) {
          const r = toSend.replace(/\[http\S+\s([^\]]+)\]/g, '[http... $1]');
          this.chatlogger.info(`Bot: ${r}`);
        }
      }
    };

    for (const key in this.events) {
      this.ircClient.on(key, this.events[key]);
    }

    this.events.join = (channel: string, who: string) => {
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

  private removeEvents() {
    for (const key in this.events) {
      this.ircClient.off(key, this.events[key] as any);
    }
  }

  /**
   * Count the number of people who finished the match.
   */
  get playersFinished(): number {
    let i = 0;
    for (const p of this.players) {
      if (p.mpstatus === MpStatuses.Finished) i++;
    }
    return i;
  }

  /**
   * Count the number of people in the match.
   */
  get playersInGame(): number {
    let i = 0;
    for (const p of this.players) {
      if (p.mpstatus === MpStatuses.Finished || p.mpstatus === MpStatuses.Playing) i++;
    }
    return i;
  }

  /**
   * Count the number of players in each situation.
   */
  CountPlayersStatus(): { inGame: number, playing: number, finished: number, inlobby: number, total: number } {
    const r = { inGame: 0, playing: 0, finished: 0, inlobby: 0, total: this.players.size };
    for (const p of this.players) {
      switch (p.mpstatus) {
        case MpStatuses.InLobby:
          r.inlobby++;
          break;
        case MpStatuses.Playing:
          r.playing++;
          break;
        case MpStatuses.Finished:
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
  GetOrMakePlayer(username: string): Player {
    const ename = escapeUserName(username);
    if (this.playersMap.has(ename)) {
      return this.playersMap.get(ename) as Player;
    } else {
      const nu = new Player(username);
      this.playersMap.set(ename, nu);
      if (this.option.authorized_users.includes(username)) {
        nu.setRole(Roles.Authorized);
      }
      return nu;
    }
  }

  /**
   * Get a player object from username
   * Return null if the player has not been created yet
   * @param username
   */
  GetPlayer(username: string): Player | null {
    const ename = escapeUserName(username);
    if (this.playersMap.has(ename)) {
      return this.playersMap.get(ename) as Player;
    } else {
      return null;
    }
  }

  // Check if the player is participating in the Lobby
  Includes(username: string): boolean {
    const ename = escapeUserName(username);
    const p = this.playersMap.get(ename);
    if (p === undefined) return false;
    return this.players.has(p);
  }

  TransferHostAsync(user: Player): Promise<void> {
    this.hostPending = user;
    return new Promise((resolve, reject) => {

      const d1 = this.HostChanged.on((a: { player: Player }) => {
        dispose();
        if (a.player === user) {
          resolve();
        } else {
          reject('Another player became a host');
        }
      });

      const d2 = this.PlayerLeft.on((a: { player: Player }) => {
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

  TransferHost(user: Player): void {
    this.transferHostTimeout.cancel();

    this.hostPending = user;
    this.transferHostTimeout.start(this.option.transferhost_timeout_ms);
    if (user.id !== 0) {
      this.SendMessage(`!mp host #${user.id}`);
    } else {
      this.SendMessage(`!mp host ${user.name}`);
    }
  }

  onTimeoutedTransferHost(): void {
    this.logger.warn('!mp host timeout');
    if (this.hostPending) {
      if (this.players.has(this.hostPending)) {
        this.LoadMpSettingsAsync();
      }
      this.hostPending = null;
    }
  }

  AbortMatch(): void {
    if (this.isMatching) {
      this.SendMessage('!mp abort');
    }
  }

  SendMessage(message: string): void {
    if (this.channel) {
      this.ircClient.say(this.channel, message);
      this.ircClient.emit('sentMessage', this.channel, message);
      this.SentMessage.emit({ message });
      //this.chatlogger.trace(`bot:${message}`);
    }
  }

  SendPrivateMessage(message: string, target: string): void {
    this.ircClient.say(target, message);
    this.ircClient.emit('sentPrivateMessage', target, message);
    this.SentMessage.emit({ message });
    this.chatlogger.info(`Bot -> ${target}: ${message}`);
  }

  SendMessageWithCoolTime(message: string | (() => string), tag: string, cooltimeMs: number): boolean {
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

  SendPrivateMessageWithCoolTime(message: string | (() => string), target: string, tag: string, cooltimeMs: number): boolean {
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

  SendMessageWithDelayAsync(message: string, delay: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.SendMessage(message);
        resolve();
      }, delay);
    });
  }

  DeferMessage(message: string, tag: string, delayMs: number, resetTimer: boolean = false): void {
    if (message === '') {
      this.CancelDeferredMessage(tag);
      return;
    }
    if (!(tag in this.deferredMessages)) {
      this.deferredMessages[tag] = new DeferredAction(msg => {
        this.SendMessage(msg);
      });
    }
    this.deferredMessages[tag].start(delayMs, message, resetTimer);
  }

  CancelDeferredMessage(tag: string): void {
    if (tag in this.deferredMessages) {
      this.deferredMessages[tag].cancel();
    }
  }

  CancelAllDeferredMessages(): void {
    for (const tag in this.deferredMessages) {
      this.deferredMessages[tag].cancel();
    }
  }

  async RequestStatAsync(player: Player, byPm: boolean, timeout: number = this.option.stat_timeout_ms): Promise<StatResult> {
    return new Promise<StatResult>((resolve, reject) => {
      const tm = setTimeout(() => {
        reject('Stat request has timed out');
      }, timeout);
      const d = this.ParsedStat.on(({ result }) => {
        if (escapeUserName(result.name) === player.escaped_name) {
          clearTimeout(tm);
          d.dispose();
          resolve(result);
        }
      });
      this.ircClient.say(byPm || !this.channel ? 'BanchoBot' : this.channel, `!stat ${player.escaped_name}`);
    });
  }

  async SendMultilineMessageWithInterval(lines: string[], intervalMs: number, tag: string, cooltimeMs: number): Promise<void> {
    if (lines.length === 0) return;
    const totalTime = lines.length * intervalMs + cooltimeMs;
    if (this.SendMessageWithCoolTime(lines[0], tag, totalTime)) {
      for (let i = 1; i < lines.length; i++) {
        await this.SendMessageWithDelayAsync(lines[i], intervalMs);
      }
    }
  }

  // #region message handling

  private handleMessage(from: string, to: string, message: string): void {
    if (from === 'BanchoBot') {
      this.handleBanchoResponse(message);
    } else {
      const p = this.GetPlayer(from);
      if (p) {
        if (parser.IsChatCommand(message)) {
          this.RaiseReceivedChatCommand(p, message);
        }
        this.PlayerChated.emit({ player: p, message });
        if (IsStatResponse(message)) {
          this.chatlogger.trace(`${p.name}:${message}`);
        } else {
          this.chatlogger.info(`${p.name}:${message}`);
        }
      }
    }
  }

  private handleAction(from: string, to: string, message: string): void {
    this.chatlogger.info(`*${from}:${message}`);
  }

  private handlePrivateMessage(from: string, message: string): void {
    if (from === 'BanchoBot') {
      if (IsStatResponse(message)) {
        if (this.statParser.feedLine(message)) {
          this.RaiseParsedStat(true);
        }
      }
    } else {
      const user = this.GetPlayer(from);
      if (!user) return;
      if ((message === '!info' || message === '!help') && this.players.has(user)) {
        this.sendInfoMessagePM(user);
      }
    }
  }

  private handleBanchoResponse(message: string): void {
    const c = parser.ParseBanchoResponse(message);
    switch (c.type) {
      case BanchoResponseType.HostChanged:
        this.RaiseHostChanged(c.params[0]);
        this.isClearedHost = false;
        break;
      case BanchoResponseType.UserNotFound:
        this.OnUserNotFound();
        break;
      case BanchoResponseType.MatchFinished:
        this.RaiseMatchFinished();
        break;
      case BanchoResponseType.MatchStarted:
        this.isStartTimerActive = false;
        this.RaiseMatchStarted();
        break;
      case BanchoResponseType.BeganStartTimer:
        this.isStartTimerActive = true;
        break;
      case BanchoResponseType.AbortedStartTimer:
        this.isStartTimerActive = false;
        break;
      case BanchoResponseType.PlayerFinished:
        this.RaisePlayerFinished(c.params[0], c.params[1], c.params[2]);
        break;
      case BanchoResponseType.PlayerJoined:
        this.RaisePlayerJoined(c.params[0], c.params[1], c.params[2]);
        break;
      case BanchoResponseType.PlayerLeft:
        this.RaisePlayerLeft(c.params[0] as string);
        break;
      case BanchoResponseType.AbortedMatch:
      case BanchoResponseType.AbortMatchFailed:
        this.RaiseAbortedMatch();
        break;
      case BanchoResponseType.AddedReferee:
        this.GetOrMakePlayer(c.params[0]).setRole(Roles.Referee);
        this.logger.trace(`Added a referee: ${c.params[0]}`);
        break;
      case BanchoResponseType.RemovedReferee:
        this.GetOrMakePlayer(c.params[0]).removeRole(Roles.Referee);
        this.logger.trace(`Removed a referee: ${c.params[0]}`);
        break;
      case BanchoResponseType.ListRefs:
        this.listRefStart = Date.now();
        break;
      case BanchoResponseType.PlayerMovedSlot:
        this.RaisePlayerMoved(c.params[0], c.params[1]);
        break;
      case BanchoResponseType.TeamChanged:
        this.GetOrMakePlayer(c.params[0]).team = c.params[1];
        this.logger.trace(`Team has been changed: ${c.params[0]}, ${Teams[c.params[1]]}`);
        break;
      case BanchoResponseType.BeatmapChanged:
      case BanchoResponseType.MpBeatmapChanged:
        if (this.mapId !== c.params[0]) {
          this.mapId = c.params[0];
          this.mapTitle = c.params[1];
          const changer = this.host ? `by ${c.type === BanchoResponseType.BeatmapChanged ? this.host.name : 'Bot'}` : '';
          this.logger.info(`Beatmap has been changed ${changer}: https://osu.ppy.sh/b/${this.mapId} ${this.mapTitle}`);
        }
        break;
      case BanchoResponseType.Settings:
        if (this.settingParser.feedLine(message)) {
          this.RaiseParsedSettings();
        }
        break;
      case BanchoResponseType.Stats:
        if (this.statParser.feedLine(message)) {
          this.RaiseParsedStat(false);
        }
        break;
      case BanchoResponseType.ClearedHost:
        this.logger.info('Cleared the host.');
        this.isClearedHost = true;
        if (this.host) {
          this.host.removeRole(Roles.Host);
        }
        this.host = null;
        this.hostPending = null;
        break;
      case BanchoResponseType.Unhandled:
        if (this.checkListRef(message)) break;
        this.logger.debug(`Detected an unhandled bancho response:\n${message}`);
        break;
    }
    this.ReceivedBanchoResponse.emit({ message, response: c });
  }

  private checkListRef(message: string): boolean {
    if (this.listRefStart !== 0) {
      if (Date.now() < this.listRefStart + this.option.listref_duration_ms) {
        const p = this.GetOrMakePlayer(message);
        p.setRole(Roles.Referee);
        this.logger.trace(`Added a referee: ${p.escaped_name}`);
        return true;
      } else {
        this.listRefStart = 0;
        this.logger.trace('Referee list check has ended.');
      }
    }
    return false;
  }

  RaiseReceivedChatCommand(player: Player, message: string): void {
    this.logger.trace(`Executing a command by ${player.name}: ${message}`);
    if (player.isReferee && message.startsWith('!mp')) return;
    const { command, param } = parser.ParseChatCommand(message);
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

  RaisePlayerJoined(username: string, slot: number, team: Teams, asHost: boolean = false): void {
    const player = this.GetOrMakePlayer(username);
    if (this.addPlayer(player, slot, team)) {
      this.PlayerJoined.emit({ player, slot, team, fromMpSettings: false });
    } else {
      this.LoadMpSettingsAsync();
    }
  }

  RaisePlayerLeft(username: string): void {
    const player = this.GetOrMakePlayer(username);
    const slot = player.slot;
    if (this.removePlayer(player)) {
      this.PlayerLeft.emit({ player, fromMpSettings: false, slot });
    } else {
      this.LoadMpSettingsAsync();
    }
  }

  RaisePlayerMoved(username: string, slot: number): void {
    const player = this.GetOrMakePlayer(username);
    const from = player.slot;
    player.slot = slot;

    this.logger.trace(`A slot has been moved. Player: ${username}, Slot: ${slot}`);
    this.PlayerMoved.emit({ player, from, to: slot });
  }

  RaiseHostChanged(username: string): void {
    const player = this.GetOrMakePlayer(username);
    if (this.setAsHost(player)) {
      this.HostChanged.emit({ player });
    } else {
      this.LoadMpSettingsAsync();
    }
  }

  RaiseMatchStarted(): void {
    this.logger.info('The match has started!');
    this.isMatching = true;
    this.players.forEach(p => p.mpstatus = MpStatuses.Playing);
    this.MatchStarted.emit({ mapId: this.mapId, mapTitle: this.mapTitle });
  }

  RaisePlayerFinished(username: string, score: number, isPassed: boolean): void {
    const player = this.GetOrMakePlayer(username);
    player.mpstatus = MpStatuses.Finished;
    const sc = this.CountPlayersStatus();
    this.PlayerFinished.emit({ player, score, isPassed, playersFinished: sc.finished, playersInGame: sc.inGame });
    if (!this.players.has(player)) {
      this.logger.warn(`A player that did not participate finished a match: ${username}`);
      this.LoadMpSettingsAsync();
    }
  }

  RaiseMatchFinished(): void {
    const count = this.players.size;
    this.logger.info(`The match has finished! (${count} player(s))`);
    this.isMatching = false;
    this.players.forEach(p => p.mpstatus = MpStatuses.InLobby);
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch(): void {
    const sc = this.CountPlayersStatus();
    this.logger.info(`Match has been aborted. (${sc.finished} / ${sc.inGame})`);
    this.isMatching = false;
    this.players.forEach(p => p.mpstatus = MpStatuses.InLobby);
    this.AbortedMatch.emit({ playersFinished: sc.finished, playersInGame: sc.inGame });
  }

  RaiseNetError(err: Error): void {
    this.logger.error(`@Lobby#raiseNetError\n${err.message}\n${err.stack}`);
    this.NetError.emit(err);
  }

  RaiseJoinedLobby(channel: string): void {
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

  RaiseParsedSettings(): void {
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

  RaiseParsedStat(isPm: boolean): void {
    if (!this.statParser.isParsing && this.statParser.result) {
      const p = this.GetPlayer(this.statParser.result.name);
      if (p) {
        p.laststat = this.statParser.result;
        this.logger.info(`Parsed a player's stat: ${p.name} -> ${StatStatuses[p.laststat.status]}`);
        this.ParsedStat.emit({ result: this.statParser.result, player: p, isPm });
      }
    }
  }

  /**
   * Notify plugins that the loading operation is complete
   */
  RaisePluginsLoaded(): void {
    for (const p of this.plugins) {
      p.OnLoaded();
    }
  }

  OnUserNotFound(): void {
    if (this.hostPending) {
      const p = this.hostPending;
      this.logger.warn(`@Lobby#onUserNotFound\nA user cannot be found: ${p.name}`);
      this.hostPending = null;
    }
  }

  // #endregion

  // #region lobby management

  MakeLobbyAsync(title: string): Promise<string> {
    if (title === '') {
      throw new Error('The lobby title is empty');
    }
    if (this.status !== LobbyStatus.Standby) {
      throw new Error('A lobby has already been made');
    }
    this.status = LobbyStatus.Making;
    this.logger.trace('Making a lobby...');
    return new Promise<string>(resolve => {
      if (this.ircClient.hostMask !== '') {
        this.makeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        this.logger.trace('Waiting for registration...');
        this.ircClient.once('registered', () => {
          this.makeLobbyAsyncCore(title).then(v => resolve(v));
        });
      }
    });
  }

  private makeLobbyAsyncCore(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.JoinedLobby.once(a => {
        this.lobbyName = title;
        this.logger.trace('Finished making a lobby.');
        if (this.lobbyId) {
          resolve(this.lobbyId);
        } else {
          reject('Missing lobby ID');
        }

      });
      const trg = 'BanchoBot';
      const msg = `!mp make ${title}`;
      this.ircClient.say(trg, msg);
      this.ircClient.emit('sentMessage', trg, msg);
    });
  }

  EnterLobbyAsync(channel: string): Promise<string> {
    this.logger.trace('Entering a lobby...');
    return new Promise<string>((resolve, reject) => {
      const ch = parser.EnsureMpChannelId(channel);
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
        } else {
          this.destroy();
          reject('Missing lobby ID');
        }
      };
      const errhandler = (message: any) => {
        this.ircClient.off('join', joinhandler);
        this.destroy();
        reject(`${message.args[2]}`);
      };
      this.ircClient.once('error', errhandler);
      this.ircClient.once('join', joinhandler);
      this.ircClient.join(ch);
    });
  }

  CloseLobbyAsync(): Promise<void> {
    this.logger.trace('Closing the lobby...');
    if (this.status !== LobbyStatus.Entered) {
      this.logger.error('@Lobby#closeLobbyAsync: Invalid lobby status.');
      throw new Error('No lobby to close');
    }
    return new Promise<void>((resolve, reject) => {
      this.ircClient.once('part', (channel: string, nick: string) => {
        resolve();
      });
      if (this.channel !== undefined) {
        this.SendMessage('!mp close');
        this.status = LobbyStatus.Leaving;
      } else {
        reject();
      }
    });
  }

  QuitLobbyAsync(): Promise<void> {
    this.logger.trace('Quiting the lobby...');
    if (this.status !== LobbyStatus.Entered) {
      this.logger.error('@Lobby#quitLobbyAsync: Invalid lobby status.');
      throw new Error('No lobby to close');
    }
    return new Promise<void>((resolve, reject) => {
      this.ircClient.once('part', (channel: string, nick: string) => {
        resolve();
      });
      if (this.channel) {
        this.ircClient.part(this.channel, 'part', () => { /* do nothing. */ });
        this.status = LobbyStatus.Leaving;
      } else {
        reject();
      }
    });
  }

  LoadMpSettingsAsync(): Promise<void> {
    if (this.status !== LobbyStatus.Entered) {
      return Promise.reject('@loadMpSettingsAsync: Invalid lobby status');
    }
    if (this.SendMessageWithCoolTime('!mp settings', 'mpsettings', 15000)) {
      this.logger.trace('Loading multiplayer settings...');
      const p = new Promise<void>(resolve => {
        this.FixedSettings.once(() => {
          this.SendMessage('!mp listrefs');
          this.logger.trace('Successfully loaded multiplayer settings.');
          resolve();
        });
      });
      return p;
    } else {
      this.logger.trace('Multiplayer settings loading process has been skipped due to cooltime.');
      return Promise.resolve();
    }
  }

  private addPlayer(player: Player, slot: number, team: Teams, asHost: boolean = false): boolean {
    player.setRole(Roles.Player);
    player.slot = slot;
    player.team = team;
    player.mpstatus = MpStatuses.InLobby;

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
    } else {
      this.logger.warn(`A player inside the lobby has joined for the second time: ${player.name}`);
      this.UnexpectedAction.emit(new Error('A player inside the lobby has joined for the second time'));
      return false;
    }
  }

  private removePlayer(player: Player): boolean {
    player.removeRole(Roles.Player);
    player.removeRole(Roles.Host);
    player.mpstatus = MpStatuses.None;

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
    } else {
      this.logger.warn(`A player outside the lobby has left: ${player.name}`);
      this.UnexpectedAction.emit(new Error('A player outside the lobby has left'));
      return false;
    }
  }

  private setAsHost(player: Player): boolean {
    if (!this.players.has(player)) {
      this.transferHostTimeout.cancel();
      this.logger.warn(`A player outside the lobby became a host: ${player.name}`);
      return false;
    }

    if (this.hostPending === player) {
      this.transferHostTimeout.cancel();
      this.hostPending = null;
    } else if (this.hostPending !== null) {
      this.logger.warn(`Another player became host during host assignment. Pending: ${this.hostPending.name}, Host: ${player.name}`);
    } // pending === null means Manual changes

    if (this.host) {
      this.host.removeRole(Roles.Host);
    }
    this.host = player;
    player.setRole(Roles.Host);
    return true;
  }

  /**
   * Import MpSettings result. no join/left/changehost occurences
   * @param result
   */
  private margeMpSettingsResult(result: MpSettingsResult): { playersIn: Player[], playersOut: Player[], hostChanged: boolean } {
    this.lobbyName = result.name;
    this.mapId = result.beatmapId;
    this.mapTitle = result.beatmapTitle;

    const mpPlayers = result.players.map(r => this.GetOrMakePlayer(r.name));
    const playersIn: Player[] = [];
    const playersOut: Player[] = [];
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
      } else {
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

  GetLobbyStatus(): string {
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
  Pending host: ${this.hostPending ? this.hostPending.name : 'Null'}`
      ;

    for (const p of this.plugins) {
      const ps = p.GetPluginStatus();
      if (ps !== '') {
        s += `\n${ps}`;
      }
    }
    return s;
  }

  private showInfoMessage(): void {
    this.SendMessageWithCoolTime(this.getInfoMessage(), 'infomessage', this.option.info_message_cooltime_ms);
  }

  private showVersionMessage(): void {
    const version = this.tryGetVersion();
    this.SendMessageWithCoolTime(`osu! Auto Host Rotation Bot v. ${version}`, 'versionmessage', this.option.info_message_cooltime_ms);
  }

  private sendInfoMessagePM(player: Player): void {
    this.SendPrivateMessageWithCoolTime(this.getInfoMessage(), player.escaped_name, 'infomessage', this.option.info_message_cooltime_ms);
  }

  private getInfoMessage(): string {
    const version = this.tryGetVersion();
    return this.option.info_message.replace('${version}', version);
  }

  private tryGetVersion(): string {
    if (process.env.npm_package_version) return process.env.npm_package_version;
    try {
      return require('../package.json').version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  // Grant privileges to the owner
  private assignCreatorRole(): void {
    if (!this.ircClient.nick) {
      this.ircClient.once('registered', () => {
        this.assignCreatorRole();
      });
    } else {
      const c = this.GetOrMakePlayer(this.ircClient.nick);
      c.setRole(Roles.Authorized);
      c.setRole(Roles.Referee);
      c.setRole(Roles.Creator);
      this.logger.info(`Assigned creators role to ${this.ircClient.nick}`);
    }
  }

  private startInfoMessageAnnouncement(): void {
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

  private stopInfoMessageAnnouncement(): void {
    if (this.infoMessageAnnouncementTimeId !== null) {
      this.logger.trace('Stopped the info message announcement.');
      clearInterval(this.infoMessageAnnouncementTimeId);
      this.infoMessageAnnouncementTimeId = null;
    }
  }
}

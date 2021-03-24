import { Player, escapeUserName, Roles, Teams, MpStatuses } from "./Player";
import { parser, BanchoResponseType, BanchoResponse, StatResult, StatParser, IsStatResponse, StatStatuses } from "./parsers";
import { IIrcClient } from "./IIrcClient";
import { TypedEvent, DeferredAction } from "./libs";
import { MpSettingsParser, MpSettingsResult } from "./parsers/MpSettingsParser";
import { LobbyPlugin } from "./plugins/LobbyPlugin";
import { HistoryRepository } from "./webapi/HistoryRepository";
import config from "config";
import log4js from "log4js";
import pkg from "../package.json";

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
  authorized_users: string[], // 特権ユーザー
  listref_duration_ms: number,
  info_message: string[],
  info_message_cooltime_ms: number,
  stat_timeout_ms: number,
  info_message_announcement_interval_ms: number,
  transferhost_timeout_ms: number
}

const LobbyDefaultOption = config.get<LobbyOption>("Lobby");

export class Lobby {
  // Members
  option: LobbyOption;
  ircClient: IIrcClient;
  lobbyName: string | undefined;
  lobbyId: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  mapTitle: string = "";
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
  deferredMessages: { [key: string]: DeferredAction<string> } = {}
  settingParser: MpSettingsParser;
  statParser: StatParser;
  logger: log4js.Logger;
  chatlogger: log4js.Logger;
  historyRepository: HistoryRepository;
  infoMessageAnnouncementTimeId: NodeJS.Timeout | null = null;
  transferHostTimeout: DeferredAction<void>;

  // Events
  JoinedLobby = new TypedEvent<{ channel: string, creator: Player }>();
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; team: Teams; }>();
  PlayerLeft = new TypedEvent<{ player: Player }>();
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
  ParsedSettings = new TypedEvent<{ result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean }>();
  Disconnected = new TypedEvent<void>();

  constructor(ircClient: IIrcClient, option: Partial<LobbyOption> = {}) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }
    this.option = { ...LobbyDefaultOption, ...option } as LobbyOption;
    this.status = LobbyStatus.Standby;
    this.settingParser = new MpSettingsParser();
    this.statParser = new StatParser();

    this.ircClient = ircClient;
    this.logger = log4js.getLogger("lobby");
    this.logger.addContext("channel", "lobby");
    this.chatlogger = log4js.getLogger("chat");
    this.chatlogger.addContext("channel", "lobby");
    this.historyRepository = new HistoryRepository(0);
    this.transferHostTimeout = new DeferredAction(() => this.onTimeoutedTransferHost());
    this.registerEvents();
  }

  private registerEvents(): void {
    const onjoin = (channel: string, who: string) => {
      this.logger.trace("raised join event");
      if (who == this.ircClient.nick && this.status != LobbyStatus.Entered) {
        this.RaiseJoinedLobby(channel);
      }
    };
    this.ircClient.once("join", onjoin);
    this.ircClient.on("message", (from, to, message) => {
      if (to == this.channel) {
        this.handleMessage(from, to, message);
      }
    });
    this.ircClient.on("action", (from, to, message) => {
      if (to == this.channel) {
        this.handleAction(from, to, message);
      }
    });
    this.ircClient.on("netError", (err: any) => {
      this.RaiseNetError(err);
    });
    this.ircClient.on("registered", async () => {
      if (this.status == LobbyStatus.Entered && this.channel) {
        this.logger.warn("network reconnection detected!");
        await this.LoadMpSettingsAsync();
      }
    });
    this.ircClient.once("part", (channel: string, nick: string) => {
      this.stopInfoMessageAnnouncement();
      this.CancelAllDeferredMessages();
      this.historyRepository.lobbyClosed = true;
      if (channel == this.channel) {
        this.logger.info("part");
        this.status = LobbyStatus.Left;
        this.Disconnected.emit();
      }
    });
    this.ircClient.on('pm', (nick, message) => {
      this.handlePrivateMessage(nick, message);
    });
    this.ircClient.on('kick', (channel, who, by, reason) => {
      this.logger.info('%s was kicked from %s by %s: %s', who, channel, by, reason);
    });
  }

  /**
   * 試合を終えて待機中の人数を数える
   */
  get playersFinished(): number {
    let i = 0;
    for (let p of this.players) {
      if (p.mpstatus == MpStatuses.Finished) i++;
    }
    return i;
  }

  /**
   * 試合中の人数を数える
   */
  get playersInGame(): number {
    let i = 0;
    for (let p of this.players) {
      if (p.mpstatus == MpStatuses.Finished || p.mpstatus == MpStatuses.Playing) i++;
    }
    return i;
  }

  /**
   * プレイヤーたちの状況を項目ごとに数える
   */
  CountPlayersStatus(): { inGame: number, playing: number, finished: number, inlobby: number, total: number } {
    const r = { inGame: 0, playing: 0, finished: 0, inlobby: 0, total: this.players.size };
    for (let p of this.players) {
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
   * usernameからプレイヤーオブジェクトを取得または作成する
   * nameに対してPlayerは一意のインスタンスで直接比較可能
   * この関数以外でPlayerを作成してはならない
   * 再入室してきたユーザーの情報を参照したい場合に備えてプレイヤーをマップで保持しておく
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
   * username からプレイヤーオブジェクトを取得する
   * まだ作成されていないプレイヤーだった場合nullを返す
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

  // username のプレイヤーがゲームに参加しているか調べる
  Includes(username: string): boolean {
    const ename = escapeUserName(username);
    let p = this.playersMap.get(ename);
    if (p === undefined) return false;
    return this.players.has(p);
  }

  TransferHost(user: Player): void {
    this.transferHostTimeout.cancel();

    this.hostPending = user;
    this.transferHostTimeout.start(this.option.transferhost_timeout_ms);
    if (user.id != 0) {
      this.SendMessage("!mp host #" + user.id);
    } else {
      this.SendMessage("!mp host " + user.name);
    }
  }

  onTimeoutedTransferHost(): void {
    this.logger.warn("!mp host timeout");
    if (this.hostPending) {
      this.hostPending = null;
      this.LoadMpSettingsAsync();
    }
  }

  AbortMatch(): void {
    if (this.isMatching) {
      this.SendMessage("!mp abort");
    }
  }

  SendMessage(message: string): void {
    if (this.channel != undefined) {
      this.ircClient.say(this.channel, message);
      this.ircClient.emit("sentMessage", this.channel, message);
      this.SentMessage.emit({ message });
      this.chatlogger.trace("bot:%s", message);
    }
  }

  SendPrivateMessage(message: string, target: string): void {
    this.ircClient.say(target, message);
    this.ircClient.emit("sentPrivateMessage", target, message);
    this.SentMessage.emit({ message });
    this.chatlogger.trace("bot->%s:%s", target, message);
  }

  SendMessageWithCoolTime(message: string | (() => string), tag: string, cooltimeMs: number): boolean {
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

  SendPrivateMessageWithCoolTime(message: string | (() => string), target: string, tag: string, cooltimeMs: number): boolean {
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

  SendMessageWithDelayAsync(message: string, delay: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.SendMessage(message);
        resolve();
      }, delay);
    });
  }

  DeferMessage(message: string, tag: string, delayMs: number, resetTimer: boolean = false): void {
    if (message == "") {
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
    for (let tag in this.deferredMessages) {
      this.deferredMessages[tag].cancel();
    }
  }

  async RequestStatAsync(player: Player, byPm: boolean, timeout: number = this.option.stat_timeout_ms): Promise<StatResult> {
    return new Promise<StatResult>((resolve, reject) => {
      const tm = setTimeout(() => {
        reject("stat timeout");
      }, timeout);
      const d = this.ParsedStat.on(({ result }) => {
        if (escapeUserName(result.name) == player.escaped_name) {
          clearTimeout(tm);
          d.dispose();
          resolve(result);
        }
      });
      this.ircClient.say(byPm || this.channel == null ? "BanchoBot" : this.channel, "!stat " + player.escaped_name);
    });
  }

  async SendMultilineMessageWithInterval(lines: string[], intervalMs: number, tag: string, cooltimeMs: number): Promise<void> {
    if (lines.length == 0) return;
    const totalTime = lines.length * intervalMs + cooltimeMs;
    if (this.SendMessageWithCoolTime(lines[0], tag, totalTime)) {
      for (let i = 1; i < lines.length; i++) {
        await this.SendMessageWithDelayAsync(lines[i], intervalMs);
      }
    }
  }

  // #region message handling

  private handleMessage(from: string, to: string, message: string): void {
    if (from == "BanchoBot") {
      this.handleBanchoResponse(message);
    } else {
      const p = this.GetPlayer(from);
      if (p != null) {
        if (parser.IsChatCommand(message)) {
          this.RaiseReceivedChatCommand(p, message);
        }
        this.PlayerChated.emit({ player: p, message });
        if (IsStatResponse(message)) {
          this.chatlogger.trace("%s:%s", p.name, message);
        } else {
          this.chatlogger.info("%s:%s", p.name, message);
        }
      }
    }
  }

  private handleAction(from: string, to: string, message: string): void {
    this.chatlogger.info("*%s:%s", from, message);
  }

  private handlePrivateMessage(from: string, message: string): void {
    if (from == "BanchoBot") {
      if (IsStatResponse(message)) {
        if (this.statParser.feedLine(message)) {
          this.RaiseParsedStat(true);
        }
      }
    } else {
      const user = this.GetPlayer(from);
      if (!user) return;
      if (message == "!info" || message == "!help") {
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
        this.RaiseAbortedMatch();
        break;
      case BanchoResponseType.AddedReferee:
        this.GetOrMakePlayer(c.params[0]).setRole(Roles.Referee);
        this.logger.trace("AddedReferee : %s", c.params[0]);
        break;
      case BanchoResponseType.RemovedReferee:
        this.GetOrMakePlayer(c.params[0]).removeRole(Roles.Referee);
        this.logger.trace("RemovedReferee : %s", c.params[0]);
        break;
      case BanchoResponseType.ListRefs:
        this.listRefStart = Date.now();
        break;
      case BanchoResponseType.PlayerMovedSlot:
        this.GetOrMakePlayer(c.params[0]).slot = c.params[1];
        this.logger.trace("slot moved : %s, %d", c.params[0], c.params[1]);
        break;
      case BanchoResponseType.TeamChanged:
        this.GetOrMakePlayer(c.params[0]).team = c.params[1];
        this.logger.trace("team changed : %s, %s", c.params[0], Teams[c.params[1]]);
        break;
      case BanchoResponseType.BeatmapChanged:
      case BanchoResponseType.MpBeatmapChanged:
        this.mapId = c.params[0];
        this.mapTitle = c.params[1];
        const changer = this.host ? `(by ${this.host.name})` : ""
        this.logger.info(`beatmap changed${changer} : https://osu.ppy.sh/b/${this.mapId} ${this.mapTitle}`);
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
        this.logger.info("cleared host");
        this.isClearedHost = true;
        if (this.host != null) {
          this.host.removeRole(Roles.Host);
        }
        this.host = null;
        this.hostPending = null;
        break;
      case BanchoResponseType.Unhandled:
        if (this.checkListRef(message)) break;
        this.logger.debug("unhandled bancho response : %s", message);
        break;
    }
    this.ReceivedBanchoResponse.emit({ message, response: c });
  }

  private checkListRef(message: string): boolean {
    if (this.listRefStart != 0) {
      if (Date.now() < this.listRefStart + this.option.listref_duration_ms) {
        const p = this.GetOrMakePlayer(message);
        p.setRole(Roles.Referee);
        this.logger.trace("AddedReferee : %s", p.escaped_name);
        return true;
      } else {
        this.listRefStart = 0;
        this.logger.trace("check list ref ended");
      }
    }
    return false;
  }

  RaiseReceivedChatCommand(player: Player, message: string): void {
    this.logger.trace("custom command %s:%s", player.name, message);
    if (player.isReferee && message.startsWith("!mp")) return;
    const { command, param } = parser.ParseChatCommand(message);
    if (command == "!info" || command == "!help") {
      this.showInfoMessage();
    }
    this.ReceivedChatCommand.emit({ player, command, param });
  }

  // #endregion

  // #region event handling

  RaisePlayerJoined(username: string, slot: number, team: Teams, asHost: boolean = false): void {
    const player = this.GetOrMakePlayer(username);
    if (this.addPlayer(player, slot, team)) {
      this.PlayerJoined.emit({ player, slot, team });
    } else {
      this.LoadMpSettingsAsync();
    }
  }

  RaisePlayerLeft(username: string): void {
    const player = this.GetOrMakePlayer(username);
    if (this.removePlayer(player)) {
      this.PlayerLeft.emit({ player });
    } else {
      this.LoadMpSettingsAsync();
    }
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
    this.logger.info("match started");
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
      this.logger.warn("未参加のプレイヤーがゲームを終えた: %s", username);
      this.LoadMpSettingsAsync();
    }
  }

  RaiseMatchFinished(): void {
    let count = this.players.size;
    this.logger.info(`match finished (${count} players)`);
    this.isMatching = false;
    this.players.forEach(p => p.mpstatus = MpStatuses.InLobby);
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch(): void {
    const sc = this.CountPlayersStatus();
    this.logger.info("match aborted %d / %d", sc.finished, sc.inGame);
    this.isMatching = false;
    this.players.forEach(p => p.mpstatus = MpStatuses.InLobby);
    this.AbortedMatch.emit({ playersFinished: sc.finished, playersInGame: sc.inGame });
  }

  RaiseNetError(err: Error): void {
    this.logger.error("error occured : " + err.message);
    this.logger.error(err.stack);
    this.NetError.emit(err);
  }

  RaiseJoinedLobby(channel: string): void {
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
    this.JoinedLobby.emit({ channel: this.channel, creator: this.GetOrMakePlayer(this.ircClient.nick) })
    this.startInfoMessageAnnouncement();
  }

  RaiseParsedSettings(): void {
    if (!this.settingParser.isParsing && this.settingParser.result != null) {
      this.logger.info("parsed mp settings");
      const result = this.settingParser.result;
      const r = this.margeMpSettingsResult(result);
      if (r.hostChanged || r.playersIn.length != 0 || r.playersOut.length != 0) {
        this.logger.info("applied mp settings");
      }
      this.ParsedSettings.emit({ result, ...r });
    }
  }

  RaiseParsedStat(isPm: boolean): void {
    if (!this.statParser.isParsing && this.statParser.result != null) {
      const p = this.GetPlayer(this.statParser.result.name);
      if (p != null) {
        p.laststat = this.statParser.result;
        this.logger.info("parsed stat %s -> %s", p.name, StatStatuses[p.laststat.status]);
        this.ParsedStat.emit({ result: this.statParser.result, player: p, isPm });
      }
    }
  }

  /**
   * pluginに読み込み作業が完了したことを通知する
   */
  RaisePluginsLoaded(): void {
    for (let p of this.plugins) {
      p.OnLoaded();
    }
  }

  OnUserNotFound(): void {
    if (this.hostPending != null) {
      const p = this.hostPending;
      this.logger.warn("occured OnUserNotFound : " + p.name);
      this.hostPending = null;
    }
  }

  // #endregion

  // #region lobby management

  MakeLobbyAsync(title: string): Promise<string> {
    if (title === "") {
      throw new Error("title is empty");
    }
    if (this.status != LobbyStatus.Standby) {
      throw new Error("A lobby has already been made.");
    }
    this.status = LobbyStatus.Making;
    this.logger.trace("start makeLobby");
    return new Promise<string>(resolve => {
      if (this.ircClient.hostMask != "") {
        this.makeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        this.logger.trace("waiting registered");
        this.ircClient.once("registered", () => {
          this.makeLobbyAsyncCore(title).then(v => resolve(v));
        });
      }
    });
  }

  private makeLobbyAsyncCore(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.JoinedLobby.once(a => {
        this.lobbyName = title;
        this.logger.trace("completed makeLobby");
        if (this.lobbyId) {
          resolve(this.lobbyId);
        } else {
          reject("missing lobby id");
        }

      });
      const trg = "BanchoBot";
      const msg = "!mp make " + title;
      this.ircClient.say(trg, msg);
      this.ircClient.emit("sentMessage", trg, msg);
    });
  }

  EnterLobbyAsync(channel: string): Promise<string> {
    this.logger.trace("start EnterLobby");
    return new Promise<string>((resolve, reject) => {
      let ch = parser.EnsureMpChannelId(channel);
      if (ch == "") {
        this.logger.error("invalid channel: %s", channel);
        reject("invalid channel");
        return;
      }
      this.ircClient.join(ch, () => {
        this.lobbyName = "__";
        this.logger.trace("completed EnterLobby");
        if (this.lobbyId) {
          resolve(this.lobbyId);
        } else {
          reject("missing lobby id");
        }
      });
    });
  }

  CloseLobbyAsync(): Promise<void> {
    this.logger.trace("start CloseLobby");
    if (this.status != LobbyStatus.Entered) {
      this.logger.error("無効な呼び出し:CloseLobbyAsync");
      throw new Error("閉じるロビーがありません。");
    }
    return new Promise<void>((resolve, reject) => {
      this.ircClient.once("part", (channel: string, nick: string) => {
        this.ircClient.disconnect("goodby", () => {
          this.logger.trace("completed CloseLobby");
          resolve();
        });
      });
      if (this.channel != undefined) {
        this.SendMessage("!mp close");
        this.status = LobbyStatus.Leaving;
      } else {
        reject();
      }
    });
  }

  LoadMpSettingsAsync(): Promise<void> {
    if (this.status != LobbyStatus.Entered) {
      return Promise.reject("invalid lobby status @LoadMpSettingsAsync");
    }
    if (this.SendMessageWithCoolTime("!mp settings", "mpsettings", 15000)) {
      this.logger.trace("start loadLobbySettings");
      const p = new Promise<void>(resolve => {
        this.ParsedSettings.once(() => {
          this.SendMessage("!mp listrefs");
          this.logger.trace("completed loadLobbySettings");
          resolve();
        });
      });
      return p;
    } else {
      this.logger.trace("load mp settings skiped by cool time");
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
      if (16 < this.players.size) {
        this.logger.warn("joined 17th players: %s", player.name);
        this.UnexpectedAction.emit(new Error("unexpected join"));
        return false;
      }
      return true;
    } else {
      this.logger.warn("参加済みのプレイヤーが再度参加した: %s", player.name);
      this.UnexpectedAction.emit(new Error("unexpected join"));
      return false;
    }
  }

  private removePlayer(player: Player): boolean {
    player.removeRole(Roles.Player);
    player.removeRole(Roles.Host);
    player.mpstatus = MpStatuses.None;

    if (this.players.has(player)) {
      this.players.delete(player);
      if (this.host == player) {
        this.host = null;
      }
      if (this.hostPending == player) {
        this.hostPending = null;
      }
      return true;
    } else {
      this.logger.warn("未参加のプレイヤーが退出した: %s", player.name);
      this.UnexpectedAction.emit(new Error("unexpected left"));
      return false;
    }
  }

  private setAsHost(player: Player): boolean {
    if (!this.players.has(player)) {
      this.transferHostTimeout.cancel();
      this.logger.warn("未参加のプレイヤーがホストになった: %s", player.name);
      return false;
    }

    if (this.hostPending == player) {
      this.transferHostTimeout.cancel();
      this.hostPending = null;
    } else if (this.hostPending != null) {
      this.logger.warn("pending中に別のユーザーがホストになった pending: %s, host: %s", this.hostPending.name, player.name);
    } // pending == null は有効

    if (this.host != null) {
      this.host.removeRole(Roles.Host);
    }
    this.host = player;
    player.setRole(Roles.Host);
    return true;
  }

  /**
   * MpSettingsの結果を取り込む。join/left/hostの発生しない
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

    for (let p of this.players) {
      if (!mpPlayers.includes(p)) {
        this.removePlayer(p);
        playersOut.push(p);
      }
    }

    for (let r of result.players) {
      let p = this.GetOrMakePlayer(r.name);
      if (!this.players.has(p)) {
        this.addPlayer(p, r.slot, r.team);
        playersIn.push(p);
      } else {
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

  GetLobbyStatus(): string {
    const pc = this.CountPlayersStatus();
    let s = `=== lobby status ===
  lobby id : ${this.lobbyId}, name : ${this.lobbyName},  status : ${LobbyStatus[this.status]}
  players : ${this.players.size}, inGame : ${pc.inGame} (playing : ${pc.playing})
  refs : ${Array.from(this.playersMap.values()).filter(v => v.isReferee).map(v => v.name).join(",")}
  timer : ${this.isStartTimerActive}, clearedhost : ${this.isClearedHost}
  host : ${this.host ? this.host.name : "null"}, pending : ${this.hostPending ? this.hostPending.name : "null"}`
      ;

    for (let p of this.plugins) {
      const ps = p.GetPluginStatus();
      if (ps != "") {
        s += "\n" + ps;
      }
    }
    return s;
  }

  private showInfoMessage(): void {
    !this.SendMessageWithCoolTime(this.getInfoMessage(), "infomessage", this.option.info_message_cooltime_ms);
  }

  private sendInfoMessagePM(player: Player): void {
    this.SendPrivateMessageWithCoolTime(this.getInfoMessage(), player.name, "infomessage", this.option.info_message_cooltime_ms)
  }

  private getInfoMessage(): string {
    return `- Osu Auto Host Rotation Bot ver ${pkg.version} - \n`
      + this.option.info_message.join("\n");
  }

  // ircでログインしたユーザーに権限を与える
  private assignCreatorRole(): void {
    if (!this.ircClient.nick) {
      this.ircClient.once("registered", () => {
        this.assignCreatorRole();
      });
    } else {
      var c = this.GetOrMakePlayer(this.ircClient.nick);
      c.setRole(Roles.Authorized);
      c.setRole(Roles.Referee);
      c.setRole(Roles.Creator);
      this.logger.info("assigned %s creators role", this.ircClient.nick);
    }
  }

  private startInfoMessageAnnouncement(): void {
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

  private stopInfoMessageAnnouncement(): void {
    if (this.infoMessageAnnouncementTimeId != null) {
      this.logger.trace("stopped InfoMessageAnnouncement.");
      clearInterval(this.infoMessageAnnouncementTimeId);
      this.infoMessageAnnouncementTimeId = null;
    }
  }
}
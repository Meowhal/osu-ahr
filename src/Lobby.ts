import { Player, escapeUserId, Roles, Teams, PlayerStatus } from "./Player";
import { ILobby, LobbyStatus } from "./ILobby";
import { parser, BanchoResponseType, BanchoResponse } from "./parsers";
import { IIrcClient } from "./IIrcClient";
import { TypedEvent, DeferredAction } from "./libs";
import { MpSettingsParser } from "./parsers/MpSettingsParser";
import { LobbyPlugin } from "./plugins/LobbyPlugin";
import config from "config";
import log4js from "log4js";
import pkg from "../package.json";

const logger = log4js.getLogger("lobby");
const chatlogger = log4js.getLogger("chat");

export interface LobbyOption {
  authorized_users: string[], // 特権ユーザー
  listref_duration: number,
  info_message: string[],
  info_message_interval: number,
  info_message_cooltime: number,
}

const LobbyDefaultOption = config.get<LobbyOption>("Lobby");

export class Lobby implements ILobby {
  // Members
  option: LobbyOption;
  ircClient: IIrcClient;
  lobbyName: string | undefined;
  lobbyId: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  host: Player | null = null;
  hostPending: Player | null = null;
  players: Set<Player> = new Set<Player>();
  playersMap: Map<string, Player> = new Map<string, Player>();
  isMatching: boolean = false;
  mpSettingParser: MpSettingsParser | undefined;
  plugins: LobbyPlugin[] = [];
  listRefStart: number = 0;
  mapTitle: string = "";
  mapId: number = 0;
  coolTimes: { [key: string]: number } = {};
  defferedMessages: { [key: string]: DeferredAction<string> } = {}

  // Events
  JoinedLobby = new TypedEvent<{channel:string, creator:Player}>();
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; team: Teams; }>();
  PlayerLeft = new TypedEvent<Player>();
  HostChanged = new TypedEvent<{ succeeded: boolean, player: Player }>();
  UserNotFound = new TypedEvent<void>();
  MatchStarted = new TypedEvent<{ mapId: number, mapTitle: string }>();
  PlayerFinished = new TypedEvent<{ player: Player, score: number, isPassed: boolean, playersFinished: number, playersInGame: number }>();
  MatchFinished = new TypedEvent<void>();
  AbortedMatch = new TypedEvent<{ playersFinished: number, playersInGame: number }>();
  UnexpectedAction = new TypedEvent<Error>();
  NetError = new TypedEvent<Error>();
  PlayerChated = new TypedEvent<{ player: Player, message: string }>();
  ReceivedCustomCommand = new TypedEvent<{ player: Player, command: string, param: string }>();
  PluginMessage = new TypedEvent<{ type: string, args: string[], src: LobbyPlugin | null }>();
  SentMessage = new TypedEvent<string>();
  RecievedBanchoResponse = new TypedEvent<{ message: string, response: BanchoResponse }>();

  constructor(ircClient: IIrcClient, option: any | null = null) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }
    this.option = { ...LobbyDefaultOption, ...option } as LobbyOption;
    this.status = LobbyStatus.Standby;
    this.ircClient = ircClient;
    this.ircClient.on("join", (channel, who) => {
      if (who == this.ircClient.nick) {
        this.RaiseJoinedLobby(channel);
      }
    });
    this.ircClient.on("message", (from, to, message) => {
      if (to == this.channel) {
        this.handleMessage(from, to, message);
      }
    });
    this.ircClient.on("netError", (err: any) => {
      this.RaiseNetError(err);
    });
    this.ircClient.once("part", (channel: string, nick: string) => {
      if (channel == this.channel) {
        this.status = LobbyStatus.Left;
      }
    });
  }

  get playersFinished(): number {
    let i = 0;
    for (let p of this.players) {
      if (p.status == PlayerStatus.Finished) i++;
    }
    return i;
  }

  get playersInGame(): number {
    let i = 0;
    for (let p of this.players) {
      if (p.status == PlayerStatus.Finished || p.status == PlayerStatus.Playing) i++;
    }
    return i;
  }

  countPlayersStatus(): { inGame: number, playing: number, finished: number, inlobby: number, total: number } {
    const r = { inGame: 0, playing: 0, finished: 0, inlobby: 0, total: this.players.size };
    for (let p of this.players) {
      switch (p.status) {
        case PlayerStatus.InLobby:
          r.inlobby++;
          break;
        case PlayerStatus.Playing:
          r.playing++;
          break;
        case PlayerStatus.Finished:
          r.finished++;
          break;
      }
    }
    r.inGame = r.finished + r.playing;
    return r;
  }

  // useridからプレイヤーオブジェクトを取得する
  // IDに対してPlayerは一意のインスタンス
  // 再入室してきたユーザーの情報を参照したい場合に備えてプレイヤーをマップで保持しておく
  GetOrMakePlayer(userid: string): Player {
    const eid = escapeUserId(userid);
    if (this.playersMap.has(eid)) {
      return this.playersMap.get(eid) as Player;
    } else {
      const nu = new Player(userid);
      this.playersMap.set(eid, nu);
      if (this.option.authorized_users.includes(userid)) {
        nu.setRole(Roles.Authorized);
      }
      return nu;
    }
  }

  GetPlayer(userid: string): Player | null {
    const eid = escapeUserId(userid);
    if (this.playersMap.has(eid)) {
      return this.playersMap.get(eid) as Player;
    } else {
      return null;
    }
  }

  // userid のプレイヤーがゲームに参加しているか調べる
  Includes(userid: string): boolean {
    const eid = escapeUserId(userid);
    let p = this.playersMap.get(eid);
    if (p === undefined) return false;
    return this.players.has(p);
  }

  TransferHost(user: Player): void {
    this.hostPending = user;
    this.SendMessage("!mp host " + user.id);
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
      this.SentMessage.emit(message);
      chatlogger.trace("bot:%s", message);
    }
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

  SendMessageWithDelayAsync(message: string, delay: number): Promise<void> {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.SendMessage(message);
        resolve();
      }, delay);
    });
  }

  DeferMessage(message: string, tag: string, delay: number, resetTimer: boolean = false): void {
    if (!(tag in this.defferedMessages)) {
      this.defferedMessages[tag] = new DeferredAction(msg => {
        this.SendMessage(msg);
      });
    }
    const d = this.defferedMessages[tag];
    if (message == "") {
      d.cancel();
    } else {
      d.start(delay, message, resetTimer);
    }
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

  private handleMessage(from: string, to: string, message: string) {
    if (from == "BanchoBot") {
      this.handleBanchoResponse(message);
    } else {
      const p = this.GetPlayer(from);
      if (p != null) {
        if (parser.IsCustomCommand(message)) {
          this.RaiseReceivedCustomCommand(p, message);
        }
        this.PlayerChated.emit({ player: p, message });
        chatlogger.trace("%s:%s", p.id, message);
      }
    }
  }

  private handleBanchoResponse(message: string) {
    const c = parser.ParseBanchoResponse(message);
    switch (c.type) {
      case BanchoResponseType.HostChanged:
        this.RaiseHostChanged(c.params[0]);
        break;
      case BanchoResponseType.UserNotFound:
        this.OnUserNotFound();
        break;
      case BanchoResponseType.MatchFinished:
        this.RaiseMatchFinished();
        break;
      case BanchoResponseType.MatchStarted:
        this.RaiseMatchStarted();
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
        logger.trace("AddedReferee : %s", c.params[0]);
        break;
      case BanchoResponseType.RemovedReferee:
        this.GetOrMakePlayer(c.params[0]).removeRole(Roles.Referee);
        logger.trace("RemovedReferee : %s", c.params[0]);
        break;
      case BanchoResponseType.ListRefs:
        this.listRefStart = Date.now();
        break;
      case BanchoResponseType.PlayerMovedSlot:
        this.GetOrMakePlayer(c.params[0]).slot = c.params[1];
        logger.trace("slot moved : %s, %d", c.params[0], c.params[1]);
        break;
      case BanchoResponseType.TeamChanged:
        this.GetOrMakePlayer(c.params[0]).team = c.params[1];
        logger.trace("team changed : %s, %s", c.params[0], Teams[c.params[1]]);
        break;
      case BanchoResponseType.BeatmapChanged:
      case BanchoResponseType.MpBeatmapChanged:
        this.mapId = c.params[0];
        this.mapTitle = c.params[1];
        break;
      case BanchoResponseType.Unhandled:
        this.checkListRef(message);
        logger.debug("unhandled bancho response : %s", message);
        break;
    }
    this.RecievedBanchoResponse.emit({ message, response: c });
  }

  private checkListRef(message: string) {
    if (this.listRefStart != 0) {
      if (Date.now() < this.listRefStart + this.option.listref_duration) {
        const p = this.GetOrMakePlayer(message);
        p.setRole(Roles.Referee);
        logger.trace("AddedReferee : %s", p.escaped_id);
      } else {
        this.listRefStart = 0;
        logger.trace("check list ref ended");
      }
    }
  }

  RaiseReceivedCustomCommand(player: Player, message: string): void {
    logger.trace("custom command %s:%s", player.id, message);
    if (player.isReferee && message.startsWith("!mp")) return;
    const { command, param } = parser.ParseCustomCommand(message);
    if (command == "!info" || command == "!help") {
      this.showInfoMessage();
    }
    this.ReceivedCustomCommand.emit({ player, command, param });
  }

  // #endregion

  // #region event handling

  RaisePlayerJoined(userid: string, slot: number, team: Teams, asHost: boolean = false): void {
    const player = this.GetOrMakePlayer(userid);
    player.setRole(Roles.Player);
    player.slot = slot;
    player.team = team;
    player.status = PlayerStatus.InLobby;

    if (!this.players.has(player)) {
      this.players.add(player);
      if (asHost) {
        this.host = player;
        player.setRole(Roles.Host);
      }
      this.PlayerJoined.emit({ player, slot, team });
    } else {
      logger.warn("参加済みのプレイヤーが再度参加した: %s", userid);
      this.UnexpectedAction.emit(new Error("unexpected join"));
    }
  }

  RaisePlayerLeft(userid: string): void {
    const player = this.GetOrMakePlayer(userid);
    player.removeRole(Roles.Player);
    player.removeRole(Roles.Host);
    player.status = PlayerStatus.None;

    if (this.players.has(player)) {
      this.players.delete(player);
      if (this.host == player) {
        this.host = null;
      }
      if (this.hostPending == player) {
        this.hostPending = null;
      }
      this.PlayerLeft.emit(player);
    } else {
      logger.warn("未参加のプレイヤーが退出した: %s", userid);
      this.UnexpectedAction.emit(new Error("unexpected left"));
    }
  }

  RaiseHostChanged(userid: string): void {
    const player = this.GetOrMakePlayer(userid);
    if (!this.players.has(player)) {
      logger.warn("未参加のプレイヤーがホストになった: %s", userid);
      this.players.add(player);
    }

    if (this.hostPending == player) {
      this.hostPending = null;
    } else if (this.hostPending != null) {
      logger.warn("pending中に別のユーザーがホストになった pending: %s, host: %s", this.hostPending.id, userid);
    } // pending == null は有効

    if (this.host != null) {
      this.host.removeRole(Roles.Host);
    }
    this.host = player;
    player.setRole(Roles.Host);
    this.HostChanged.emit({ succeeded: true, player });
  }

  RaiseMatchStarted(): void {
    logger.info(`match started : https://osu.ppy.sh/b/${this.mapId} ${this.mapTitle}`);
    this.isMatching = true;
    this.players.forEach(p => p.status = PlayerStatus.Playing);
    this.MatchStarted.emit({ mapId: this.mapId, mapTitle: this.mapTitle });
  }

  RaisePlayerFinished(userid: string, score: number, isPassed: boolean): void {
    const player = this.GetOrMakePlayer(userid);
    player.status = PlayerStatus.Finished;
    const sc = this.countPlayersStatus();
    this.PlayerFinished.emit({ player, score, isPassed, playersFinished: sc.finished, playersInGame: sc.inGame });
    if (!this.players.has(player)) {
      logger.warn("未参加のプレイヤーがゲームを終えた: %s", userid);
      this.RaisePlayerJoined(userid, 0, Teams.None);
    }
  }

  RaiseMatchFinished(): void {
    logger.info("match finished");
    this.isMatching = false;
    this.players.forEach(p => p.status = PlayerStatus.InLobby);
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch(): void {
    const sc = this.countPlayersStatus();
    logger.info("match aborted %d / %d", sc.finished, sc.inGame);
    this.isMatching = false;
    this.players.forEach(p => p.status = PlayerStatus.InLobby);
    this.AbortedMatch.emit({ playersFinished: sc.finished, playersInGame: sc.inGame });
  }

  RaiseNetError(err: Error): void {
    logger.error("error occured : " + err.message);
    logger.error(err.stack);
    this.NetError.emit(err);
  }

  RaiseJoinedLobby(channel:string) {
    this.players.clear();
    this.channel = channel;
    this.lobbyId = channel.replace("#mp_", "");
    this.status = LobbyStatus.Entered;

    const creator = this.GetOrMakePlayer(this.ircClient.nick);
    this.assignCreatorRole();
    if (this.channel != undefined) {
      logger.addContext("channel", this.channel);
      for(let p of this.plugins) {
        p.logger.addContext("channel", this.channel);
      }
      this.JoinedLobby.emit({channel:this.channel, creator})
    }    
  }

  OnUserNotFound(): void {
    if (this.hostPending != null) {
      const p = this.hostPending;
      logger.warn("occured OnUserNotFound : " + p.id);
      this.hostPending = null;
      this.HostChanged.emit({ succeeded: false, player: p });
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
    logger.trace("start makeLobby");
    return new Promise<string>(resolve => {
      if (this.ircClient.hostMask != "") {
        this.makeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        logger.trace("waiting registered");
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
        logger.trace("completed makeLobby");
        resolve(this.lobbyId);
      });
      const trg = "BanchoBot";
      const msg = "!mp make " + title;
      this.ircClient.say(trg, msg);
      this.ircClient.emit("sentMessage", trg, msg);
    });
  }

  EnterLobbyAsync(channel: string): Promise<string> {
    logger.trace("start EnterLobby");
    return new Promise<string>((resolve, reject) => {
      let ch = parser.EnsureMpChannelId(channel);
      if (ch == "") {
        logger.error("invalid channel: %s", channel);
        reject();
        return;
      }
      this.ircClient.join(ch, () => {
        this.lobbyName = "__";
        logger.trace("completed EnterLobby");
        resolve(this.lobbyId);
      });
    });
  }

  CloseLobbyAsync(): Promise<void> {
    logger.trace("start CloseLobby");
    if (this.status != LobbyStatus.Entered) {
      logger.error("無効な呼び出し:CloseLobbyAsync");
      throw new Error("閉じるロビーがありません。");
    }
    return new Promise<void>((resolve, reject) => {
      this.ircClient.once("part", (channel: string, nick: string) => {
        this.ircClient.disconnect("goodby", () => {
          logger.trace("completed CloseLobby");
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

  LoadLobbySettingsAsync(): Promise<void> {
    if (this.status != LobbyStatus.Entered || this.mpSettingParser != undefined) {
      return Promise.reject();
    }
    logger.trace("start loadLobbySettings");
    this.mpSettingParser = new MpSettingsParser();
    let completed: (() => void) | null = null;
    const feed = (from: string, to: string, message: string): void => {
      if (from == "BanchoBot" && to == this.channel && this.mpSettingParser != undefined) {
        const r = this.mpSettingParser.feedLine(message);
        if (r && completed != null) {
          completed();
        }
      }
    }

    this.ircClient.on("message", feed);

    const task = new Promise<void>((resolve, reject) => {
      completed = () => {
        this.ircClient.off("message", feed);
        if (this.mpSettingParser == undefined) {
          logger.error("mpSettingParser is undefined");
          reject();
          return;
        }
        logger.debug("parsed mp settings");
        this.margeMpSettingsResult(this.mpSettingParser);
        this.SendMessage("!mp listrefs");
        this.SendMessage("The host queue was rearranged. You can check the current order with !queue command.");

        logger.trace("completed loadLobbySettings");
        this.mpSettingParser = undefined;
        resolve();
      }
    });

    this.SendMessage("!mp settings");
    return task;
  }

  // 一旦ロビーから全員退出させ、現在のホストからスロット順に追加していく
  private margeMpSettingsResult(parser: MpSettingsParser): void {
    this.lobbyName = parser.name;
    this.host = null;
    this.hostPending = null;
    Array.from(this.players).forEach(p => this.RaisePlayerLeft(p.id));

    if (parser.players.length == 0) return;

    let hostidx = parser.players.findIndex(p => p.isHost);
    // if (hostidx == -1) hostidx = 0;

    // ホストを配列の先頭にする。
    const temp = Array.from(parser.players);
    const players = (hostidx == -1) ? temp : temp.splice(hostidx).concat(temp);
    players.forEach((v, i) => {
      this.RaisePlayerJoined(v.id, v.slot, v.team, i == hostidx);
    });
  }

  // #endregion

  GetLobbyStatus(): string {
    const pc = this.countPlayersStatus();
    let s = `=== lobby status ===
  lobby id : ${this.lobbyId}
  status : ${LobbyStatus[this.status]}
  players : ${this.players.size}, inGame : ${pc.inGame} (playing : ${pc.playing})
  refs : ${Array.from(this.playersMap.values()).filter(v => v.isReferee).map(v => v.id).join(",")}
  host : ${this.host ? this.host.id : "null"}, pending : ${this.hostPending ? this.hostPending.id : "null"}`
      ;

    for (let p of this.plugins) {
      const ps = p.getPluginStatus();
      if (ps != "") {
        s += "\n" + ps;
      }
    }
    return s;
  }

  private showInfoMessage(): void {
    const msgs = [
      `- Osu Auto Host Rotation Bot ver ${pkg.version} -`,
      ...this.option.info_message
    ];
    if (!this.SendMultilineMessageWithInterval(msgs, this.option.info_message_interval, "infomessage", this.option.info_message_cooltime)) {
      logger.trace("info cool time");
    }
  }

  // ircでログインしたユーザーに権限を与える
  private assignCreatorRole() {
    if (!this.ircClient.nick) {
      this.ircClient.once("registered", () => {
        this.assignCreatorRole();
      });
    } else {
      var c = this.GetOrMakePlayer(this.ircClient.nick);
      c.setRole(Roles.Authorized);
      c.setRole(Roles.Creator);
      logger.info("assigned %s creators role", this.ircClient.nick);
    }
  }
}


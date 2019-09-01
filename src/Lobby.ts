import { Player, escapeUserId } from "./Player";
import { ILobby, LobbyStatus } from "./ILobby";
import { parser, BanchoResponseType, BanchoResponse } from "./parsers";
import { IIrcClient } from "./IIrcClient";
import { TypedEvent } from "./libs/events";
import { MpSettingsParser } from "./parsers/MpSettingsParser";
import { getIrcConfig } from "./TypedConfig";
import { LobbyPlugin } from "./plugins/LobbyPlugin";
import config from "config";
import log4js from "log4js";
import { isArray } from "util";

const logger = log4js.getLogger("lobby");
const chatlogger = log4js.getLogger("chat");

export interface LobbyOption {
  authorized_users: string[] // 特権ユーザー
}

const LobbyDefaultOption = config.get<LobbyOption>("Lobby");

export class Lobby implements ILobby {
  // Members
  option: LobbyOption;
  host: Player | null;
  hostPending: Player | null;
  name: string | undefined;
  id: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  players: Set<Player>;
  playersFinished: Set<Player>;
  playersInGame: Set<Player>;
  ircClient: IIrcClient;
  playersMap: Map<string, Player>;
  isMatching: boolean;
  mpSettingParser: MpSettingsParser | undefined;
  plugins: LobbyPlugin[] = [];

  // Events
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; }>();
  PlayerLeft = new TypedEvent<Player>();
  HostChanged = new TypedEvent<{ succeeded: boolean, player: Player }>();
  UserNotFound = new TypedEvent<void>();
  MatchStarted = new TypedEvent<void>();
  PlayerFinished = new TypedEvent<{ player: Player, score: number, isPassed: boolean, playersFinished: number, playersInGame: number }>();
  MatchFinished = new TypedEvent<void>();
  AbortedMatch = new TypedEvent<{ playersFinished: number, playersInGame: number }>();
  UnexpectedAction = new TypedEvent<Error>();
  NetError = new TypedEvent<Error>();
  PlayerChated = new TypedEvent<{ player: Player, message: string }>();
  ReceivedCustomCommand = new TypedEvent<{ player: Player, authority: number, command: string, param: string }>();
  PluginMessage = new TypedEvent<{ type: string, args: string[], src: LobbyPlugin | null }>();
  SentMessage = new TypedEvent<string>();
  RecievedBanchoResponse = new TypedEvent<{ message: string, response: BanchoResponse }>();

  constructor(ircClient: IIrcClient, option: any | null = null) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }
    this.option = { ...LobbyDefaultOption, ...option } as LobbyOption;
    this.status = LobbyStatus.Standby;
    this.players = new Set();
    this.playersFinished = new Set();
    this.playersInGame = new Set();
    this.playersMap = new Map();
    this.ircClient = ircClient;
    this.host = null;
    this.hostPending = null;
    this.isMatching = false;

    this.authorizeIrcUser();

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
    }
  }

  private coolTimes: { [key: string]: number } = {};
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

  // #region message handling

  private handleMessage(from: string, to: string, message: string) {
    if (from == "BanchoBot") {
      this.handleBanchoResponse(message);
    } else {
      const p = this.GetPlayer(from);
      if (p != null) {
        if (parser.IsCustomCommand(message)) {
          this.raiseReceivedCustomCommand(p, message);
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
        this.RaisePlayerJoined(c.params[0], c.params[1]);
        break;
      case BanchoResponseType.PlayerLeft:
        this.RaisePlayerLeft(c.params[0] as string);
        break;
      case BanchoResponseType.AbortedMatch:
        this.RaiseAbortedMatch();
        break;
      case BanchoResponseType.Unhandled:
        logger.debug("unhandled bancho response : %s", message);
        break;
    }
    this.RecievedBanchoResponse.emit({ message, response: c });
  }

  private raiseReceivedCustomCommand(player: Player, message: string): void {
    logger.trace("custom command %s:%s", player.id, message);
    const { command, param } = parser.ParseCustomCommand(message);
    const authority = this.getPlayerAuthority(player);
    if (command == "!info" || command == "!help") {
      this.showInfoMessage();
    }
    this.ReceivedCustomCommand.emit({ player, authority, command, param });
  }

  // #endregion

  // #region event handling

  RaisePlayerJoined(userid: string, slot: number, asHost: boolean = false): void {
    const player = this.GetOrMakePlayer(userid);
    if (!this.players.has(player)) {
      this.players.add(player);
      if (asHost) {
        this.host = player;
      }
      this.PlayerJoined.emit({ player, slot });
    } else {
      logger.warn("参加済みのプレイヤーが再度参加した: %s", userid);
      this.UnexpectedAction.emit(new Error("unexpected join"));
    }
  }

  RaisePlayerLeft(userid: string): void {
    const player = this.GetOrMakePlayer(userid);
    if (this.players.has(player)) {
      this.players.delete(player);
      if (this.host == player) {
        this.host = null;
      }
      if (this.hostPending == player) {
        this.hostPending = null;
      }
      if (this.isMatching) {
        this.playersInGame.delete(player);
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
    this.host = player;
    this.HostChanged.emit({ succeeded: true, player });
  }

  RaiseMatchStarted(): void {
    logger.info("match started");
    this.isMatching = true;
    this.playersInGame.clear();
    this.players.forEach(p => this.playersInGame.add(p));
    this.playersFinished.clear();
    this.MatchStarted.emit();
  }

  RaisePlayerFinished(userid: string, score: number, isPassed: boolean): void {
    const player = this.GetOrMakePlayer(userid);
    this.playersFinished.add(player);
    this.PlayerFinished.emit({ player, score, isPassed, playersFinished: this.playersFinished.size, playersInGame: this.playersInGame.size });
    if (!this.players.has(player)) {
      logger.info("未参加のプレイヤーがゲームを終えた: %s", userid);
      this.players.add(player);
      this.RaisePlayerJoined(userid, 0);
    }
  }

  RaiseMatchFinished(): void {
    logger.info("match finished");
    this.isMatching = false;
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch(): void {
    logger.info("match aborted %d / %d", this.playersFinished.size, this.playersInGame.size);
    this.isMatching = false;
    this.AbortedMatch.emit({ playersFinished: this.playersFinished.size, playersInGame: this.playersInGame.size });
  }

  RaiseNetError(err: Error): void {
    logger.error("error occured : " + err.message);
    logger.error(err.stack);
    this.NetError.emit(err);
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
      throw new Error("title が空です。");
    }
    if (this.status != LobbyStatus.Standby) {
      throw new Error("すでに部屋を作成済みです.");
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
      const onJoin = (channel: string, who: string) => {
        if (who == this.ircClient.nick) {
          this.channel = channel;
          this.name = title;
          this.id = channel.replace("#mp_", "");
          this.ircClient.off("join", onJoin);
          this.status = LobbyStatus.Entered;
          this.players.clear();
          resolve(this.id);
          logger.trace("completed makeLobby");
        }
      };
      this.ircClient.on("join", onJoin);
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
        this.channel = channel;
        this.name = "__";
        this.id = channel.replace("#mp_", "");
        this.status = LobbyStatus.Entered;
        this.players.clear();
        resolve(this.id);
        logger.trace("completed EnterLobby");
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
    this.name = parser.name;
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
      this.RaisePlayerJoined(v.id, v.slot, i == hostidx);
    });
  }

  // #endregion

  GetLobbyStatus(): string {
    let s = `=== lobby status ===
  lobby id : ${this.id}
  status : ${this.status}
  players : ${[...this.players].map(p => p.id).join(", ")}
  host : ${this.host ? this.host.id : "null"}, pending : ${this.hostPending ? this.hostPending.id : "null"}
`
      ;

    for (let p of this.plugins) {
      s += p.getPluginStatus();
    }
    return s;
  }

  private showInfoMessage(): void {
    if (this.SendMessageWithCoolTime("- Osu Auto Host Rotation Bot -", "infomessage", 30000)) {
      this.SendMessage("-  The host order is based on when you entered the lobby.");
      this.SendMessage("-  github : https://github.com/Meowhal/osu-ahr");
      this.SendMessage("- bot commands -");
      this.SendMessage("-  !info => show this message.");
      this.plugins.forEach(p => p.getInfoMessage().forEach(m => {
        this.SendMessage("-  " + m);
      }));
    } else {
      logger.trace("info cool time");
    }
  }

  // ircでログインしたユーザーに権限を与える
  private authorizeIrcUser() {
    if (!this.ircClient.nick) {
      this.ircClient.once("registered", () => {
        this.authorizeIrcUser();
      });
    } else if (!this.option.authorized_users.includes(this.ircClient.nick)) {
      if (!isArray(this.option.authorized_users)) {
        this.option.authorized_users = [];
      } else {
        this.option.authorized_users = Array.from(this.option.authorized_users);
      }
      this.option.authorized_users.push(this.ircClient.nick);
    }
  }

  private botOwnerCache: string | undefined;

  private getPlayerAuthority(player: Player): number {
    if (this.botOwnerCache == undefined) {
      this.botOwnerCache = getIrcConfig().nick;
    }
    if (this.option.authorized_users.includes(player.id)) {
      return 2;
    } else if (player == this.host) {
      return 1;
    } else {
      return 0;
    }
  }

}
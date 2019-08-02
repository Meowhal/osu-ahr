import { Player, escapeUserId } from "./Player";
import { ILobby, LobbyStatus } from "./ILobby";
import { parser, BanchoResponse, BanchoResponseType, PlayerFinishedParameter, PlayerJoinedParameter } from "./CommandParser";
import { IIrcClient } from "./IIrcClient";
import { TypedEvent } from "../libs/events";
import { MpSettingsParser, PlayerSettings } from "./MpSettingsParser";
import { getIrcConfig } from "../config";
import { LobbyPlugin } from "./LobbyPlugin";

export class Lobby implements ILobby {
  // Members
  host: Player | null;
  hostPending: Player | null;
  name: string | undefined;
  id: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  players: Set<Player>;
  ircClient: IIrcClient;
  playersMap: Map<string, Player>;
  isMatching: boolean;
  mpSettingParser: MpSettingsParser | undefined;
  plugins: LobbyPlugin[] = [];

  // Events
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; }>();
  PlayerLeft = new TypedEvent<Player>();
  BeatmapChanging = new TypedEvent<void>();
  BeatmapChanged = new TypedEvent<string>();
  HostChanged = new TypedEvent<{ succeeded: boolean, player: Player }>();
  UserNotFound = new TypedEvent<void>();
  MatchStarted = new TypedEvent<void>();
  PlayerFinished = new TypedEvent<{ player: Player; score: number; isPassed: boolean; }>();
  MatchFinished = new TypedEvent<void>();
  AbortedMatch = new TypedEvent<void>();
  UnexpectedAction = new TypedEvent<Error>();
  NetError = new TypedEvent<Error>();
  BanchoChated = new TypedEvent<{ message: string }>();
  PlayerChated = new TypedEvent<{ player: Player, authority: number, message: string }>();
  PluginMessage = new TypedEvent<{ type: string, args: string[], src: LobbyPlugin | null }>();

  constructor(ircClient: IIrcClient) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }
    this.status = LobbyStatus.Standby;
    this.players = new Set();
    this.playersMap = new Map();
    this.ircClient = ircClient;
    this.host = null;
    this.hostPending = null;
    this.isMatching = false;

    this.ircClient.on("message", (from, to, message) => {
      this.handleMessage(from, to, message);
    });
    this.ircClient.on("netError", (err: any) => {
      this.RaiseNetError(err);
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

  private handleMessage(from: string, to: string, message: string) {
    if (from == "BanchoBot" && to == this.channel) {
      this.handleBanchoResponse(message);
      this.BanchoChated.emit({ message });
    } else {
      const p = this.GetPlayer(from);
      if (p != null) {
        this.handlePlayerChat(p, message);
        this.PlayerChated.emit({ player: p, authority: this.getPlayerAuthority(p), message });
      }
    }
  }

  private handleBanchoResponse(message: string) {
    const c = parser.ParseBanchoResponse(message);
    switch (c.type) {
      case BanchoResponseType.BeatmapChanged:
        this.RaiseBeatmapChanged(c.param as string);
        break;
      case BanchoResponseType.BeatmapChanging:
        this.RaiseBeatmapChanging();
        break;
      case BanchoResponseType.HostChanged:
        this.RaiseHostChanged(c.param as string);
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
        let p = c.param as PlayerFinishedParameter;
        this.RaisePlayerFinished(p.id, p.score, p.isPassed);
        break;
      case BanchoResponseType.PlayerJoined:
        let q = c.param as PlayerJoinedParameter;
        this.RaisePlayerJoined(q.id, q.slot);
        break;
      case BanchoResponseType.PlayerLeft:
        this.RaisePlayerLeft(c.param as string);
        break;
      case BanchoResponseType.AbortedMatch:
        this.RaiseAbortedMatch();
        break;
      case BanchoResponseType.None:
      default:
        // log
        break;
    }
  }

  private handlePlayerChat(player: Player, message: string): void {
    if (message == "!info" || message == "!help") {
      this.SendMessage("--  Osu Auto Host Rotation Bot  --");
      this.SendMessage("!info => show this message.");
    }
  }

  private botOwnerCache: string | undefined;
  private getPlayerAuthority(player: Player): number {
    if (this.botOwnerCache == undefined) {
      this.botOwnerCache = getIrcConfig().nick;
    }
    if (player.id == this.botOwnerCache) {
      return 2;
    } else if (player == this.host) {
      return 1;
    } else {
      return 0;
    }
  }

  RaisePlayerJoined(userid: string, slot: number): void {
    const player = this.GetOrMakePlayer(userid);
    if (!this.players.has(player)) {
      this.players.add(player);
      this.PlayerJoined.emit({ player, slot });
    } else {
      this.UnexpectedAction.emit(new Error("すでに参加しているはずのプレイヤーが参加しました。"));
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
      this.PlayerLeft.emit(player);
    } else {
      this.UnexpectedAction.emit(new Error("未参加のプレイヤーが退出しました。"));
    }
  }

  RaiseBeatmapChanging(): void {
    this.BeatmapChanging.emit();
  }

  RaiseBeatmapChanged(mapid: string): void {
    this.BeatmapChanged.emit(mapid);
  }

  RaiseHostChanged(userid: string): void {
    const player = this.GetOrMakePlayer(userid);
    if (!this.players.has(player)) {
      // TODO:log 未参加のプレイヤーがホストになった
      this.players.add(player);
    }

    if (this.hostPending == this.host) {
      this.hostPending = null;
    } else if (this.hostPending != null) {
      // TODO:log pending中に別のユーザーがホストになった
    } // pending == null は有効
    this.host = player;
    this.HostChanged.emit({ succeeded: true, player });
  }

  RaiseMatchStarted(): void {
    this.isMatching = true;
    this.MatchStarted.emit();
  }

  RaisePlayerFinished(userid: string, score: number, isPassed: boolean): void {
    const player = this.GetOrMakePlayer(userid);
    this.PlayerFinished.emit({ player, score, isPassed });
    if (!this.players.has(player)) {
      //this.UnexpectedAction.emit(new Error("未参加のプレイヤーがゲームを終えました。"));
      this.players.add(player);
      this.RaisePlayerJoined(userid, 0);
    }
  }

  RaiseMatchFinished(): void {
    this.isMatching = false;
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch(): void {
    this.isMatching = false;
    this.AbortedMatch.emit();
  }

  RaiseNetError(err: Error): void {
    this.NetError.emit(err);
  }

  OnUserNotFound(): void {
    if (this.hostPending != null) {
      const p = this.hostPending;
      this.hostPending = null;
      this.HostChanged.emit({ succeeded: false, player: p });
    }
  }

  TransferHost(user: Player): void {
    this.hostPending = user; // TODO:失敗時の動作、ホスト対象者が応答待ちの間に抜けた場合
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
    }
  }

  MakeLobbyAsync(title: string): Promise<string> {
    if (title === "") {
      throw new Error("title が空です。");
    }
    if (this.status != LobbyStatus.Standby) {
      throw new Error("すでに部屋を作成済みです.");
    }
    this.status = LobbyStatus.Making;
    return new Promise<string>(resolve => {
      if (this.ircClient.hostMask != "") {
        this.makeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
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
          this.SendMessage("!mp password");
          this.SendMessage("!mp invite gnsksz");
          resolve(this.id);
        } else {
          reject("unexpected argument who : " + who);
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
    return new Promise<string>((resolve, reject) => {
      const onJoin = (channel: string, who: string) => {
        if (who == this.ircClient.nick) {
          this.channel = channel;
          this.name = "__";
          this.id = channel.replace("#mp_", "");
          this.ircClient.off("join", onJoin);
          this.status = LobbyStatus.Entered;
          this.players.clear();
          resolve(this.id);
        }
      };
      channel = parser.EnsureMpChannelId(channel);
      if (channel == "") {
        reject();
        return;
      }
      this.ircClient.on("join", onJoin);
      this.ircClient.join(channel);
    });
  }

  CloseLobbyAsync(): Promise<void> {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("閉じるロビーがありません。");
    }
    return new Promise<void>((resolve, reject) => {
      this.ircClient.once("part", (channel: string, nick: string) => {
        this.ircClient.disconnect("goodby", () => {
          resolve();
        });
      });
      if (this.channel != undefined) {
        this.SendMessage("!mp close");
      } else {
        reject();
      }
    });
  }

  LoadLobbySettingsAsync(): Promise<void> {
    if (this.status != LobbyStatus.Entered || this.mpSettingParser != undefined) {
      return Promise.reject();
    }
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

    const task = new Promise<void>(resolve => {
      completed = () => {
        this.ircClient.off("message", feed);
        if (this.mpSettingParser != null && this.mpSettingParser.parsed) {
          this.name = this.mpSettingParser.name as string;
          console.log("@ms update lobby name");
          for (let ps of this.mpSettingParser.players as PlayerSettings[]) {
            if (!this.Includes(ps.id)) {
              console.log("@ms update player");
              this.RaisePlayerJoined(ps.id, ps.slot);
            }
            if (ps.isHost) {
              if (this.host == null || (this.host.id != ps.id)) {
                console.log("@ms update host");
                this.RaiseHostChanged(ps.id);
              }
            }
          }
        }
        this.mpSettingParser = undefined;
        resolve();
      }
    });

    this.SendMessage("!mp settings");
    return task;
  }

  logLobbyStatus(): void {
    console.log(`=== lobby status ===
  lobby id : ${this.id}
  status : ${this.status}
  players : ${[...this.players].map(p => p.id).join(", ")};
`
    );

    for (let p of this.plugins) {
      console.log(p.getPluginStatus());
    }
  }
}
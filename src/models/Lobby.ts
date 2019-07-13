import { Player, escapeUserId } from "./Player";
import { ILobby, LobbyStatus } from "./ILobby";
import { CommandParser, BanchoResponse, BanchoResponseType } from "./CommandParser";
import { IIrcClient } from "./IIrcClient";
import { TypedEvent } from "../libs/events";
const BanchoHostMask: string = "osu!Bancho.";

export class Lobby implements ILobby {
  // Members
  host: Player | null;
  hostPending: Player | null;
  name: string | undefined;
  id: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  players: Set<Player>;
  parser: CommandParser;
  ircClient: IIrcClient;
  playersMap: Map<string, Player>;
  isMatching: boolean;

  // Events
  PlayerJoined = new TypedEvent<{ player: Player; slot: number; }>();
  PlayerLeft = new TypedEvent<Player>();
  BeatmapChanging = new TypedEvent<void>();
  BeatmapChanged = new TypedEvent<string>();
  HostChanged = new TypedEvent<{succeeded:boolean, player:Player}>();
  UserNotFound = new TypedEvent<void>();
  MatchStarted = new TypedEvent<void>();
  PlayerFinished = new TypedEvent<{ player: Player; score: number; isPassed: boolean; }>();
  MatchFinished = new TypedEvent<void>();
  AbortedMatch = new TypedEvent<void>();
  UnexpectedAction = new TypedEvent<Error>();
  NetError = new TypedEvent<Error>();

  constructor(ircClient: IIrcClient) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }
    this.status = LobbyStatus.Standby;
    this.players = new Set();
    this.playersMap = new Map();
    this.parser = new CommandParser();
    this.ircClient = ircClient;
    this.host = null;
    this.hostPending = null;
    this.isMatching = false;

    this.ircClient.on("message", (from, to, message) => {
      this.HandleBanchoResponse(from, to, message);
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

  HandleBanchoResponse(from: string, to: string, message: string) {
    if (from == "BanchoBot" && to == this.channel) {
      const c = this.parser.ParseBanchoResponse(message);
      switch (c.type) {
        case BanchoResponseType.BeatmapChanged:
          this.RaiseBeatmapChanged(c.id);
          break;
        case BanchoResponseType.BeatmapChanging:
          this.RaiseBeatmapChanging();
          break;
        case BanchoResponseType.HostChanged:
          this.RaiseHostChanged(c.id);
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
          this.RaisePlayerFinished(c.id, c.score, c.isPassed);
          break;
        case BanchoResponseType.PlayerJoined:
          this.RaisePlayerJoined(c.id, c.slot);
          break;
        case BanchoResponseType.PlayerLeft:
          this.RaisePlayerLeft(c.id);
          break;
        case BanchoResponseType.AbortedMatch:
          this.RaiseAbortedMatch();
          break;
        case BanchoResponseType.None:
        default:
          // log
          break;
      }
    } else {
      // log
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
    this.HostChanged.emit({succeeded : true, player});
  }

  RaiseMatchStarted(): void {
    this.isMatching = true;
    this.MatchStarted.emit();
  }

  RaisePlayerFinished(userid: string, score: number, isPassed: boolean) :void{
    const player = this.GetOrMakePlayer(userid);
    this.PlayerFinished.emit({ player, score, isPassed });
    if (!this.players.has(player)) {
      this.UnexpectedAction.emit(new Error("未参加のプレイヤーがゲームを終えました。"));
      this.players.add(player);
      this.RaisePlayerJoined(userid, 0);
    }
  }

  RaiseMatchFinished():void {
    this.isMatching = false;
    this.MatchFinished.emit();
  }

  RaiseAbortedMatch():void {
    this.AbortedMatch.emit();
  }

  RaiseNetError(err: Error):void {
    this.NetError.emit(err);
  }

  OnUserNotFound():void {
    if (this.hostPending != null) {
      const p = this.hostPending;
      this.hostPending = null;
      this.HostChanged.emit({succeeded : false, player: p});
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
      if (this.ircClient.hostMask == BanchoHostMask) {
        this.MakeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        this.ircClient.once("registered", () => {
          this.MakeLobbyAsyncCore(title).then(v => resolve(v));
        });
      }
    });
  }

  private MakeLobbyAsyncCore(title: string): Promise<string> {
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
        }
      };
      this.ircClient.on("join", onJoin);
      this.ircClient.say("BanchoBot", "!mp make " + title);
    });
  }

  EnterLobbyAsync(channel: string): Promise<void> {
    throw new Error("Method not implemented.");
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
}
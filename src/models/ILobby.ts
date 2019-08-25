import { Player } from "./Player";
import { TypedEvent } from "../libs/events";
import { LobbyPlugin } from "./LobbyPlugin";
export { Player }

// BanchoBotとの対話を抽象化する
// channelへの接続管理と、トーナメントコマンドの実行
// Make/Enter/LeaveはEvent形式ではなくasync/wait形式のほうがいい？
// Eventは文字列指定のため、一覧をインターフェースに含めることができない！
export interface ILobby {
  name: string | undefined;
  id: string | undefined;
  status: LobbyStatus;
  players: Set<Player>;
  host: Player | null;
  hostPending: Player | null;
  playersMap: Map<string, Player>;
  isMatching: boolean;
  plugins: LobbyPlugin[];

  GetPlayer(userid: string): Player | null;
  Includes(userid: string): boolean;

  TransferHost(user: Player): void;
  AbortMatch(): void;
  SendMessage(message: string): void;
  SendMessageWithCoolTime(message: string | (() => string), tag: string, cooltime: number): boolean;

  MakeLobbyAsync(title: string): Promise<string>;
  EnterLobbyAsync(channel: string): Promise<string>; // TODO:ロビーのチャンネルが存在しないときの処理
  CloseLobbyAsync(): Promise<void>;
  LoadLobbySettingsAsync(): Promise<void>;

  PlayerJoined: TypedEvent<{ player: Player, slot: number }>;
  PlayerLeft: TypedEvent<Player>;
  BeatmapChanging: TypedEvent<void>;
  BeatmapChanged: TypedEvent<string>;
  HostChanged: TypedEvent<{ succeeded: boolean, player: Player }>;
  MatchStarted: TypedEvent<void>;
  PlayerFinished: TypedEvent<{ player: Player, score: number, isPassed: boolean }>;
  MatchFinished: TypedEvent<void>;
  AbortedMatch: TypedEvent<{ playersFinished: number, playersInGame: number }>;
  AllPlayerReady: TypedEvent<void>;
  UnexpectedAction: TypedEvent<Error>;
  NetError: TypedEvent<Error>;
  BanchoChated: TypedEvent<{ message: string }>;
  PlayerChated: TypedEvent<{ player: Player, message: string }>;
  ReceivedCustomCommand: TypedEvent<{ player: Player, authority: number, command: string, param: string }>;
  PluginMessage: TypedEvent<{ type: string, args: string[], src: LobbyPlugin | null }>;
}

export enum LobbyStatus {
  Standby,
  Making,
  Made,
  Entering,
  Entered,
  Leaving,
  Left
}
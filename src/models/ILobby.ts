import { Player } from "./Player";
export { Player }

// BanchoBotとの対話を抽象化する
// channelへの接続管理と、トーナメントコマンドの実行
// Make/Enter/LLeaveはEvent形式ではなくasync/wait形式のほうがいい？
// Eventは文字列指定のため、一覧をインターフェースに含めることができない！
export interface ILobby {
  name: string | undefined;
  id: string | undefined;
  status: LobbyStatus;
  players: Set<Player>;
  host: Player | null;
  hostPending: Player | null;

  SendMpHost(user: Player): void;
  SendMpAbort(): void;
  SendMessage(message: string): void;

  MakeLobbyAsync(title: string): Promise<string>;
  EnterLobbyAsync(channel: string): Promise<void>; // TODO:ロビーのチャンネルが存在しないときの処理
  CloseLobbyAsync(): Promise<void>;

  // events
  // PlayerJoined(player, slotid), 
  // PlayerLeft(player), 
  // BeatmapChanging(),
  // BeatmapChanged(mapid), 
  // HostChanged(player), 
  // MatchStarted()
  // PlayerFinished(player, score, isPassed)
  // MatchFinished()
  // NetError(err) 
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
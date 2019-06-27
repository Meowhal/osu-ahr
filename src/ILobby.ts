
// BanchoBotとの対話を抽象化する
// channelへの接続管理と、トーナメントコマンドの実行
// Make/Enter/LLeaveはEvent形式ではなくasync/wait形式のほうがいい？
// Eventは文字列指定のため、一覧をインターフェースに含めることができない！

export interface ILobby {
  name: string | undefined;
  id: string | undefined;
  status: LobbyStatus;

  SendMpHost(userid: string): void;
  SendMpAbort(): void;
  SendMpClose(): void;
  SendMessage(message: string): void;

  MakeLobbyAsync(title: string): Promise<string>;
  EnterLobbyAsync(channel: string): Promise<void>; // TODO:ロビーのチャンネルが存在しないときの処理
  LeaveLobbyAsync(): Promise<void>;

  // events
  // LobbyMade(lobbyid), 
  // LobbyEntered(),
  // PlayerJoined(userid, slotid), 
  // PlayerLeft(userid), 
  // BeatmapSelected(mapid), 
  // HostChanged(userid), 
  // MatchStarted()
  // PlayerFinished(userid, score)
  // MatchFinished()
  // LobbyClosed(err) 
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
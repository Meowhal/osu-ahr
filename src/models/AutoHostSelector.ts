import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { IHostSelector } from "./IHostSelector";

export interface AutoHostSelectorOption {

}

/*
  ホストキューの先頭は実際に次のホストが確定したときに一番うしろに移動する
  遷移

  current host => ch
  next host => nh
  host pending => ph

  !mp hostコマンド発行
    ph = p;
  bancho response
    check ph == p
    ch = queue.pop()
    check ch == p == ph
    nh = queue.peek()
    ph = null

*/

export class AutoHostSelector implements IHostSelector {
  currentHost: Player | null = null;
  isMatching: boolean = false;
  lobby: ILobby;
  option: AutoHostSelectorOption;

  hostQueue: Player[] = [];
  hostPending: Player | null = null;

  constructor(lobby: ILobby, option: AutoHostSelectorOption) {
    this.lobby = lobby;
    this.option = option;
    this.registerEvents();
  }

  registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.succeeded, a.player));
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
  }

  // プレイヤーが参加した際に実行される
  // 参加したプレイヤーはホストの順番待ちキューに追加される
  // 現在部屋に誰もいない場合はホストに任命
  private onPlayerJoined(player: Player, slot: number): void {
    this.hostQueue.push(player);
    if (this.lobby.players.size == 1) {
      this.selectNextHost();
    }
  }

  // プレイヤーが退室した際に実行される
  // キューから削除
  // 現在のホストなら次のホストを任命
  // ホスト任命中に退出した場合も次のホストを任命
  private onPlayerLeft(player: Player): void {
    this.removeFromQueue(player);
    if (this.currentHost == player || this.hostPending == player) {
      this.selectNextHost();
    }
  }

  // ホストが実際に変更された際に実行される
  // !mphostで指定したホストならok
  // ユーザーが自分でホストを変更した場合
  //  queueの次のホストならそのまま
  //  順番を無視していたら任命し直す
  private onHostChanged(succeeded: boolean, player: Player): void {
    if (!succeeded) return; // 存在しないユーザーを指定した場合は無視する
    
    if (this.hostQueue[0] == player) {      
      // キューの順番通りに次のホストが選択された場合
      this.hostPending = null;
      this.hostQueue.shift();
      this.hostQueue.push(player);
      this.currentHost = player;
    } else {
      this.selectNextHost();
    }
  }

  // 試合が終了した際に実行される
  // 次のホストの任命
  private onMatchFinished(): void {
    this.selectNextHost();
  }

  // !mp host コマンドの発行
  // hostPendingに変更中のユーザーを保存する
  // 変更中から確定までの間にユーザーが抜ける可能性を考慮する必要がある
  private selectNextHost() {
    this.hostPending = this.hostQueue[0];
    this.lobby.TransferHost(this.hostPending);
  }

  // 指定されたプレイヤーキューから削除する
  // キューに存在しなかった場合はfalseを返す
  private removeFromQueue(player: Player): boolean {
    const i = this.hostQueue.indexOf(player);
    if (i != -1) {
      this.hostQueue.splice(i, 1);
      return true;
    } else {
      return false;
    }
  }

}
import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { IHostSelector } from "./IHostSelector";

export interface AutoHostSelectorOption {

}

export class AutoHostSelector implements IHostSelector {
  lobby: ILobby;
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];

  get currentHost() {
    return this.lobby.host;
  }

  get pendingHost() {
    return this.lobby.hostPending;
  }

  constructor(lobby: ILobby, option: AutoHostSelectorOption | null = null) {
    this.lobby = lobby;
    if (option == null) {
      option = {};
    }
    this.option = option;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.succeeded, a.player));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
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
  // 試合中なら次のホストは任命しない
  private onPlayerLeft(player: Player): void {
    this.removeFromQueue(player);
    if (this.lobby.isMatching) return;
    if (this.hostQueue.length == 0) return;
    if (this.lobby.host == player // ホストが抜けた場合 
      || (this.lobby.host == null && this.lobby.hostPending == null)) { // ホストがいない、かつ承認待ちのホストがいない
      this.selectNextHost();
    }
  }

  // ホストが実際に変更された際に実行される
  // !mphostで指定したホストならok
  // ユーザーが自分でホストを変更した場合
  //  queueの次のホストならそのまま
  //  順番を無視していたら任命し直す
  private onHostChanged(succeeded: boolean, newhost: Player): void {
    if (!succeeded) return; // 存在しないユーザーを指定した場合は無視する
    if (this.lobby.isMatching) return; // 試合中は何もしない

    // ホストが自分で変更した場合
    if (this.hostQueue[0] != newhost) {
      this.selectNextHost();
    }
  }

  private onMatchStarted(): void {
  }

  // 試合が終了した際に実行される
  // 次のホストの任命
  private onMatchFinished(): void {
    this.selectNextHost();
  }

  // !mp host コマンドの発行
  // 変更中から確定までの間にユーザーが抜ける可能性を考慮する必要がある
  // キューの先頭を末尾に
  private selectNextHost() {
    if (this.hostQueue.length == 0) {
      throw new Error();
    }

    this.rotateQueue();
    if (this.hostQueue[0] != this.lobby.host) {
      this.lobby.TransferHost(this.hostQueue[0]);
    }
  }

  private rotateQueue() {
    const current = this.hostQueue.shift() as Player;
    this.hostQueue.push(current);
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
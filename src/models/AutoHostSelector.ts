import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { LobbyPlugin } from "./LobbyPlugin";

export interface AutoHostSelectorOption {

}

export const AutoHostSelectorDefaultOption = {
};

export class AutoHostSelector extends LobbyPlugin {
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];
  hostPending: Player | undefined;

  get currentHost() {
    return this.lobby.host;
  }

  constructor(lobby: ILobby, option: AutoHostSelectorOption | any | null = null) {
    super(lobby);
    this.option = { ...AutoHostSelectorDefaultOption, ...option } as AutoHostSelectorOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.succeeded, a.player));
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
    this.lobby.PlayerChated.on(a => this.onPlayerChated(a.player, a.authority, a.message));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
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
    if (this.hostQueue[0] != newhost && this.hostPending != newhost) {
      this.selectNextHost();
      return;
    }
  }

  // 試合が終了した際に実行される
  // 次のホストの任命
  private onMatchFinished(): void {
    this.selectNextHost();
  }

  private onPlayerChated(player: Player, auth: number, message: string): void {
    if (message == "!info" || message == "!help") {
      this.lobby.SendMessage("!queue => show host queue.");
      return;
    }

    if (message == "!queue" || message == "!que" || message == "!queu") {
      const m = this.hostQueue.reduce((p, c) => `${p}, ${this.escapeUserId(c.id)}`, "");
      this.lobby.SendMessage("queue " + m);
      return;
    }
  }

  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type == "skip") {
      this.selectNextHost();
    }
  }

  // ユーザーIDを表示するときhighlightされないように名前を変更する
  private escapeUserId(userid: string): string {
    return userid[0] + "\u{200B}" + userid.substring(1);
  }

  // !mp host コマンドの発行
  // 変更中から確定までの間にユーザーが抜ける可能性を考慮する必要がある
  // キューの先頭を末尾に
  private selectNextHost(): void {
    if (this.hostQueue.length == 0) {
      throw new Error();
    }

    this.rotateQueue();
    if (this.hostQueue[0] != this.lobby.host) {
      this.hostPending = this.hostQueue[0];
      this.lobby.TransferHost(this.hostQueue[0]);
    }
  }

  private rotateQueue(): void {
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

  getPluginStatus(): string {
    const m = this.hostQueue.map(p => this.escapeUserId(p.id)).join(", ");
    return `-- AutoHostSelector --
  current host queue
    ${m}
`;
  }
}
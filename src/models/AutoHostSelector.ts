import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { LobbyPlugin } from "./LobbyPlugin";
import log4js from "log4js";
const logger = log4js.getLogger("autoHostSelector");

export interface AutoHostSelectorOption {

}

export const AutoHostSelectorDefaultOption = {
};

export class AutoHostSelector extends LobbyPlugin {
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];
  isMatchAborted: boolean = false; // abortによる中断でホストの入れ替えが必要ない場合にtrueになる

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
    this.lobby.MatchStarted.on(a => this.onMatchStarted());
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.authority, a.command, a.param));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
    this.lobby.AbortedMatch.on(a => this.onMatchAborted(a.playersFinished, a.playersInGame));
  }

  // プレイヤーが参加した際に実行される
  // 参加したプレイヤーはホストの順番待ちキューに追加される
  // 現在部屋に誰もいない場合はホストに任命
  private onPlayerJoined(player: Player, slot: number): void {
    this.hostQueue.push(player);
    logger.trace("added %s to hostqueue", player.id);
    if (this.lobby.players.size == 1) {
      logger.trace("appoint first player to host");
      this.changeHost();
    }
  }

  // プレイヤーが退室した際に実行される
  // キューから削除
  // 現在のホストなら次のホストを任命
  // ホスト任命中に退出した場合も次のホストを任命
  // 試合中なら次のホストは任命しない
  private onPlayerLeft(player: Player): void {
    this.removeFromQueue(player); // キューの先頭がホストならここで取り除かれるのでローテーションは不要になる
    if (this.lobby.isMatching) return;
    if (this.hostQueue.length == 0) return;
    if (this.lobby.host == null && this.lobby.hostPending == null) { // ホストがいない、かつ承認待ちのホストがいない
      logger.info("host has left");
      this.changeHost();
    }
  }

  // ホストが実際に変更された際に実行される
  // !mphostで指定したホストならok
  // ユーザーが自分でホストを変更した場合
  //  queueの次のホストならそのまま
  //  順番を無視していたら任命し直す
  private onHostChanged(succeeded: boolean, newhost: Player): void {
    if (!succeeded) return; // 存在しないユーザーを指定した場合は無視する(player left eventで対応)
    if (this.lobby.isMatching) return; // 試合中は何もしない

    if (this.hostQueue[0] == newhost) {
      logger.trace("A new host has been appointed:%s", newhost.id);
    } else {
      // ホストがキューの先頭以外に変更された場合
      this.rotateQueue();
      this.changeHost();
    }
  }

  // 試合が始まったらキューを回す
  private onMatchStarted(): void {
    if (this.isMatchAborted) {
      logger.trace("on match rotation skipped. isMatchAborted flag was true");
      this.isMatchAborted = false;
    } else {
      this.rotateQueue();
    }
  }

  // 試合が終了したら現在のキューの先頭をホストに任命
  private onMatchFinished(): void {
    this.isMatchAborted = false;
    this.changeHost();
  }

  private onCustomCommand(player: Player, auth: number, command: string, param: string): void {
    if (command.startsWith("!q")) {
      this.showHostQueue();
    }
  }

  private showHostQueue(): void {
    this.lobby.SendMessageWithCoolTime(() => {
      const m = this.hostQueue.map(c => this.escapeUserId(c.id)).join(", ");
      logger.trace(m);
      return "host queue : " + m;
    }, "!queue", 30000);
  }

  // 別のプラグインからskipの要請があった場合に実行する
  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type == "skip") {
      this.doSkip();
    } else if (type == "skipto") {
      this.doSkipTo(args);
    }
  }

  private onMatchAborted(playersFinished: number, playersInGame: number) {
    if (playersFinished != 0) { // 誰か一人でも試合終了している場合は通常の終了処理
      logger.info("match aborted after some Players Finished. call normal match finish process");
      this.onMatchFinished();
    } else { // 誰も終了していない場合はローテーションしないモードへ
      this.isMatchAborted = true;
      logger.info("match aborted before some Players Finished. this.isMatchAborted set true");
      this.lobby.SendMessage("bot : Match Aborted. restart match or !skip current host.");
    }
  }

  private doSkip(): void {
    logger.trace("recieved plugin message skip");
    this.rotateQueue();
    this.changeHost();
  }

  private doSkipTo(args: string[]): void {
    logger.trace("recieved plugin message skipto");
    if (args.length != 1) {
      logger.error("skipto invalid arguments length");
      return;
    }
    const to = args[0];
    if (!this.lobby.Includes(to)) {
      logger.error("skipto target dosent exist");
      return;
    }
    let c = 0;
    while (this.hostQueue[0].id != to) {
      this.rotateQueue();
      if (c++ > 16) {
        logger.error("infinity loop detected");
        return;
      }
    }
    this.changeHost();
  }

  // ユーザーIDを表示するときhighlightされないように名前を変更する
  private escapeUserId(userid: string): string {
    return userid[0] + "\u{200B}" + userid.substring(1);
  }

  // !mp host コマンドの発行
  // 現在のキューの先頭をホストに任命
  // すでに先頭がホストの場合は何もしない
  // 変更中から確定までの間にユーザーが抜ける可能性を考慮する必要がある
  // キューの先頭を末尾に
  private changeHost(): void {
    if (this.hostQueue.length == 0) {
      logger.warn("selectNextHost is called when host queue is empty");
      return;
    }
    if (this.hostQueue[0] != this.lobby.host) {
      this.lobby.TransferHost(this.hostQueue[0]);
      logger.trace("sent !mp host %s", this.hostQueue[0].id);
    } else {
      logger.trace("%s is already host", this.hostQueue[0].id);
    }
  }

  // ホストキューの先頭を末尾に付け替える
  private rotateQueue(): void {
    const current = this.hostQueue.shift() as Player;
    this.hostQueue.push(current);
    if (logger.isTraceEnabled) {
      logger.trace("rotated host queue: %s", this.hostQueue.map(p => p.id).join(", "));
    }
  }

  // 指定されたプレイヤーキューから削除する
  // キューに存在しなかった場合はfalseを返す
  private removeFromQueue(player: Player): boolean {
    const i = this.hostQueue.indexOf(player);
    if (i != -1) {
      this.hostQueue.splice(i, 1);
      logger.trace("removed %s from host queue", player.id);
      return true;
    } else {
      logger.error("removed ghost player");
      return false;
    }
  }

  getPluginStatus(): string {
    const m = this.hostQueue.map(p => p.id).join(", ");
    return `-- AutoHostSelector --
  current host queue
    ${m}
  is Match Aborted : ${this.isMatchAborted}
  `;
  }

  getInfoMessage(): string[] {
    return ["!queue => show host queue."]
  }
}
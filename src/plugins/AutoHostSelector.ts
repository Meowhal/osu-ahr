import { Lobby } from "..";
import { Player, escapeUserId } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import { BanchoResponseType, MpSettingsResult } from "../parsers";

export interface AutoHostSelectorOption {
  show_queue_chars_limit: number;
  show_queue_cooltime_ms: number;
}

const DefaultOption = config.get<AutoHostSelectorOption>("AutoHostSelector");

export class AutoHostSelector extends LobbyPlugin {
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];
  needsRotate: boolean = true;
  mapChanger: Player | null = null;

  constructor(lobby: Lobby, option: Partial<AutoHostSelectorOption> = {}) {
    super(lobby, "selector");
    this.option = { ...DefaultOption, ...option } as AutoHostSelectorOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.command, a.param));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
    this.lobby.AbortedMatch.on(a => this.onMatchAborted(a.playersFinished, a.playersInGame));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.RecievedBanchoResponse.on(a => {
      if (a.response.type == BanchoResponseType.BeatmapChanging) {
        this.onBeatmapChanging()
      }
    });
  }

  // プレイヤーが参加した際に実行される
  // 参加したプレイヤーはホストの順番待ちキューに追加される
  // 現在部屋に誰もいない場合はホストに任命
  private onPlayerJoined(player: Player, slot: number): void {
    this.hostQueue.push(player);
    this.logger.trace("added %s to hostqueue", player.id);
    if (this.lobby.players.size == 1) {
      this.logger.trace("appoint first player to host");
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
      this.logger.info("host has left");
      this.changeHost();
    }
  }

  // ホストが実際に変更された際に実行される
  // !mphostで指定したホストならok
  // ユーザーが自分でホストを変更した場合
  // queueの次のホストならそのまま
  // 順番を無視していたら任命し直す
  private onHostChanged(newhost: Player): void {
    if (this.lobby.isMatching) return; // 試合中は何もしない

    if (this.hostQueue[0] == newhost) {
      this.logger.trace("A new host has been appointed:%s", newhost.id);

      if (this.mapChanger != null && this.mapChanger != newhost) { // 前任のホストがマップを変更している
        this.needsRotate = false;
        this.logger.info("host is appointed after map change");
      }
    } else {
      // ホストがキューの先頭以外に変更された場合
      this.logger.trace("host may have manually changed by the host");
      this.rotateQueue();
      this.changeHost();
    }
  }

  private onBeatmapChanging(): void {
    if (this.hostQueue[0] != this.lobby.host) {
      // アボートで中断後にマップ変更しようとした場合は次のホストに変更
      this.changeHost();
      this.needsRotate = false;
    } else {
      // マップを変更した
      this.needsRotate = true;
      this.mapChanger = this.lobby.host;
    }
  }

  // 試合が始まったらキューを回す
  private onMatchStarted(): void {
    if (this.needsRotate) {
      this.rotateQueue();
    } else {
      this.logger.info("@onMatchStarted rotation skipped.");
    }
  }

  // 試合が終了したら現在のキューの先頭をホストに任命
  private onMatchFinished(): void {
    this.needsRotate = true;
    this.mapChanger = null;
    this.changeHost();
  }

  private onMatchAborted(playersFinished: number, playersInGame: number) {
    if (playersFinished != 0) { // 誰か一人でも試合終了している場合は通常の終了処理
      this.logger.info("The match was aborted after several players were Finished. call normal match finish process");
      this.onMatchFinished();
    } else {
      if (this.lobby.host != null) {
        // 誰も終了していない場合は試合再開許可モードへ
        this.needsRotate = false;
        this.logger.info("The match was aborted before any Player Finished.");
      } else {
        // ホストがいない状態で試合が中断されたら、
        this.logger.info("The match was aborted after the host left.");
        this.changeHost();
      }
    }
  }

  onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): any {
    this.lobby.SendMessage("The host queue was rearranged. You can check the current order with !queue command.");
  }

  private onCustomCommand(player: Player, command: string, param: string): void {
    if (command.startsWith("!q")) {
      this.showHostQueue();
    }
  }

  private showHostQueue(): void {
    this.lobby.SendMessageWithCoolTime(() => {
      let m = this.hostQueue.map(c => this.escapeUserId(c.id)).join(", ");
      this.logger.trace(m);
      if (this.option.show_queue_chars_limit < m.length) {
        m = m.substring(0, this.option.show_queue_chars_limit) + "...";
      }
      return "host queue : " + m;
    }, "!queue", this.option.show_queue_cooltime_ms);
  }

  // 別のプラグインからskipの要請があった場合に実行する
  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type == "skip") {
      this.doSkip();
    } else if (type == "skipto") {
      this.doSkipTo(args);
    }
  }

  private doSkip(): void {
    this.logger.trace("recieved plugin message skip");
    this.rotateQueue();
    this.changeHost();
  }

  private doSkipTo(args: string[]): void {
    this.logger.trace("recieved plugin message skipto");
    if (args.length != 1) {
      this.logger.error("skipto invalid arguments length");
      return;
    }
    const to = escapeUserId(args[0]);
    if (!this.lobby.Includes(to)) {
      this.logger.error("skipto target dosent exist");
      return;
    }
    let c = 0;
    while (this.hostQueue[0].escaped_id != to) {
      this.rotateQueue();
      if (c++ > 16) {
        this.logger.error("infinity loop detected");
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
      this.logger.warn("selectNextHost is called when host queue is empty");
      return;
    }
    if (this.hostQueue[0] != this.lobby.host) {
      this.lobby.TransferHost(this.hostQueue[0]);
      this.logger.trace("sent !mp host %s", this.hostQueue[0].id);
    } else {
      this.logger.trace("%s is already host", this.hostQueue[0].id);
    }
  }

  // ホストキューの先頭を末尾に付け替える
  private rotateQueue(): void {
    const current = this.hostQueue.shift() as Player;
    this.hostQueue.push(current);
    if (this.logger.isTraceEnabled) {
      this.logger.trace("rotated host queue: %s", this.hostQueue.map(p => p.id).join(", "));
    }
  }

  // 指定されたプレイヤーキューから削除する
  // キューに存在しなかった場合はfalseを返す
  private removeFromQueue(player: Player): boolean {
    const i = this.hostQueue.indexOf(player);
    if (i != -1) {
      this.hostQueue.splice(i, 1);
      this.logger.trace("removed %s from host queue", player.id);
      return true;
    } else {
      this.logger.error("removed ghost player");
      return false;
    }
  }

  getPluginStatus(): string {
    const m = this.hostQueue.map(p => p.id).join(", ");
    return `-- AutoHostSelector --
  current host queue
    ${m}
  map changer : ${this.mapChanger == null ? "null" : this.mapChanger.id}
  needsRotate : ${this.needsRotate}`;
  }

  getInfoMessage(): string[] {
    return ["!queue => show host queue."]
  }
}
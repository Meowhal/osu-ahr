import { Lobby } from "..";
import { BanchoResponseType, MpSettingsResult } from "../parsers";
import { Player, revealUserId, disguiseUserId } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";

export interface AutoHostSelectorOption {
  show_queue_chars_limit: number;
  show_queue_cooltime_ms: number;
}

export class AutoHostSelector extends LobbyPlugin {
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];
  needsRotate: boolean = true;
  mapChanger: Player | null = null;

  constructor(lobby: Lobby, option: Partial<AutoHostSelectorOption> = {}) {
    super(lobby, "selector");
    const d = config.get<AutoHostSelectorOption>("AutoHostSelector");
    this.option = { ...d, ...option } as AutoHostSelectorOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
    this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
    this.lobby.AbortedMatch.on(a => this.onMatchAborted(a.playersFinished, a.playersInGame));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.ReceivedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.BeatmapChanging:
          this.onBeatmapChanging()
          break;
        case BanchoResponseType.MatchStarted:
          this.onMatchStarted();
          break;
        case BanchoResponseType.MatchFinished:
          this.onMatchFinished();
          break;
      }
    });
  }

  /**
   * 参加したプレイヤーはホストの順番待ちキューに追加される
   * 現在部屋に誰もいない場合はホストに任命
   * @param player 
   * @param slot 
   */
  private onPlayerJoined(player: Player, slot: number): void {
    this.hostQueue.push(player);
    this.logger.trace("added %s to hostqueue", player.id);
    if (this.lobby.players.size == 1) {
      this.logger.trace("appoint first player to host");
      this.changeHost();
    }
  }

  /**
   * キューから削除
   * 現在のホストなら次のホストを任命
   * ホスト任命中に退出した場合も次のホストを任命
   * 試合中なら次のホストは任命しない
   * @param player 
   */
  private onPlayerLeft(player: Player): void {
    this.removeFromQueue(player); // キューの先頭がホストならここで取り除かれるのでローテーションは不要になる
    if (this.lobby.isMatching) return;
    if (this.hostQueue.length == 0) return;
    if (this.lobby.host == null && this.lobby.hostPending == null && !this.lobby.isClearedHost) { // ホストがいない、かつ承認待ちのホストがいない、!mp clearhostが実行されていない
      this.logger.info("host has left");
      this.changeHost();
    }
  }

  /**
   * !mphostで指定したホストなら受け入れる
   * ユーザーが自分でホストを変更した場合
   * queueの次のホストならそのまま
   * 順番を無視していたら任命し直す
   * @param newhost 
   */
  private onHostChanged(newhost: Player): void {
    if (this.lobby.isMatching) return; // 試合中は何もしない

    if (this.hostQueue[0] == newhost) {
      this.logger.trace("a new host has been appointed:%s", newhost.id);

      if (this.mapChanger != null && this.mapChanger != newhost) { // 前任のホストがマップを変更している
        this.needsRotate = false;
        this.logger.info("host is appointed after map change");
      }
    } else {
      // ホストがキューの先頭以外に変更された場合
      this.logger.trace("host may have manually changed by the host");
      if (this.lobby.hostPending != this.hostQueue[0]) {
        this.rotateQueue();
      }
      this.changeHost();
    }
  }

  /**
   * マップ変更者の記録と!abort後にマップ変更しようとしたホストのスキップ
   */
  private onBeatmapChanging(): void {
    if (this.hostQueue[0] != this.lobby.host) {
      // アボートで中断後にマップ変更しようとした場合は次のホストに変更
      this.logger.info("host changed map after abort the match");
      this.changeHost();
      this.needsRotate = false;
    } else {
      // マップを変更した
      this.needsRotate = true;
      this.mapChanger = this.lobby.host;
    }
  }

  /**
   * 試合が始まったらキューを回す
   */
  private onMatchStarted(): void {
    if (this.needsRotate) {
      this.rotateQueue();
    } else {
      this.logger.info("@onMatchStarted rotation skipped.");
    }
  }

  /**
   * 試合が終了したら現在のキューの先頭をホストに任命
   */
  private onMatchFinished(): void {
    this.needsRotate = true;
    this.mapChanger = null;
    this.changeHost();
  }

  private onMatchAborted(playersFinished: number, playersInGame: number): void {
    if (playersFinished != 0) { // 誰か一人でも試合終了している場合は通常の終了処理
      this.logger.info("The match was aborted after several players were Finished. call normal match finish process");
      this.onMatchFinished();
    } else {
      if (this.lobby.host != null) {
        // 誰も終了していない場合は試合再開許可モードへ
        this.needsRotate = false;
        this.logger.info("The match was aborted before any Player Finished.");
      } else {
        // ホストがいない状態で試合が中断されたら
        this.logger.info("The match was aborted after the host left.");
        this.changeHost();
      }
    }
  }

  /**
   * mp settingsの結果をもとにキューを再構築する
   * 現在のキューを維持しつつ、プレイヤーの出入りを反映させる
   * 現在のキューに存在しないプレイヤーがホストになった場合、キューを１から再構築する
   * @param result 
   * @param playersIn 
   * @param playersOut 
   * @param hostChanged 
   */
  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    if (this.lobby.host == null) {
      this.hostQueue = [];
    }
    if (this.hostQueue.length == 0 || this.lobby.host == null || !this.hostQueue.includes(this.lobby.host)) {
      // キューが空、ホストがいない、ホストが新しく入った人の場合はスロットベースで再構築する
      this.OrderBySlotBase(result);
    } else {
      // 少人数が出入りしただけとみなし、現在のキューを維持する
      let newQueue = this.hostQueue.filter(p => !playersOut.includes(p));
      for (let p of playersIn) {
        newQueue.push(p);
      }

      if (this.validateNewQueue(newQueue)) {
        this.logger.info("modified host queue.");
        this.hostQueue = newQueue;
        this.SkipTo(this.lobby.host);
      } else {
        this.logger.warn("failed to modified the host queue.");
        this.OrderBySlotBase(result);
      }
    }
    // this.lobby.SendMessage("The host queue was rearranged. You can check the current order with !queue command.");
  }

  private onChatCommand(player: Player, command: string, param: string): void {
    if (command.startsWith("!q")) {
      this.ShowHostQueue();
    } else if (player.isAuthorized) {
      if (command == "*reorder" || command == "*order") {
        if (param != "") {
          this.Reorder(param);
        }
      }
    }
  }

  // 別のプラグインからskipの要請があった場合に実行する
  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type == "skip") {
      this.Skip();
    } else if (type == "skipto") {
      this.logger.trace("received plugin message skipto");
      if (args.length != 1) {
        this.logger.error("skipto invalid arguments length");
        return;
      }
      const to = this.lobby.GetOrMakePlayer(args[0]);
      if (!this.lobby.players.has(to)) {
        this.logger.error("skipto target dosent exist");
        return;
      }
      this.SkipTo(to);
    }
  }

  /**
   * MpSettingsの結果をもとに、ロビーのスロット順にキューを構成しなおす
   * @param result 
   */
  OrderBySlotBase(result: MpSettingsResult): void {
    this.logger.info("reordered slot base order.");
    this.hostQueue = result.players.map(r => this.lobby.GetOrMakePlayer(r.id));
    if (this.lobby.host != null) {
      this.SkipTo(this.lobby.host);
    } else {
      // hostがいない場合は先頭へ
      this.changeHost();
    }
  }

  /**
   * 現在のホストキューをロビーチャットに投稿する
   * IDはチャットのhighlightに引っかからないように加工される
   */
  ShowHostQueue(): void {
    this.lobby.SendMessageWithCoolTime(() => {
      let m = this.hostQueue.map(c => disguiseUserId(c.id)).join(", ");
      this.logger.trace(m);
      if (this.option.show_queue_chars_limit < m.length) {
        m = m.substring(0, this.option.show_queue_chars_limit) + "...";
      }
      return "host queue : " + m;
    }, "!queue", this.option.show_queue_cooltime_ms);
  }

  /**
   * 強制ローテーション
   */
  Skip(): void {
    this.logger.trace("received plugin message skip");
    this.rotateQueue();
    this.changeHost();
  }

  /**
   * 指定ユーザーまでスキップ
   * 順番は維持される
   * @param to 
   */
  SkipTo(to: string | Player): void {
    let trg: Player;
    if (typeof to == "string") {
      trg = this.lobby.GetOrMakePlayer(to);
    } else {
      trg = to;
    }
    let c = 0;
    while (this.hostQueue[0] != trg) {
      this.rotateQueue(false);
      if (c++ > 16) {
        this.logger.error("infinity loop detected");
        return;
      }
    }
    if (this.logger.isTraceEnabled) {
      this.logger.trace("skipto: %s", this.hostQueue.map(p => p.id).join(", "));
    }
    this.changeHost();
  }

  /**
   * キューを指定した順番に並び替える
   * @param order 
   */
  Reorder(order: Player[] | string): void {
    if (typeof (order) == "string") {
      const players = order.split(",").map(t => this.lobby.GetPlayer(revealUserId(t.trim()))).filter(p => p != null) as Player[];
      if (players.length == 0) {
        this.logger.info("Faild reorder, invalid order string : %s", order);
      } else {
        this.Reorder(players);
      }
    } else {
      const nq = order.filter(p => this.lobby.players.has(p));
      for (let p of this.hostQueue) {
        if (!nq.includes(p)) {
          nq.push(p);
        }
      }
      if (this.validateNewQueue(nq)) {
        this.logger.info("reordered host queue.");
        this.hostQueue = nq;
        this.changeHost();
      } else {
        this.logger.info("failed to reorder.");
      }
    }
  }

  private validateNewQueue(que: Player[]): boolean {
    let isValid = this.lobby.players.size == que.length;
    for (let p of que) {
      isValid = isValid && this.lobby.players.has(p);
    }

    this.logger.trace("validate queue.");
    this.logger.trace("  old: %s", Array.from(this.lobby.players).map(p => p.id).join(", "));
    this.logger.trace("  new: %s", que.map(p => p.id).join(", "));

    return isValid;
  }

  /**
   * !mp host コマンドの発行
   * 現在のキューの先頭をホストに任命
   * すでに先頭がホストの場合は何もしない
   * 変更中から確定までの間にユーザーが抜ける可能性を考慮する必要がある
   * キューの先頭を末尾に 
   */
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

  /**
   * ホストキューの先頭を末尾に付け替える
   */
  private rotateQueue(showLog: boolean = true): void {
    const current = this.hostQueue.shift() as Player;
    this.hostQueue.push(current);
    if (this.logger.isTraceEnabled && showLog) {
      this.logger.trace("rotated host queue: %s", this.hostQueue.map(p => p.id).join(", "));
    }
  }

  /**
   * 指定されたプレイヤーキューから削除する
   * キューに存在しなかった場合はfalseを返す
   */
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

  GetPluginStatus(): string {
    const m = this.hostQueue.map(p => p.id).join(", ");
    return `-- AutoHostSelector --
  current host queue
    ${m}
  map changer : ${this.mapChanger == null ? "null" : this.mapChanger.id}
  needsRotate : ${this.needsRotate}`;
  }

  GetInfoMessage(): string[] {
    return [
      "!queue => 	Shows host queue.",
      "*order [players list] => Reorder the queue in specified order. (*order p1, p2, p3)"]
  }
}
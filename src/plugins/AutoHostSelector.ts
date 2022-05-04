import { escapeUserName } from '../Player.js';
import { Lobby } from '../Lobby.js';
import { BanchoResponseType } from '../parsers/CommandParser.js';
import { MpSettingsResult } from '../parsers/MpSettingsParser.js';
import { Player, revealUserName, disguiseUserName } from '../Player.js';
import { Disposable, TypedEvent } from '../libs/TypedEvent.js';
import { LobbyPlugin } from './LobbyPlugin.js';
import config from 'config';
import log4js from 'log4js';

export interface AutoHostSelectorOption {
  show_host_order_after_every_match: boolean;
  host_order_chars_limit: number;
  host_order_cooltime_ms: number;
  deny_list: string[];
}

export type OrderChangeType = "added" | "removed" | "rotated" | "orderd";

/**
 * 拒否リスト
 * 各ロビーで共有することを想定しているので、プレイヤーオブジェクトではなくエスケープ名を保持する
 *  */
class DenyList {
  players = new Set<string>();
  playerAdded = new TypedEvent<{ name: string }>();
  playerRemoved = new TypedEvent<{ name: string }>();
  logger = log4js.getLogger("DenyList");
  addPlayer(player: Player) {
    if (this.players.has(player.escaped_name)) {
      this.logger.info(`${player.name} is already in denylist.`);
      return false;
    } else {
      this.players.add(player.escaped_name);
      this.logger.info(`Added ${player.name} to denylist.`);
      this.playerAdded.emit({ name: player.escaped_name });
      return true;
    }
  }

  removePlayer(player: Player) {
    if (this.players.delete(player.escaped_name)) {
      this.logger.info(`Removed ${player.name} from denylist.`);
      this.playerRemoved.emit({ name: player.escaped_name });
      return true;
    } else {
      this.logger.info(`${player.name} is not in denylist.`);
      return false;
    }
  }

  includes(player: Player) {
    return this.players.has(player.escaped_name);
  }
}

export const DENY_LIST = new DenyList();

export class AutoHostSelector extends LobbyPlugin {
  option: AutoHostSelectorOption;
  hostQueue: Player[] = [];
  needsRotate: boolean = true;
  mapChanger: Player | null = null;
  orderChanged = new TypedEvent<{ type: OrderChangeType }>();
  eventDisposers: Disposable[] = [];

  constructor(lobby: Lobby, option: Partial<AutoHostSelectorOption> = {}) {
    super(lobby, "AutoHostSelector", "selector");
    const d = config.get<AutoHostSelectorOption>(this.pluginName);
    this.option = { ...d, ...option } as AutoHostSelectorOption;

    if (Array.isArray(this.option.deny_list)) {
      this.option.deny_list.map(s => this.lobby.GetOrMakePlayer(s)).forEach(p => DENY_LIST.addPlayer(p));
    }
    this.registerEvents();
  }

  private registerEvents(): void {
    this.eventDisposers.push(DENY_LIST.playerAdded.on(a => this.onDenylistAdded(a.name)));
    this.eventDisposers.push(DENY_LIST.playerRemoved.on(a => this.onDenylistRemoved(a.name)));
    this.eventDisposers.push(this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player, a.slot, a.fromMpSettings)));
    this.eventDisposers.push(this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player, a.fromMpSettings)));
    this.eventDisposers.push(this.lobby.HostChanged.on(a => this.onHostChanged(a.player)));
    this.eventDisposers.push(this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param)));
    this.eventDisposers.push(this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src)));
    this.eventDisposers.push(this.lobby.AbortedMatch.on(a => this.onMatchAborted(a.playersFinished, a.playersInGame)));
    this.eventDisposers.push(this.lobby.FixedSettings.on(a => this.onFixedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged)));
    this.eventDisposers.push(this.lobby.ReceivedBanchoResponse.on(a => {
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
    }));
    this.lobby.LeftChannel.once(() => this.dispose());
  }

  private dispose() {
    this.eventDisposers.forEach(d => d.dispose());
    this.eventDisposers = [];
  }

  /**
   * 参加したプレイヤーはホストの順番待ちキューに追加される
   * 現在部屋に誰もいない場合はホストに任命
   * @param player 
   * @param slot 
   */
  private onPlayerJoined(player: Player, slot: number, isMpSettingResult: boolean): void {
    if (DENY_LIST.includes(player)) return;
    if (isMpSettingResult) return;

    this.hostQueue.push(player);
    this.logger.trace("added %s", player.name);
    if (this.hostQueue.length == 1) {
      this.logger.trace("appoint first player to host");
      this.changeHost();
    }
    this.raiseOrderChanged("added");
  }

  /**
   * キューから削除
   * 現在のホストなら次のホストを任命
   * ホスト任命中に退出した場合も次のホストを任命
   * 試合中なら次のホストは任命しない
   * @param player 
   */
  private onPlayerLeft(player: Player, isMpSettingResult: boolean): void {
    this.removeFromQueue(player); // キューの先頭がホストならここで取り除かれるのでローテーションは不要になる
    if (this.lobby.isMatching) return;
    if (isMpSettingResult) return;
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
      this.logger.trace("a new host has been appointed:%s", newhost.name);
    } else {
      // ホストがキューの先頭以外に変更された場合
      if (this.lobby.hostPending == null) {
        this.logger.trace("the host may have manually changed by the previous host");
        this.rotateQueue();
      }
      this.changeHost();
    }

    if (this.mapChanger != null && this.mapChanger != newhost) { // 前任のホストがマップを変更している
      this.needsRotate = false;
      this.logger.info("host is appointed after map change");
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
    if (this.lobby.hostPending == null && this.needsRotate) {
      this.rotateQueue();
    } else {
      this.logger.info("rotation skipped.");
    }
  }

  /**
   * 試合が終了したら現在のキューの先頭をホストに任命
   */
  private onMatchFinished(): void {
    this.needsRotate = true;
    this.mapChanger = null;
    this.changeHost();
    if (this.option.show_host_order_after_every_match) {
      this.ShowHostQueue();
    }
  }

  private onMatchAborted(playersFinished: number, playersInGame: number): void {
    if (playersFinished != 0) { // 誰か一人でも試合終了している場合は通常の終了処理
      this.logger.trace("The match was aborted after several players were Finished. call normal match finish process");
      this.onMatchFinished();
    } else {
      if (this.lobby.host != null) {
        // 誰も終了していない場合は試合再開許可モードへ
        this.needsRotate = false;
        this.logger.trace("The match was aborted before any Player Finished.");
      } else {
        // ホストがいない状態で試合が中断されたら
        this.logger.trace("The match was aborted after the host left.");
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
  private onFixedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    if (this.lobby.host == null) {
      this.hostQueue = [];
    }
    if (this.hostQueue.length == 0 || this.lobby.host == null || !this.hostQueue.includes(this.lobby.host)) {
      // キューが空、ホストがいない、ホストが新しく入った人の場合はスロットベースで再構築する
      this.OrderBySlotBase(result);
    } else {
      this.ModifyOderByMpSettingsResult(result, playersIn, playersOut, hostChanged);
    }

    if (this.lobby.host != null) {
      if (DENY_LIST.includes(this.lobby.host)) {
        this.changeHost();
      } else {
        this.SkipTo(this.lobby.host);
      }

    } else {
      // hostがいない場合は先頭へ
      this.changeHost();
      this.raiseOrderChanged("orderd");
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
          return;
        }
      }
      if (command == "*denylist") {
        let matAdd = param.match(/^add\s+(.+)/);
        if (matAdd) {
          let p = this.lobby.GetOrMakePlayer(matAdd[1]);
          DENY_LIST.addPlayer(p); // 後続処理はイベント経由でonDenylistAddedで実行
        }

        let matRemove = param.match(/^remove\s+(.+)/);
        if (matRemove) {
          let p = this.lobby.GetOrMakePlayer(matRemove[1]);
          DENY_LIST.removePlayer(p); // 後続処理はイベント経由でonDenylistRemovedで実行
        }
      }
    }
  }

  private onDenylistAdded(name: string) {
    let player = this.lobby.GetOrMakePlayer(name);
    if (this.hostQueue.includes(player)) {
      this.hostQueue = this.hostQueue.filter(p => p != player);
      this.logger.info(`removed ${player.name} from hostqueue`);
      if (player.isHost) {
        this.changeHost();
      }
    }
  }

  private onDenylistRemoved(name: string) {
    let player = this.lobby.GetOrMakePlayer(name);
    if (this.lobby.players.has(player) && !this.hostQueue.includes(player)) {
      this.onPlayerJoined(player, player.slot, false);
      this.logger.info(`added ${player.name} to hostqueue`);
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
      if (!this.hostQueue.includes(to)) {
        this.logger.error("skipto target dosent exist");
        return;
      }
      this.SkipTo(to);
    } else if (type == "reorder") {
      this.logger.trace("received plugin message reorder");
      this.Reorder(args[0]);
    }
  }

  /**
   * MpSettingsの結果をもとに、ロビーのスロット順にキューを構成しなおす
   * @param result 
   */
  OrderBySlotBase(result: MpSettingsResult): void {
    this.logger.info("reordered slot base order.");
    this.hostQueue = result.players.map(r => this.lobby.GetOrMakePlayer(r.name)).filter(p => !DENY_LIST.includes(p));
  }

  ModifyOderByMpSettingsResult(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean) {
    // 少人数が出入りしただけとみなし、現在のキューを維持する
    let newQueue = this.hostQueue.concat(playersIn).filter(p => !playersOut.includes(p) && !DENY_LIST.includes(p));

    if (this.validateNewQueue(newQueue)) {
      this.logger.info("modified host queue.");
      this.hostQueue = newQueue;
    } else {
      this.logger.warn("failed to modified the host queue.");
      this.OrderBySlotBase(result);
    }
  }

  /**
   * 現在のホストキューをロビーチャットに投稿する
   * Nameはチャットのhighlightに引っかからないように加工される
   */
  ShowHostQueue(): void {
    this.lobby.SendMessageWithCoolTime(() => {
      let m = this.hostQueue.map(c => disguiseUserName(c.name)).join(", ");
      this.logger.trace(m);
      if (this.option.host_order_chars_limit < m.length) {
        m = m.substring(0, this.option.host_order_chars_limit) + "...";
      }
      return "host order : " + m;
    }, "!queue", this.option.host_order_cooltime_ms);
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

    // キューにいないプレイヤーの場合は何もしない
    if (!this.hostQueue.find(p => p == trg)) {
      this.logger.error(`couldn't skip to who isn't in queue. ${trg.name}`);
      return;
    }

    let c = 0;
    while (this.hostQueue[0] != trg) {
      this.rotateQueue(false);
      if (c++ > 16) {
        this.logger.error("infinity loop detected");
        return;
      }
    }
    if (this.logger.isTraceEnabled()) {
      this.logger.trace("skipto: %s", this.hostQueue.map(p => p.name).join(", "));
    }
    this.raiseOrderChanged("rotated");
    this.changeHost();
  }

  /**
   * キューを指定した順番に並び替える
   * @param order 
   */
  Reorder(order: Player[] | string): void {
    if (typeof (order) == "string") {
      const players = order.split(",").map(t => this.lobby.GetPlayer(revealUserName(t.trim()))).filter(p => p != null) as Player[];
      if (players.length == 0) {
        this.logger.info("Faild reorder, invalid order string : %s", order);
      } else {
        this.Reorder(players);
      }
    } else {
      const nq = order.filter(p => this.lobby.players.has(p) && !DENY_LIST.includes(p));
      for (let p of this.hostQueue) {
        if (!nq.includes(p)) {
          nq.push(p);
        }
      }
      if (this.validateNewQueue(nq)) {
        this.logger.info("reordered host queue.");
        this.hostQueue = nq;
        this.raiseOrderChanged("orderd");
        this.changeHost();
      } else {
        this.logger.info("failed to reorder.");
      }
    }
  }

  private validateNewQueue(que: Player[]): boolean {
    let isValid = true;
    for (let p of que) {
      isValid = isValid && this.lobby.players.has(p) && !DENY_LIST.includes(p);
    }

    this.logger.trace("validate queue.");
    this.logger.trace("  old: %s", Array.from(this.lobby.players).map(p => p.name).join(", "));
    this.logger.trace("  new: %s", que.map(p => p.name).join(", "));

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
      if (this.lobby.host != null) {
        this.lobby.SendMessage("!mp clearhost");
      }
      return;
    }
    if (this.hostQueue[0] != this.lobby.host) {
      this.lobby.TransferHost(this.hostQueue[0]);
      this.logger.trace("sent !mp host %s", this.hostQueue[0].name);
    } else {
      this.logger.trace("%s is already host", this.hostQueue[0].name);
    }
  }

  /**
   * ホストキューの先頭を末尾に付け替える
   */
  private rotateQueue(showLog: boolean = true): void {
    const current = this.hostQueue.shift() as Player;
    this.hostQueue.push(current);
    if (this.logger.isTraceEnabled() && showLog) {
      this.logger.trace("rotated host queue: %s", this.hostQueue.map(p => p.name).join(", "));
    }
    this.raiseOrderChanged("rotated");
  }

  /**
   * 指定されたプレイヤーキューから削除する
   * キューに存在しなかった場合はfalseを返す
   */
  private removeFromQueue(player: Player): boolean {
    const i = this.hostQueue.indexOf(player);
    if (i != -1) {
      this.hostQueue.splice(i, 1);
      this.logger.trace("removed %s", player.name);
      this.raiseOrderChanged("removed");
      return true;
    } else {
      return false;
    }
  }

  getDeniedPlayerNames() {
    return [...DENY_LIST.players];
  }

  GetPluginStatus(): string {
    const m = this.hostQueue.map(p => p.name).join(", ");
    const b = this.getDeniedPlayerNames().join(",");
    return `-- AutoHostSelector --
  queue : ${m}
  mapChanger : ${this.mapChanger == null ? "null" : this.mapChanger.name}, needsRotate : ${this.needsRotate}
  denyList : ${b}`;
  }

  private raiseOrderChanged(type: OrderChangeType) {
    this.orderChanged.emit({ type });
  }
}

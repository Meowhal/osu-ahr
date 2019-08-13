import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import log4js from "log4js";
const logger = log4js.getLogger("hostSkipper");

export interface HostSkipperOption {
  skip_request_rate: number; // ホストスキップ投票時の必要数/プレイヤー数
  skip_request_min: number;　// 最低投票数
  skip_timer_delay_ms: number; // ホスト変更後に与えられるスキップ猶予時間
}

const HostSkipperDefaultOption = config.get<HostSkipperOption>("HostSkipper");

/**
 * スキップ処理の受付部分を担当
 * スキップが受け付けられると、pluginMessageを介して他のプラグインに処理を依頼する。
 * 
 * 処理するコマンド
 * /skip スキップコマンド。hostなら即座にスキップ。それ以外なら投票でスキップ。
 * *skip 管理権限スキップ。botOwnerなら即座にスキップ。
 * *stopSkipCounter スキップカウンターの停止。
 * *resetSkip スキップ投票とカウンターの初期化。
 * 
 * デフォルトでのスキップに必要な人数 (ロビー人数 => 必要数)
 * 2 => 2(不可能), 3 ~ 4 => 2, 5 ~ 6 => 3, 7 ~ 8 => 4 ... n => n / 2
 */
export class HostSkipper extends LobbyPlugin {
  option: HostSkipperOption;
  skipTimer: NodeJS.Timer | undefined;
  skipRequesters: Set<Player> = new Set<Player>();

  constructor(lobby: ILobby, option: any | null = null) {
    super(lobby);
    this.option = { ...HostSkipperDefaultOption, ...option } as HostSkipperOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.succeeded, a.player));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.PlayerChated.on(a => this.onPlayerChated(a.player, a.authority, a.message));
    this.lobby.BeatmapChanging.on(() => this.onBeatmapChanging());
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
  }

  private onPlayerLeft(player: Player): void {
    if (this.lobby.isMatching) return;

    if (this.skipRequesters.has(player)) {
      this.skipRequesters.delete(player);
    }

    // スキップ判定の母数が減るので再評価する
    this.checkSkipCount();

    // 誰もいなくなったらタイマーを止める
    if(this.lobby.players.size == 0){
      this.clearAll();
    }
  }

  private onHostChanged(succeeded: boolean, newhost: Player): void {
    if (!succeeded || this.lobby.isMatching) return;
    this.clearAll();
    this.startTimer();
  }

  private onMatchStarted(): void {
    this.clearAll();
  }

  // ホストがマップを変更している
  // ホスト変更から一定時間以内にマップを変えない場合スキップする
  private onBeatmapChanging(): void {
    this.stopTimer();
  }

  // スキップメッセージを処理
  private onPlayerChated(player: Player, auth: number, message: string): void {
    if (this.lobby.isMatching) return;

    if (message == "!info" || message == "!help") {
      this.lobby.SendMessage("!skip => skip current host.");
    } else if (message == "!skip" || message == "!s") {
      if (auth >= 1) {
        this.doSkip();
      } else if (this.skipRequesters.has(player)) {
        this.lobby.SendMessage(`${player.id} has already requested skip.`);
      } else {
        this.skipRequesters.add(player);
        this.checkSkipCount();
      }
    } else if (auth == 2) {
      if (message == "*skip") {
        this.doSkip();
      } else if (message == "*stopSkipCounter") {
        this.stopTimer();
      } else if (message == "*resetSkip") {
        this.clearAll();
        this.startTimer();
      }
    }
  }

  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {

  }

  // スキップ状況を確認して、必要数に達している場合は
  private checkSkipCount(): void {
    const r = this.requiredSkip;
    const c = this.countSkip;
    if (c != 0) {
      this.lobby.SendMessage(`Host skip progress: ${c} / ${r}`)
    }
    if (r <= c) {
      this.doSkip();
    }
  }

  /** スキップ投票の必要数 */
  get requiredSkip(): number {
    return Math.max(
      this.lobby.players.size * this.option.skip_request_rate,
      this.option.skip_request_min);
  }

  /** スキップに投票した人数 */
  get countSkip(): number {
    return this.skipRequesters.size;
  }

  private doSkip(): void {
    logger.info("do skip");
    this.clearAll();
    this.sendPluginMessage("skip");
  }

  clearAll(): void {
    logger.trace("clear all");
    this.stopTimer();
    this.skipRequesters.clear();
  }

  startTimer(): void {
    this.stopTimer();
    logger.trace("start timer");
    this.skipTimer = setTimeout(() => {
      if (this.skipTimer != undefined) {
        logger.trace("AFK skip function has been activated.");
        this.lobby.SendMessage("AFK skip function has been activated.");
        this.doSkip();
      }
    }, this.option.skip_timer_delay_ms);
  }

  stopTimer(): void {
    logger.trace("stop timer");
    if (this.skipTimer != undefined) {
      clearTimeout(this.skipTimer);
      this.skipTimer = undefined;
    }
  }

  getPluginStatus(): string {
    return `-- Host Skipper --
      timer : ${this.skipTimer != undefined ? "active" : "---"}
      skip_require : ${this.requiredSkip}
      skip_count : ${this.countSkip}
      skip_requesters : [${[...this.skipRequesters].map(v => v.id).join(", ")}]
    `;
  }
}
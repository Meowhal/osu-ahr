import { ILobby } from "./ILobby";
import { Player } from "./Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import log4js from "log4js";
const logger = log4js.getLogger("hostSkipper");

export interface HostSkipperOption {
  skip_request_rate: number; // ホストスキップ投票時の必要数/プレイヤー数
  skip_request_min: number;　// 最低投票数
  skip_vote_delay_ms: number; // 投票受付までの猶予時間 前回の巻き込み投票防止
  afk_timer_delay_ms: number; // ホスト変更後に与えられるスキップ猶予時間
  afk_timer_message: string; // タイマー時に表示されるメッセージ
  afk_timer_do_skip: boolean; // スキップするか
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
 * *restartSkip スキップ投票とカウンターの初期化。
 * 
 * デフォルトでのスキップに必要な人数 (ロビー人数 => 必要数)
 * 2 => 2(不可能), 3 ~ 4 => 2, 5 ~ 6 => 3, 7 ~ 8 => 4 ... n => n / 2
 */
export class HostSkipper extends LobbyPlugin {
  option: HostSkipperOption;
  afkTimer: NodeJS.Timer | undefined;
  skipRequesters: Set<Player> = new Set<Player>();
  timeStart: number = Date.now();
  skipping: boolean = false; // 

  // skip受付からの経過時間
  get elapsed(): number {
    return Date.now() - this.timeStart;
  }

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
    if (this.lobby.players.size == 0) {
      this.clearVote();
      this.stopTimer();
    }
  }

  private onHostChanged(succeeded: boolean, newhost: Player): void {
    if (!succeeded || this.lobby.isMatching) return;
    this.restart();
  }

  private onMatchStarted(): void {
    this.stopTimer();
    this.clearVote();
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
      this.vote(player, auth);
    } else if (auth >= 2) {
      if (message == "*skip") {
        this.doSkip();
      } else if (message == "*stopSkipCounter") {
        this.stopTimer();
      } else if (message == "*restartSkip") {
        this.restart();
      }
    }
    if (this.lobby.host == player) {
      this.stopTimer();
    }
  }

  private vote(player: Player, auth: number) {
    if (this.skipping) {
      logger.debug("vote from %s was ignored, already skipped", player.id);
    } else if (this.elapsed < this.option.skip_vote_delay_ms) {
      logger.debug("vote from %s was ignored, at cool time.", player.id);
      this.lobby.SendMessage("skip vote was ignored due to cool time. try again.");
    } else if (auth >= 1) {
      this.doSkip();
    } else if (this.skipRequesters.has(player)) {
      logger.debug("vote from %s was ignored, double vote", player.id);
      this.lobby.SendMessage(`${player.id} has already requested skip.`);
    } else {
      this.skipRequesters.add(player);
      logger.trace("accept skip request from %s", player.id);
      this.checkSkipCount();
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
    return Math.ceil(Math.max(
      this.lobby.players.size * this.option.skip_request_rate,
      this.option.skip_request_min));
  }

  /** スキップに投票した人数 */
  get countSkip(): number {
    return this.skipRequesters.size;
  }

  private doSkip(): void {
    logger.info("do skip");
    this.skipping = true;
    this.stopTimer();
    this.sendPluginMessage("skip");
  }

  restart(): void {
    this.clearVote();
    this.startTimer();
    this.skipping = false;
    this.timeStart = Date.now();
  }

  clearVote(): void {
    logger.trace("clear vote");
    this.skipRequesters.clear();
  }

  startTimer(): void {
    if (this.option.afk_timer_delay_ms == 0) return;
    this.stopTimer();
    logger.trace("start timer");
    this.afkTimer = setTimeout(() => {
      logger.trace("afk timer action");
      if (this.afkTimer != undefined) {
        if (this.option.afk_timer_message != "") {
          this.lobby.SendMessage(this.option.afk_timer_message);
        }
        if (this.option.afk_timer_do_skip) {
          this.doSkip();
        }
      }
    }, this.option.afk_timer_delay_ms);
  }

  stopTimer(): void {
    if (this.afkTimer != undefined) {
      logger.trace("stop timer");
      clearTimeout(this.afkTimer);
      this.afkTimer = undefined;
    }
  }

  getPluginStatus(): string {
    return `-- Host Skipper --
      timer : ${this.afkTimer != undefined ? "active" : "---"}
      skip_require : ${this.requiredSkip}
      skip_count : ${this.countSkip}
      skip_requesters : [${[...this.skipRequesters].map(v => v.id).join(", ")}]
    `;
  }
}
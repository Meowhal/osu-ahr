import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import log4js from "log4js";
const logger = log4js.getLogger("matchAborter");

export interface MatchAborterOption {
  vote_rate: number; // アボート投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
  auto_abort_rate: number; // 何割終了したらアボートタイマーを起動するか？
  auto_abort_delay_ms: number; // 試合終了後のアボート実行までの猶予時間
}

const defaultOption = config.get<MatchAborterOption>("MatchAborter");

/**
 * Abort投票を受け付けるためのプラグイン
 * 試合開始直後や終了時に止まってしまった際に復帰するため
 */
export class MatchAborter extends LobbyPlugin {
  option: MatchAborterOption;
  abortTimer: NodeJS.Timer | null = null;
  abortRequesters: Set<Player> = new Set<Player>();
  aborting: boolean = false;

  constructor(lobby: ILobby, option: any | null = null) {
    super(lobby);
    this.option = { ...defaultOption, ...option } as MatchAborterOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.AbortedMatch.on(a => this.onAbortedMatch(a.playersFinished, a.playersInGame));
    this.lobby.PlayerFinished.on(a => this.onPlayerFinished(a.player, a.score, a.isPassed, a.playersFinished, a.playersInGame));
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.authority, a.command, a.param));
  }

  // 試合中に抜けた場合
  private onPlayerLeft(player: Player): void {
    if (!this.lobby.isMatching) return;

    if (this.abortRequesters.has(player)) {
      this.abortRequesters.delete(player);
    }

    // 母数が減るので投票とタイマーを再評価する
    this.checkVoteCount();
    this.checkAutoAbort();

    // 誰もいなくなったらタイマーを止める
    if (this.lobby.players.size == 0) {
      this.clearVote();
      this.stopTimer();
    }
  }

  private onMatchStarted(): void {
    this.clearVote();
    this.aborting = false;
  }

  private onAbortedMatch(playersFinished: number, playersInGame: number) {
    this.aborting = false;
  }

  private onPlayerFinished(player: Player, score: number, isPassed: boolean, playersFinished: number, playersInGame: number) {
    this.checkAutoAbort();
  }

  private onMatchFinished() {
    this.stopTimer();
  }

  private onCustomCommand(player: Player, auth: number, command: string, param: string): void {
    if (!this.lobby.isMatching) return;
    if (command == "!abort") {
      this.vote(player, auth);
    } else if (auth >= 2) {
      if (command == "*abort") {
        this.doAbort();
      }
    }
  }

  private vote(player: Player, auth: number) {
    if (!this.lobby.playersInGame.has(player)) {
      // 試合に参加していないプレイヤーの投票は無視
      return;
    } else if (this.aborting) {
      // 受付後の投票は無視
      logger.debug("vote from %s was ignored, already aborting", player.id);
    } else if (player == this.lobby.host) {
      // ホストからの投票
      logger.debug("host(%s) sent !abort command", player.id);
      this.lobby.SendMessage("bot : Accepted !abort from current host.");
      this.doAbort();
    } else if (!this.abortRequesters.has(player)) {
      this.abortRequesters.add(player);
      logger.trace("accept skip request from %s", player.id);
      this.checkVoteCount(true);
    } else {
      logger.debug("vote from %s was ignored, double vote", player.id);
    }
  }

  // 投票数を確認して必要数に達していたら試合中断
  private checkVoteCount(showMessage: boolean = false): void {
    const r = this.voteRequired;
    const c = this.voteCount;
    if (c != 0 && showMessage) {
      this.lobby.SendMessage(`bot : match abort progress: ${c} / ${r}`)
    }
    if (r <= c) {
      this.doAbort();
    }
  }

  /** 投票の必要数 */
  get voteRequired(): number {
    return Math.ceil(Math.max(
      this.lobby.playersInGame.size * this.option.vote_rate,
      this.option.vote_min));
  }

  /** 投票した人数 */
  get voteCount(): number {
    return this.abortRequesters.size;
  }

  private checkAutoAbort(): void {
    if (this.abortTimer == null) {
      if (this.autoAbortRequired <= this.lobby.playersFinished.size) { // 半数以上終了したらタイマー起動
        this.startTimer();
      }
    }
  }

  get autoAbortRequired(): number {
    return Math.ceil(
      this.lobby.playersInGame.size * this.option.auto_abort_rate);
  }

  private doAbort(): void {
    logger.info("do abort");
    this.aborting = true;
    this.stopTimer();
    this.lobby.AbortMatch();
  }

  private clearVote(): void {
    if (this.abortRequesters.size != 0) {
      logger.trace("clear vote");
      this.abortRequesters.clear();
    }
  }

  private startTimer(): void {
    if (this.option.auto_abort_delay_ms == 0) return;
    this.stopTimer();
    logger.trace("start timer");
    this.abortTimer = setTimeout(() => {
      logger.trace("abort timer action");
      if (this.abortTimer != null) {
        this.doAbort();
      }
    }, this.option.auto_abort_delay_ms);
  }

  private stopTimer(): void {
    if (this.abortTimer != null) {
      logger.trace("stop timer");
      clearTimeout(this.abortTimer);
      this.abortTimer = null;
    }
  }

  getPluginStatus(): string {
    return `-- Match Aborter --
      timer : ${this.abortTimer != null ? "active" : "---"}
      vote_require : ${this.voteRequired}
      vote_count : ${this.voteCount}
      vote_requesters : [${[...this.abortRequesters].map(v => v.id).join(", ")}]
    `;
  }

  getInfoMessage(): string[] {
    return ["!abort => abort the matcd. Use if the match stuck."];
  }
}
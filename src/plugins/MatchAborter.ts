import { Lobby } from "..";
import { MpSettingsResult } from "../parsers";
import { Player, MpStatuses } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import { VoteCounter } from "./VoteCounter";

export interface MatchAborterOption {
  vote_rate: number; // アボート投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
  vote_msg_defer: number; // メッセージの延期時間
  auto_abort_rate: number; // 何割終了したらアボートタイマーを起動するか？
  auto_abort_delay_ms: number; // 試合終了後のアボート実行までの猶予時間
  auto_abort_do_abort: boolean; // 実際にアボートを実行するか
}

const defaultOption = config.get<MatchAborterOption>("MatchAborter");

/**
 * Abort投票を受け付けるためのプラグイン
 * 試合開始直後や終了時に止まってしまった際に復帰するため
 */
export class MatchAborter extends LobbyPlugin {
  option: MatchAborterOption;
  abortTimer: NodeJS.Timer | null = null;
  voting: VoteCounter;

  constructor(lobby: Lobby, option: Partial<MatchAborterOption> = {}) {
    super(lobby, "aborter");
    this.option = { ...defaultOption, ...option } as MatchAborterOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.PlayerFinished.on(a => this.onPlayerFinished(a.player, a.score, a.isPassed, a.playersFinished, a.playersInGame));
    this.lobby.MatchFinished.on(() => this.onMatchFinished());
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.command, a.param));
  }

  // 試合中に抜けた場合
  private onPlayerLeft(player: Player): void {
    if (!this.lobby.isMatching) return;
    this.voting.RemoveVoter(player);

    // 母数が減るので投票とタイマーを再評価する
    this.checkVoteCount();
    this.checkAutoAbort();

    // 誰もいなくなったらタイマーを止める
    if (this.lobby.players.size == 0) {
      this.voting.Clear();
      this.stopTimer();
    }
  }

  private onMatchStarted(): void {
    this.voting.RemoveAllVoters();
    for (let p of this.lobby.players) {
      this.voting.AddVoter(p);
    }
  }

  private onPlayerFinished(player: Player, score: number, isPassed: boolean, playersFinished: number, playersInGame: number): void {
    this.checkAutoAbort();
  }

  private onMatchFinished(): void {
    this.stopTimer();
  }

  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    this.voting.RemoveAllVoters();
  }

  private onCustomCommand(player: Player, command: string, param: string): void {
    if (!this.lobby.isMatching) return;
    if (command == "!abort") {
      if (player == this.lobby.host) {
        this.logger.trace("host(%s) sent !abort command", player.id);
        this.doAbort();
      } else {
        this.vote(player);
      }
    } else if (player.isAuthorized) {
      if (command == "*abort") {
        this.doAbort();
      }
    }
  }

  private vote(player: Player): void {
    if (this.voting.passed) return;
    if (this.voting.Vote(player)) {
      this.logger.trace("accept abort request from %s (%s)", player.id, this.voting.toString());
      this.checkVoteCount(true);
    } else {
      this.logger.trace("vote from %s was ignored", player.id);
    }
  }

  // 投票数を確認して必要数に達していたら試合中断
  private checkVoteCount(showMessage: boolean = false): void {
    if (this.voting.count != 0 && showMessage) {
      this.lobby.DeferMessage(`bot : match abort progress: ${this.voting.toString()}`, "aborter vote", 5000, false);
    }
    if (this.voting.passed) {
      this.lobby.DeferMessage(`bot : passed abort vote: ${this.voting.toString()}`, "aborter vote", 100, true);
      this.doAbort();
    }
  }

  /** 投票の必要数 */
  get voteRequired(): number {
    return Math.ceil(Math.max(
      this.lobby.playersInGame * this.option.vote_rate,
      this.option.vote_min));
  }

  private checkAutoAbort(): void {
    if (this.abortTimer == null) {
      if (this.autoAbortRequired <= this.lobby.playersFinished) { // 半数以上終了したらタイマー起動
        this.startTimer();
      }
    }
  }

  get autoAbortRequired(): number {
    return Math.ceil(
      this.lobby.playersInGame * this.option.auto_abort_rate);
  }

  private doAbort(): void {
    this.logger.info("do abort");
    this.stopTimer();
    this.lobby.AbortMatch();
  }

  private startTimer(): void {
    if (this.option.auto_abort_delay_ms == 0) return;
    this.stopTimer();
    this.logger.trace("start timer");
    this.abortTimer = setTimeout(() => {
      this.logger.trace("abort timer action");
      if (this.abortTimer != null) {
        this.doAutoAbort();
      }
    }, this.option.auto_abort_delay_ms);
  }

  private doAutoAbort(): void {
    const playersStillPlaying = Array.from(this.lobby.players).filter(v => v.mpstatus == MpStatuses.Playing);
    if (this.option.auto_abort_do_abort) {
      this.doAbort();
    } else {
      this.lobby.SendMessage("bot : if the game is stuck, abort the game with !abort vote.");
    }

    for (let p of playersStillPlaying) {
      this.lobby.SendMessage(`!stat ${p.id}`);
    }
  }

  private stopTimer(): void {
    if (this.abortTimer != null) {
      this.logger.trace("stop timer");
      clearTimeout(this.abortTimer);
      this.abortTimer = null;
    }
  }

  GetPluginStatus(): string {
    return `-- Match Aborter --
  timer : ${this.abortTimer != null ? "active" : "---"}
  vote : ${this.voting.toString()}`;
  }

  GetInfoMessage(): string[] {
    return ["!abort => abort the match. Use if the match stuck."];
  }
}
import { Lobby } from "..";
import { Player, escapeUserId } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import { VoteCounter } from "./VoteCounter";
import { BanchoResponseType } from "../parsers";
import config from "config";

export interface HostSkipperOption {
  vote_rate: number; // ホストスキップ投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
  vote_cooltime_ms: number; // 投票受付までの猶予時間 前回の巻き込み投票防止
  vote_msg_defer_ms: number; // 投票メッセージの延期時間
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
  timeVotePassed: number = 0;
  voting: VoteCounter;

  // skip受付からの経過時間
  get elapsedSinceVotePassed(): number {
    return Date.now() - this.timeVotePassed;
  }

  constructor(lobby: Lobby, option: Partial<HostSkipperOption> = {}) {
    super(lobby, "skipper");
    this.option = { ...HostSkipperDefaultOption, ...option } as HostSkipperOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
    this.lobby.PlayerLeft.on(p => this.onPlayerLeft(p));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.succeeded, a.player));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.command, a.param));
    this.lobby.PlayerChated.on(a => this.onPlayerChated(a.player));
    this.lobby.RecievedBanchoResponse.on(a => {
      if (a.response.type == BanchoResponseType.BeatmapChanging) {
        this.onBeatmapChanging()
      }
    });
  }

  private onPlayerJoined(player: Player) {
    this.voting.AddVoter(player);
  }

  private onPlayerLeft(player: Player): void {
    this.voting.RemoveVoter(player);
    if (this.lobby.isMatching) return;

    // スキップ判定の母数が減るので再評価する
    this.checkSkipCount();

    // 誰もいなくなったらタイマーを止める
    if (this.lobby.players.size == 0) {
      this.voting.Clear();
      this.stopTimer();
    }
  }

  private onHostChanged(succeeded: boolean, newhost: Player): void {
    if (!succeeded || this.lobby.isMatching) return;
    this.restart();
  }

  private onMatchStarted(): void {
    this.voting.Clear();
    this.stopTimer();
  }

  // ホストがマップを変更している
  // ホスト変更から一定時間以内にマップを変えない場合スキップする
  private onBeatmapChanging(): void {
    this.stopTimer();
  }

  private onPlayerChated(player: Player) {
    if (this.lobby.host == player) {
      this.stopTimer();
    }
  }

  // スキップメッセージを処理
  private onCustomCommand(player: Player, command: string, param: string): void {
    if (this.lobby.isMatching) return;

    if (command == "!skip") {
      if (this.lobby.host == null) return; // ホストがいないなら何もしない
      if (param != "" && escapeUserId(param) != this.lobby.host.escaped_id) return; // 関係ないユーザーのスキップは無視
      this.vote(player);
    } else if (player.isAuthorized) {
      if (command == "*skip") {
        this.doSkip();
      } else if (command == "*stopSkipCounter") {
        this.stopTimer();
      } else if (command == "*restartSkip") {
        this.restart();
      } else if (command == "*skipto" && param != "") {
        this.doSkipTo(param);
      }
    }
  }

  private vote(player: Player) {
    if (this.voting.passed) {
      this.logger.debug("vote from %s was ignored, already skipped", player.id);
    } else if (this.elapsedSinceVotePassed < this.option.vote_cooltime_ms) {
      this.logger.debug("vote from %s was ignored, at cool time.", player.id);
      if (player.isHost) {
        const secs = (this.option.vote_cooltime_ms - this.elapsedSinceVotePassed) / 1000;
        this.lobby.SendMessage(`skip command during cool time was ignored. you'll be able to skip in ${secs.toFixed(2)} sec(s).` );
      }
    } else if (player.isHost) {
      this.logger.debug("host(%s) sent !skip command", player.id);
      this.doSkip();
    } else {
      if (this.voting.Vote(player)) {
        this.logger.trace("accept skip request from %s", player.id);
        this.checkSkipCount(true);
      } else {
        this.logger.debug("vote from %s was ignored, double vote", player.id);
      }
    }
  }

  // スキップ状況を確認して、必要数に達している場合は
  private checkSkipCount(showMessage: boolean = false): void {
    if (this.voting.count != 0 && showMessage) {
      this.lobby.DeferMessage(`bot : Host skip progress: ${this.voting.toString()}`, "checkSkipCount", this.option.vote_msg_defer_ms, false);
    }
    if (this.voting.passed) {
      this.lobby.DeferMessage(`bot : Passed skip vote: ${this.voting.toString()}`, "checkSkipCount", 100, true);
      this.doSkip();
    }
  }

  private doSkip(): void {
    this.logger.info("do skip");
    this.stopTimer();
    this.sendPluginMessage("skip");
    this.timeVotePassed = Date.now();
  }

  private doSkipTo(userid: string): void {
    if (!this.lobby.Includes(userid)) {
      this.logger.info("invalid userid @skipto : %s", userid);
      return;
    }
    this.logger.info("do skipTo : %s", userid);
    this.stopTimer();
    this.sendPluginMessage("skipto", [userid]);
  }

  restart(): void {
    this.voting.Clear();
    this.startTimer();
  }

  startTimer(): void {
    if (this.option.afk_timer_delay_ms == 0) return;
    this.stopTimer();
    this.logger.trace("start timer");
    this.afkTimer = setTimeout(() => {
      this.logger.trace("afk timer action");
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
      this.logger.trace("stop timer");
      clearTimeout(this.afkTimer);
      this.afkTimer = undefined;
    }
  }

  getPluginStatus(): string {
    return `-- Host Skipper --
  timer : ${this.afkTimer != undefined ? "active" : "---"}
  skip_vote : ${this.voting.toString()}`;
  }

  getInfoMessage(): string[] {
    return ["!skip => skip current host."];
  }
}
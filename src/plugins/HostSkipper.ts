import { Lobby } from "..";
import { Player, escapeUserId } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import { VoteCounter } from "./VoteCounter";
import { BanchoResponseType, MpSettingsResult, StatStatuses } from "../parsers";
import config from "config";
import { LobbyStatus } from "../Lobby";

export interface HostSkipperOption {
  vote_rate: number; // ホストスキップ投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
  vote_cooltime_ms: number; // 投票受付までの猶予時間 前回の巻き込み投票防止
  vote_msg_defer_ms: number; // 投票メッセージの延期時間
  afk_check_interval_ms: number; // ホストのAfkチェック間隔
  afk_check_do_skip: boolean; // 実際にスキップするか？
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
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.command, a.param));
    this.lobby.PlayerChated.on(a => this.onPlayerChated(a.player));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.Disconnected.on(() => this.StopTimer());
    this.lobby.RecievedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.MatchStarted: this.onMatchStarted(); break;
        case BanchoResponseType.BeatmapChanging:
        case BanchoResponseType.BeatmapChanged:
          this.StartTimer(); break;
      }
    });
  }

  private onPlayerJoined(player: Player) {
    this.voting.AddVoter(player);

    // 一人だけいるプレイヤーがAFKなら新しく入ってきた人をホストにする
    if (this.lobby.players.size == 2 && this.lobby.host && this.lobby.host.laststat) {
      const ls = this.lobby.host.laststat;
      if (this.statIsAfk(ls.status) && Date.now() - ls.date < this.option.afk_check_interval_ms) {
        // 他のプラグインが join の処理を完了したあとに実行したい。
        setImmediate(() => { this.Skip(); });
      }
    }
  }

  private onPlayerLeft(player: Player): void {
    this.voting.RemoveVoter(player);
    if (this.lobby.isMatching) return;

    // スキップ判定の母数が減るので再評価する
    this.checkSkipCount();

    // 誰もいなくなったらタイマーを止める
    if (this.lobby.players.size == 0) {
      this.voting.Clear();
      this.StopTimer();
    }
  }

  private onHostChanged(newhost: Player): void {
    if (this.lobby.isMatching) return;
    this.Reset();
  }

  private onMatchStarted(): void {
    this.voting.Clear();
    this.StopTimer();
  }

  private onPlayerChated(player: Player): void {
    if (this.lobby.host == player) {
      // reset current timer and restart
      this.StartTimer();
    }
  }

  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    playersOut.forEach(p => this.voting.RemoveVoter(p));
    playersIn.forEach(p => this.voting.AddVoter(p));
    this.voting.Clear();
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
        this.Skip();
      } else if (command == "*skipto" && param != "") {
        this.SkipTo(param);
      }
    }
  }

  private vote(player: Player): void {
    if (this.voting.passed) {
      this.logger.debug("vote from %s was ignored, already skipped", player.id);
    } else if (this.elapsedSinceVotePassed < this.option.vote_cooltime_ms) {
      this.logger.debug("vote from %s was ignored, at cool time.", player.id);
      if (player.isHost) {
        const secs = (this.option.vote_cooltime_ms - this.elapsedSinceVotePassed) / 1000;
        this.lobby.SendMessage(`skip command during cool time was ignored. you'll be able to skip in ${secs.toFixed(2)} sec(s).`);
      }
    } else if (player.isHost) {
      this.logger.debug("host(%s) sent !skip command", player.id);
      this.Skip();
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
      this.Skip();
    }
  }

  Skip(): void {
    this.logger.info("do skip");
    this.StopTimer();
    this.SendPluginMessage("skip");
    this.timeVotePassed = Date.now();
  }

  SkipTo(userid: string): void {
    if (!this.lobby.Includes(userid)) {
      this.logger.info("invalid userid @skipto : %s", userid);
      return;
    }
    this.logger.info("do skipTo : %s", userid);
    this.StopTimer();
    this.SendPluginMessage("skipto", [userid]);
  }

  Reset(): void {
    this.voting.Clear();
    this.StartTimer();
  }

  StartTimer(): void {
    if (this.option.afk_check_interval_ms == 0 || this.lobby.host == null || this.lobby.status != LobbyStatus.Entered) return;
    this.StopTimer();
    this.logger.trace("start afk check fimer");
    const target = this.lobby.host;
    this.afkTimer = setTimeout(async () => {
      if (!this.lobby.isMatching && this.lobby.host == target) {
        try {
          const stat1 = await this.lobby.RequestStatAsync(target, true, 1000);
          this.logger.trace("stat check phase 1 %s -> %s", stat1.name, StatStatuses[stat1.status]);
          if (this.afkTimer != undefined && this.lobby.host == target && this.statIsAfk(stat1.status)) {
            // double check and show stat for players
            const stat2 = await this.lobby.RequestStatAsync(target, false, 1000);
            this.logger.trace("stat check phase 2 %s -> %s", stat2.name, StatStatuses[stat2.status]);
            if (this.afkTimer != undefined && this.lobby.host == target && this.statIsAfk(stat2.status)) {
              this.logger.trace("passed afk check");
              if (this.option.afk_check_do_skip) {
                this.Skip();
                return;
              } else {
                this.lobby.SendMessage("bot : you can skip afk host by !skip command.");
              }
            }
          }
          // restart timer
          this.StartTimer();
        } catch {
          this.logger.warn("stat check timeout!");
        }
      }
    }, this.option.afk_check_interval_ms);
  }

  StopTimer(): void {
    if (this.afkTimer != undefined) {
      this.logger.trace("stop timer");
      clearTimeout(this.afkTimer);
      this.afkTimer = undefined;
    }
  }

  private statIsAfk(stat: StatStatuses) {
    return stat != StatStatuses.Multiplayer && stat != StatStatuses.Multiplaying;
  }

  GetPluginStatus(): string {
    return `-- Host Skipper --
  timer : ${this.afkTimer != undefined ? "active" : "---"}
  skip_vote : ${this.voting.toString()}`;
  }

  GetInfoMessage(): string[] {
    return ["!skip => skip current host."];
  }
}
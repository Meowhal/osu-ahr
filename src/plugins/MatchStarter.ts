import { Lobby } from "..";
import { Player } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import { VoteCounter } from "./VoteCounter";
import { BanchoResponseType } from "../parsers";
import config from "config";

export interface MatchStarterOption {
  vote_rate: number; // 投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
}

const defaultOption = config.get<MatchStarterOption>("MatchStarter");

export class MatchStarter extends LobbyPlugin {
  option: MatchStarterOption;
  voting: VoteCounter;
  isTimerActive: boolean = false;

  constructor(lobby: Lobby, option: Partial<MatchStarterOption> = {}) {
    super(lobby, "starter");
    this.option = { ...defaultOption, ...option } as MatchStarterOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player, a.succeeded));
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.command, a.param));
    this.lobby.MatchStarted.on(() => this.onMatchStarted());
    this.lobby.RecievedBanchoResponse.on(a => {
      if (a.response.type == BanchoResponseType.AllPlayerReady) {
        this.onAllPlayerReady()
      }
    });
  }

  private onPlayerJoined(player: Player) {
    this.voting.AddVoter(player);
  }

  private onPlayerLeft(player: Player): any {
    this.voting.RemoveVoter(player);
    if (this.lobby.isMatching) return;

    this.checkVoteCount();
  }

  private onHostChanged(player: Player, succeeded: boolean): any {
    if (!succeeded || this.lobby.isMatching) return;
    this.voting.Clear();
    this.stopTimer();
  }

  private onAllPlayerReady(): void {
    if (!this.isTimerActive) {
      this.start();
    }
  }

  private onCustomCommand(player: Player, command: string, param: string): any {
    if (this.lobby.isMatching) return;

    switch (command) {
      case "!start":
        if (param == "") {
          if (player.isHost) {
            this.start();
          } else {
            this.vote(player);
          }
        } else if ((player.isHost || player.isAuthorized) && param.match(/^\d+$/)) {
          this.startTimer(parseInt(param));
        }
        break;
      case "!stop":
      case "!abort":
        if (player.isHost || player.isAuthorized) {
          this.stopTimer();
        }
        break;
      case "*start":
        if (player.isAuthorized) {
          this.start();
        }
    }
  }

  private onMatchStarted() {
    this.isTimerActive = false;
  }

  private vote(player: Player) {
    if (this.voting.passed) return;
    if (this.voting.Vote(player)) {
      this.logger.trace("accepted start request from %s", player.id);
      this.checkVoteCount(true);
    } else {
      this.logger.trace("vote was ignored");
    }
  }

  // 投票状況を確認して、必要数に達している場合は試合を開始する
  private checkVoteCount(showMessage: boolean = false): void {
    if (this.voting.count != 0 && showMessage) {
      this.lobby.DeferMessage(`bot : Match start progress: ${this.voting.toString()}`, "match start vote", 5000, false);
    }
    if (this.voting.passed) {
      this.lobby.DeferMessage(`bot : passed start vote: ${this.voting.toString()}`, "match start vote", 100, true);
      this.start();
    }
  }

  private startTimer(count: number) {
    if (count == 0) {
      this.start();
    } else {
      this.lobby.SendMessage("!mp start " + count);
      this.isTimerActive = true;
    }
  }

  private start() {
    this.lobby.SendMessageWithCoolTime("!mp start", "mp_start", 1000);
  }

  private stopTimer() {
    if (this.isTimerActive) {
      this.lobby.SendMessage("!mp aborttimer");
      this.isTimerActive = false;
    }
  }

  getPluginStatus(): string {
    return `-- MatchStarter --
  timer : ${this.isTimerActive ? "active" : "--"}
  vote : ${this.voting.toString()}`;
  }

  getInfoMessage(): string[] {
    return [
      "!start => Starts the match.",
      "!start [seconds] => Begins start timer. And can stop the timer with !stop."
    ];
  }
}
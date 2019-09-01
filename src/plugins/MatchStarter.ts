import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import log4js from "log4js";
import { VoteCounter } from "./VoteCounter";
import { BanchoResponseType } from "../parsers";
const logger = log4js.getLogger("matchStarter");

export interface MatchStarterOption {
  vote_rate: number; // 投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
}

const defaultOption = config.get<MatchStarterOption>("MatchStarter");

export class MatchStarter extends LobbyPlugin {
  option: MatchStarterOption;
  voting: VoteCounter;
  isTimerActive: boolean = false;

  constructor(lobby: ILobby, option: any | null = null) {
    super(lobby);
    this.option = { ...defaultOption, ...option } as MatchStarterOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player, a.succeeded));
    this.lobby.ReceivedCustomCommand.on(a => this.onCustomCommand(a.player, a.authority, a.command, a.param));
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

  private onCustomCommand(player: Player, authority: number, command: string, param: string): any {
    if (this.lobby.isMatching) return;

    if (player == this.lobby.host || authority >= 2) {
      if (command == "!start") {
        if (param == "") {
          this.start();
        } else if (param.match(/^\d+$/)) {
          this.startTimer(parseInt(param));
        }
        return;
      } else if (command == "!stop" || command == "!abort") {
        this.stopTimer();
        return;
      }
    }
    if (authority >= 2 && command == "*start") {
      this.start();
      return;
    }
    if (command == "!start") {
      this.vote(player);
    }
  }

  private vote(player: Player) {
    if (this.voting.passed) return;
    if (this.voting.Vote(player)) {
      logger.trace("accepted start request from %s", player.id);
      this.checkVoteCount(true);
    } else {
      logger.trace("vote was ignored");
    }
  }

  // スキップ状況を確認して、必要数に達している場合は
  private checkVoteCount(showMessage: boolean = false): void {
    if (this.voting.count != 0 && showMessage) {
      this.lobby.SendMessageWithCoolTime(`bot : Match start progress: ${this.voting.toString()}`, "checkSkipCount", 5000);
    }
    if (this.voting.passed) {
      this.start();
    }
  }

  private startTimer(count: number) {
    if (count == 0) {
      this.lobby.SendMessage("!mp start");
    } else {
      this.lobby.SendMessage("!mp start " + count);
      this.isTimerActive = true;
    }
  }

  private start() {
    this.lobby.SendMessage("!mp start");
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
    vote : ${this.voting.toString()}
  `;
  }

  getInfoMessage(): string[] {
    return [
      "!start => Starts the match.",
      "!start [seconds] => Begins start timer. And can stop the timer with !stop."
    ];
  }
}
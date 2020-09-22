import { Lobby } from "..";
import { BanchoResponseType, MpSettingsResult } from "../parsers";
import { Player } from "../Player";
import { LobbyPlugin } from "./LobbyPlugin";
import { VoteCounter } from "./VoteCounter";
import config from "config";

export interface MatchStarterOption {
  vote_rate: number; // 投票時の必要数/プレイヤー数
  vote_min: number;　// 最低投票数
}

const defaultOption = config.get<MatchStarterOption>("MatchStarter");

export class MatchStarter extends LobbyPlugin {
  option: MatchStarterOption;
  voting: VoteCounter;

  constructor(lobby: Lobby, option: Partial<MatchStarterOption> = {}) {
    super(lobby, "starter");
    this.option = { ...defaultOption, ...option } as MatchStarterOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
    this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
    this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result, a.playersIn, a.playersOut, a.hostChanged));
    this.lobby.ReceivedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.AllPlayerReady:
          this.onAllPlayerReady();
          break;
        case BanchoResponseType.MatchStarted:
          this.stopTimer();
          break;
      }

    });
  }

  private onPlayerJoined(player: Player): void {
    this.voting.AddVoter(player);
  }

  private onPlayerLeft(player: Player): void {
    this.voting.RemoveVoter(player);
    if (this.lobby.isMatching) return;

    this.checkVoteCount();
  }

  private onHostChanged(player: Player): void {
    if (this.lobby.isMatching) return;
    this.voting.Clear();
    this.stopTimer();
  }

  private onAllPlayerReady(): void {
    this.start();
  }

  private onParsedSettings(result: MpSettingsResult, playersIn: Player[], playersOut: Player[], hostChanged: boolean): void {
    playersOut.forEach(p => this.voting.RemoveVoter(p));
    playersIn.forEach(p => this.voting.AddVoter(p));
    this.voting.Clear();
  }

  private onChatCommand(player: Player, command: string, param: string): void {
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
          if (this.IsSelfStartTimerActive) {
            this.lobby.SendMessage("Aborted the match start timer");
            this.stopTimer();
          }          
        }
        break;
      case "*start":
        if (player.isAuthorized) {
          this.start();
        }
    }
  }

  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type == "mp_start") {
      if (args.length == 0) {
        this.start();
      } else {
        const count = parseInt(args[0]);
        this.startTimer(count);
      }
    } else if (type == "mp_abort_start") {
      this.stopTimer();
    }
  }

  private vote(player: Player): void {
    if (this.voting.passed) return;
    if (this.voting.Vote(player)) {
      this.logger.trace("accepted start request from %s", player.name);
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

  private startTimer(count: number): void {
    if (count == 0) {
      this.start();
    } else {
      this.lobby.SendMessage(`Queued the match to start in ${count} seconds`);
      this.lobby.DeferMessage("!mp start", "mp_start", count * 1000, true);
      if (15 < count) {
        this.lobby.DeferMessage("Match starts in 10 seconds", "mp_start 10 sec", (count - 10) * 1000, true);
      }
    }
  }

  private start(): void {
    this.stopTimer();
    this.lobby.SendMessageWithCoolTime("!mp start", "mp_start", 1000, true);
  }

  private stopTimer(): void {
    this.lobby.CancelDeferredMessage("mp_start");
    this.lobby.CancelDeferredMessage("mp_start 10 sec");

    if (this.lobby.isStartTimerActive) {
      this.lobby.SendMessage("!mp aborttimer");
    }
  }

  get IsSelfStartTimerActive(): boolean {
    if ("mp_start" in this.lobby.deferredMessages) {
      return !this.lobby.deferredMessages["mp_start"].done
    }
    return false;
  }

  GetPluginStatus(): string {
    return `-- MatchStarter --
  vote : ${this.voting.toString()}`;
  }

  GetInfoMessage(): string[] {
    return [
      "!start => Starts the match.",
      "!start [seconds] => Begins start timer. And can stop the timer with !stop."
    ];
  }
}
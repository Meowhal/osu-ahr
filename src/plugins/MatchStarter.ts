import { Lobby } from '../Lobby';
import { BanchoResponseType } from '../parsers/CommandParser';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { VoteCounter } from './VoteCounter';
import { getConfig } from '../TypedConfig';

export interface MatchStarterOption {
  vote_rate: number; // 投票時の必要数/プレイヤー数
  vote_min: number; // 最低投票数
  vote_msg_defer_ms: number;
  start_when_all_player_ready: boolean; // 全員準備完了したら試合を始める
}

export class MatchStarter extends LobbyPlugin {
  option: MatchStarterOption;
  voting: VoteCounter;

  constructor(lobby: Lobby, option: Partial<MatchStarterOption> = {}) {
    super(lobby, 'MatchStarter', 'starter');
    this.option = getConfig(this.pluginName, option) as MatchStarterOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
    this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
    this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
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
    if (this.lobby.players.size === 0) {
      this.stopTimer();
    }
  }

  private onHostChanged(player: Player): void {
    if (this.lobby.isMatching) return;
    this.voting.Clear();
    this.stopTimer();
  }

  private onAllPlayerReady(): void {
    if (this.option.start_when_all_player_ready) {
      this.start();
    }
  }

  private onChatCommand(player: Player, command: string, param: string): void {
    if (this.lobby.isMatching) return;

    switch (command) {
      case '!start':
        if (param === '') {
          if (player.isHost) {
            this.start();
          } else {
            this.vote(player);
          }
        } else if ((player.isHost || player.isAuthorized) && param.match(/^\d+$/)) {
          this.startTimer(parseInt(param));
        }
        break;
      case '!stop':
      case '!abort':
        if (player.isHost || player.isAuthorized) {
          if (this.IsSelfStartTimerActive) {
            this.lobby.SendMessage('Aborted the match start timer.');
            this.stopTimer();
          }
        }
        break;
      case '*start':
        if (player.isAuthorized) {
          this.start();
        }
    }
  }

  private onPluginMessage(type: string, args: string[], src: LobbyPlugin | null): void {
    if (type === 'mp_start') {
      if (args.length === 0) {
        this.start();
      } else {
        const count = parseInt(args[0]);
        const withhelp = args[1] !== undefined && args[1] === 'withhelp';
        this.startTimer(count, withhelp);
      }
    } else if (type === 'mp_abort_start') {
      this.stopTimer();
    }
  }

  private vote(player: Player): void {
    if (this.voting.passed) return;
    if (this.voting.Vote(player)) {
      this.logger.trace(`Accepted a match start request from player ${player.name}`);
      this.checkVoteCount(true);
    } else {
      this.logger.trace('A match start vote was ignored.');
    }
  }

  // 投票状況を確認して、必要数に達している場合は試合を開始する
  private checkVoteCount(showMessage: boolean = false): void {
    if (this.voting.count !== 0 && showMessage) {
      this.lobby.DeferMessage(`Bot: Match start progress: ${this.voting.toString()}`, 'match start vote', this.option.vote_msg_defer_ms, false);
    }
    if (this.voting.passed) {
      this.lobby.DeferMessage(`Bot: Passed a match start vote: ${this.voting.toString()}`, 'match start vote', 100, true);
      this.start();
    }
  }

  private startTimer(count: number, withHint: boolean = false): void {
    if (count === 0) {
      this.start();
    } else {
      this.lobby.SendMessage(`Queued the match to start in ${this.secsToCountdownText(count)}${withHint ? '. (Host can stop the timer with !stop command.)' : ''}`);
      this.lobby.DeferMessage('!mp start', 'mp_start', count * 1000, true);
      if (count > 15) {
        this.lobby.DeferMessage('Match starts in 10 seconds', 'mp_start 10 sec', (count - 10) * 1000, true);
      }
    }
  }

  private secsToCountdownText(secs: number): string {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);

    let strMin = '';
    let strAnd = '';
    let strSec = '';

    if (min > 1) {
      strMin = `${min.toString()} minutes`;
    } else if (min === 1) {
      strMin = '1 minute';
    }

    if (min > 0 && sec > 0) {
      strAnd = ' and ';
    }

    if (sec > 1) {
      strSec = `${sec.toString()} seconds`;
    } else if (sec === 1) {
      strSec = '1 second';
    }

    return `${strMin}${strAnd}${strSec}`;
  }

  private start(): void {
    this.stopTimer();
    this.lobby.SendMessageWithCoolTime('!mp start', 'mp_start', 1000);
    this.voting.Clear();
  }

  private stopTimer(): void {
    this.lobby.CancelDeferredMessage('mp_start');
    this.lobby.CancelDeferredMessage('mp_start 10 sec');
    this.lobby.CancelDeferredMessage('match start vote');

    if (this.lobby.isStartTimerActive) {
      this.lobby.SendMessage('!mp aborttimer');
    }
  }

  get IsSelfStartTimerActive(): boolean {
    if ('mp_start' in this.lobby.deferredMessages) {
      return !this.lobby.deferredMessages['mp_start'].done;
    }
    return false;
  }

  GetPluginStatus(): string {
    return `-- Match Starter --
  Vote: ${this.voting.toString()}`;
  }
}

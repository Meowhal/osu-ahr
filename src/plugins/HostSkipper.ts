import { Lobby, LobbyStatus } from '../Lobby';
import { Player, escapeUserName } from '../Player';
import { BanchoResponseType } from '../parsers/CommandParser';
import { StatStatuses, StatResult } from '../parsers/StatParser';
import { LobbyPlugin } from './LobbyPlugin';
import { VoteCounter } from './VoteCounter';
import { getConfig } from '../TypedConfig';

export interface HostSkipperOption {
  vote_rate: number; // ホストスキップ投票時の必要数/プレイヤー数
  vote_min: number; // 最低投票数
  vote_cooltime_ms: number; // 投票受付までの猶予時間 前回の巻き込み投票防止
  vote_msg_defer_ms: number; // 投票メッセージの延期時間
  afk_check_timeout_ms: number; // statcheckのタイムアウト時間
  afk_check_interval_first_ms: number; // 初回のホストAfkチェックまでの時間
  afk_check_interval_ms: number; // ホストAfkチェックの初回以降の間隔
  afk_check_do_skip: boolean; // 実際にスキップするか？
}

/**
 * スキップ処理の受付部分を担当
 * スキップが受け付けられると、pluginMessageを介して他のプラグインに処理を依頼する。
 */
export class HostSkipper extends LobbyPlugin {
  option: HostSkipperOption;
  afkTimer: NodeJS.Timer | undefined;
  timeHostChanged: number = 0;
  voting: VoteCounter;
  isMapChanged: boolean = false;

  // skip受付からの経過時間
  get elapsedSinceHostChanged(): number {
    return Date.now() - this.timeHostChanged;
  }

  constructor(lobby: Lobby, option: Partial<HostSkipperOption> = {}) {
    super(lobby, 'HostSkipper', 'skipper');
    this.option = getConfig(this.pluginName, option) as HostSkipperOption;
    this.voting = new VoteCounter(this.option.vote_rate, this.option.vote_min);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
    this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
    this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
    this.lobby.PlayerChated.on(a => this.onPlayerChated(a.player));
    this.lobby.ParsedStat.on(a => this.onParsedStat(a.player, a.result, a.isPm));
    this.lobby.LeftChannel.on(() => this.StopTimer());
    this.lobby.ReceivedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.MatchStarted:
          this.isMapChanged = false;
          this.voting.Clear();
          this.StopTimer();
          break;
        case BanchoResponseType.HostChanged:
          this.Reset();
          break;
        case BanchoResponseType.BeatmapChanging:
          this.StartTimer(false);
          break;
        case BanchoResponseType.BeatmapChanged:
          this.StartTimer(false);
          this.isMapChanged = true;
          break;
      }
    });
  }

  private onPlayerJoined(player: Player) {
    this.voting.AddVoter(player);

    // 一人だけいるプレイヤーがAFKなら新しく入ってきた人をホストにする
    if (this.lobby.players.size === 2 && this.lobby.host && this.lobby.host.laststat) {
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
    if (this.lobby.players.size === 0) {
      this.voting.Clear();
      this.StopTimer();
    }
  }

  private onPlayerChated(player: Player): void {
    if (this.lobby.host === player) {
      // reset current timer and restart
      this.StartTimer(false);
    }
  }

  private onParsedStat(player: Player, result: StatResult, isPm: boolean): void {
    if (!isPm && this.lobby.host === player && this.statIsAfk(result.status) && !this.lobby.isMatching) {
      this.logger.trace(`Passed an AFK check ${result.name} -> ${StatStatuses[result.status]}`);
      if (this.option.afk_check_do_skip) {
        this.Skip();
      } else {
        if (this.isMapChanged) {
          this.lobby.SendMessage('Bot: Players can start the match with !start to vote.');
        } else {
          this.lobby.SendMessage('Bot: Players can skip the AFK host with !skip to vote.');
        }
      }
    }
  }

  // スキップメッセージを処理
  private onChatCommand(player: Player, command: string, param: string): void {
    if (this.lobby.isMatching) return;

    if (command === '!skip') {
      if (param !== '' && this.lobby.host && escapeUserName(param) !== this.lobby.host.escaped_name) return; // 関係ないユーザーのスキップは無視
      this.vote(player);
    } else if (player.isAuthorized) {
      if (command === '*skip') {
        this.Skip();
      } else if (command === '*skipto' && param !== '') {
        this.SkipTo(param);
      }
    }
  }

  private vote(player: Player): void {
    if (this.voting.passed) {
      this.logger.debug(`A host skip vote from player ${player.name} was ignored, already skipped.`);
    } else if (this.elapsedSinceHostChanged < this.option.vote_cooltime_ms) {
      this.logger.debug(`A host skip vote from player ${player.name} was ignored, done during cooltime.`);
      if (player.isHost) {
        const secs = (this.option.vote_cooltime_ms - this.elapsedSinceHostChanged) / 1000;
        this.lobby.SendMessage(`The host skip command is currently in cooltime. You have to wait ${secs.toFixed(2)} sec(s).`);
      }
    } else if (player.isHost) {
      this.logger.debug(`The host (Player ${player.name}) sent !skip command.`);
      this.Skip();
    } else {
      if (this.voting.Vote(player)) {
        this.logger.trace(`Accepted a host skip request from player ${player.name}`);
        this.checkSkipCount(true);
      } else {
        this.logger.debug(`A host skip vote from player ${player.name} was ignored, voted twice.`);
      }
    }
  }

  // スキップ状況を確認して、必要数に達している場合は
  private checkSkipCount(showMessage: boolean = false): void {
    if (this.voting.count !== 0 && showMessage) {
      this.lobby.DeferMessage(`Bot: Host skip progress: ${this.voting.toString()}`, 'checkSkipCount', this.option.vote_msg_defer_ms, false);
    }
    if (this.voting.passed) {
      this.lobby.DeferMessage(`Bot: Passed a host skip vote: ${this.voting.toString()}`, 'checkSkipCount', 100, true);
      this.Skip();
    }
  }

  Skip(): void {
    this.logger.info('Skipping host...');
    this.StopTimer();
    this.SendPluginMessage('skip');
    this.timeHostChanged = Date.now();
  }

  SkipTo(username: string): void {
    if (!this.lobby.Includes(username)) {
      this.logger.info(`Cannot skip the host to an invalid username: ${username}`);
      return;
    }
    this.logger.info(`The host has been skipped to: ${username}`);
    this.StopTimer();
    this.SendPluginMessage('skipto', [username]);
  }

  Reset(): void {
    this.voting.Clear();
    this.StartTimer(true);
    this.timeHostChanged = Date.now();
  }

  StartTimer(isFirst: boolean): void {
    if (this.option.afk_check_interval_ms === 0 || !this.lobby.host || this.lobby.status !== LobbyStatus.Entered || this.lobby.isMatching) return;
    this.StopTimer();
    this.logger.trace('Started the AFK check timer.');
    const target = this.lobby.host;
    this.afkTimer = setTimeout(async () => {
      if (!this.lobby.isMatching && this.lobby.host === target) {
        try {
          const stat1 = await this.lobby.RequestStatAsync(target, true, this.option.afk_check_timeout_ms);
          this.logger.trace(`Stat check phase 1 ${stat1.name} -> ${StatStatuses[stat1.status]}`);
          if (this.afkTimer !== undefined && this.lobby.host === target && this.statIsAfk(stat1.status)) {
            // double check and show stat for players
            await this.lobby.RequestStatAsync(target, false, this.option.afk_check_timeout_ms);
          }
        } catch {
          this.logger.warn('Stat check timed out!');
        }
        // StopTimerが呼び出されていない、かつホストがターゲットと同じならタイマー再開
        if (this.afkTimer !== undefined && this.lobby.host === target) {
          this.StartTimer(false);
        }
      }
    }, isFirst ? this.option.afk_check_interval_first_ms : this.option.afk_check_interval_ms);
  }

  StopTimer(): void {
    if (this.afkTimer !== undefined) {
      this.logger.trace('Stopping the AFK Check timer...');
      clearTimeout(this.afkTimer);
      this.afkTimer = undefined;
    }
  }

  private statIsAfk(stat: StatStatuses) {
    return stat !== StatStatuses.Multiplayer && stat !== StatStatuses.Multiplaying;
  }

  GetPluginStatus(): string {
    return `-- Host Skipper -- 
  Timer: ${this.afkTimer !== undefined ? 'Active' : '###'}
  Skip vote: ${this.voting.toString()}`;
  }
}

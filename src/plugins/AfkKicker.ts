import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { StatStatuses } from '../parsers/StatParser';
import { LobbyPlugin } from './LobbyPlugin';
import { getConfig } from '../TypedConfig';

/*
TODO: AFK_allowedについて

加算判定
statでafk判定 指定時間 +3
スコアなしで試合終了 +2
ゲーム未参加 開始時にいたけどfinishしない +1

減算判定
スコアありで試合終了 0にリセット
チャット -1

問題点
マップ未所持プレイヤーが入室直後に試合が始まりそのままロビーに残っていた場合、AFKポイントが加算される

*/

const POINT_STAT_AFK = 3;
const POINT_NO_SCORE = 2;
const POINT_NO_MAP = 2;
const POINT_HAS_SCORE = -100;
const POINT_CHAT = -1;

export interface AfkKickerOption {

    enabled: boolean;

    /**
     * AFK judgment threshold
     */
    threshold: number;

    /**
     * Cool time between afk judgments (mill sec)
     */
    cooltime_ms: number;
}


class PlayerState {
  /**
     * 最後の試合のスコア
     * 試合開始時に全員0にセットされ、playerfinishedの値がセットされる。
     * 全員終了時に０のプレイヤーはafkCount + 1される
     * マップ未所持のプレイヤーもカウントされる
     */
  score: number = -1;

  /**
     * 試合開始時にロビーにいたかどうか
     * マップ不所持判定に使用する
     */
  isPlaying: boolean = false;

  /**
     * 最後にAFK判定された時間 !statを連続使用された際に上昇数を制限するため
     */
  timeLastChange: number = 0;

  /**
     * AFK判定点
     */
  afkPoint: number = 0;

  constructor() {
    this.timeLastChange = Date.now();
  }
}


export class AfkKicker extends LobbyPlugin {
  option: AfkKickerOption;
  playerStats: Map<Player, PlayerState>;
  constructor(lobby: Lobby, option: Partial<AfkKickerOption> = {}) {
    super(lobby, 'AfkKicker', 'afk');
    this.option = getConfig(this.pluginName, option) as AfkKickerOption;
    this.playerStats = new Map();
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(({ player }) => {
      this.playerStats.set(player, new PlayerState());
    });
    this.lobby.PlayerLeft.on(({ player }) => {
      this.playerStats.delete(player);
    });
    this.lobby.MatchStarted.on(() => {
      for (const stat of this.playerStats.values()) {
        stat.isPlaying = true;
        stat.score = -1;
      }
    });
    this.lobby.PlayerFinished.on(({ player, score }) => {
      const stat = this.playerStats.get(player);
      if (stat) {
        stat.score = score;
      }
    });
    this.lobby.MatchFinished.on(() => {
      for (const [player, stat] of this.playerStats.entries()) {
        if (stat.isPlaying) {
          if (stat.score === -1) {
            this.changeAfkPoint(player, stat, POINT_NO_MAP, 'NO_MAP');
          } else if (stat.score === 0) {
            this.changeAfkPoint(player, stat, POINT_NO_SCORE, 'NO_SCORE');
          } else {
            this.changeAfkPoint(player, stat, POINT_HAS_SCORE, 'HAS_SCORE');
          }
        }
        stat.isPlaying = false;
        stat.score = 0;
      }
    });
    this.lobby.PlayerChated.on(({ player }) => {
      const stat = this.playerStats.get(player);
      if (stat) {
        this.changeAfkPoint(player, stat, POINT_CHAT, 'CHATED');
      }
    });
    this.lobby.ParsedStat.on(({ player, result }) => {
      const stat = this.playerStats.get(player);
      if (stat && result.status === StatStatuses.Afk) {
        this.changeAfkPoint(player, stat, POINT_STAT_AFK, 'AFK_STAT');
      }
    });
    this.lobby.ReceivedChatCommand.on(({ player, command, param }) => this.onReceivedChatCommand(player, command, param));

  }

  changeAfkPoint(player: Player, stat: PlayerState, delta: number, reason: string) {
    if (!this.option.enabled) return;
    const now = Date.now();
    if (now < stat.timeLastChange + this.option.cooltime_ms) return;

    if (!this.lobby.players.has(player)) {
      this.playerStats.delete(player);
      return;
    }
    stat.timeLastChange = now;
    stat.afkPoint += delta;
    if (delta > 0) {
      this.logger.info(`Detected player ${player.escaped_name} is AFK. Reason: ${reason}(${(delta > 0 ? '+' : '') + delta}), ${stat.afkPoint} / ${this.option.threshold}`);
    }

    if (stat.afkPoint < 0) {
      stat.afkPoint = 0;
    } else if (this.option.threshold <= stat.afkPoint) {
      this.lobby.SendMessage(`!mp kick ${player.escaped_name}`);
      this.lobby.SendMessage('Bot: Kicked an AFK player.');
      this.logger.info(`Kicked player ${player.escaped_name}`);
    }
  }

  private onReceivedChatCommand(player: Player, command: string, param: string) {
    if (!player.isAuthorized) return;
    switch (command) {
      case '*afkkick_enable':
        this.option.enabled = true;
        this.logger.info('AFK Kicker plugin enabled.');
        break;
      case '*afkkick_disable':
        this.option.enabled = false;
        this.logger.info('AFK Kicker plugin disabled.');
        break;
      case '*afkkick_threshold':
        let th = parseInt(param);
        if (Number.isNaN(th)) {
          this.logger.warn(`Invalid AFK Kicker threshold parameter: ${param}`);
          return;
        }
        th = Math.max(th, 1);
        this.option.threshold = th;
        this.logger.info(`Threshold for AFK Kicker set to ${th}`);
        break;
      case '*afkkick_cooltime':
        let ct = parseInt(param);
        if (Number.isNaN(ct)) {
          this.logger.warn(`Invalid AFK Kicker cooltime parameter: ${param}`);
          return;
        }
        ct = Math.max(ct, 10000);
        this.option.cooltime_ms = ct;
        this.logger.info(`Cooltime(ms) for AFK Kicker set to ${ct}`);
        break;
    }
  }

  GetPluginStatus(): string {
    let points = [...this.playerStats.entries()]
      .filter(([player, stat]) => stat.afkPoint > 0)
      .map(([player, stat]) => `${player.escaped_name}: ${stat.afkPoint}`).join(',');
    if (points) {
      points = `\n  Points: ${points}`;
    }
    return `-- AFK Kicker --
  Status: ${this.option.enabled ? 'Enabled' : 'Disabled'}
  Threshold: ${this.option.threshold}
  Cooltime(ms): ${this.option.cooltime_ms} ${points}`;
  }
}

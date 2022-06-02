import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { BeatmapRepository } from '../webapi/BeatmapRepository';
import { ProfileRepository } from '../webapi/ProfileRepository';
import { getConfig } from '../TypedConfig';

export interface CacheCleanerOption {

    enabled: boolean;

    /**
     * interval ms
     */
    intervalMs: number;
}

export class CacheCleaner extends LobbyPlugin {
  option: CacheCleanerOption;
  cleanedAt: number;
  lastHeapSize: number;
  cleaning: boolean;

  constructor(lobby: Lobby, option: Partial<CacheCleanerOption> = {}) {
    super(lobby, 'CacheCleaner', 'cleaner');
    this.option = getConfig(this.pluginName, option) as CacheCleanerOption;
    this.cleanedAt = Date.now();
    this.lastHeapSize = process.memoryUsage().heapUsed;
    this.cleaning = false;
    this.registerEvents();
  }

  private registerEvents(): void {

    this.lobby.MatchStarted.on(() => {
      if (this.option.enabled && (this.cleanedAt + this.option.intervalMs < Date.now())) {
        setTimeout(() => {
          this.clearCache();
        }, 5000);
      }
    });

    this.lobby.ReceivedChatCommand.on(({ player, command, param }) => this.onReceivedChatCommand(player, command, param));
  }

  private onReceivedChatCommand(player: Player, command: string, param: string) {
    if (!player.isAuthorized) return;
    switch (command.toLocaleLowerCase()) {
      case '*clearcache_enable':
        this.option.enabled = true;
        this.logger.info('CacheCleaner plugin enabled.');
        break;
      case '*clearcache_disable':
        this.option.enabled = false;
        this.logger.info('CacheCleaner plugin disabled.');
        break;
      case '*clearcache':
      case '*clear':
        this.clearCache();
        break;
    }
  }

  private async clearCache() {
    try {
      await this.lobby.historyRepository.clearCache();
      BeatmapRepository.discardExpiredCache(this.option.intervalMs);
      ProfileRepository.discardExpiredCache(this.option.intervalMs);
      if (global.gc) {
        global.gc();
      }
      const currentMem = process.memoryUsage().heapUsed;
      this.logger.info(`Heap size: ${this.formatByte(this.lastHeapSize)} -> ${this.formatByte(currentMem)}`);
      this.lastHeapSize = currentMem;
      this.cleanedAt = Date.now();
    } catch (e: any) {
      this.logger.error(`@CacheCleaner#clearCache\n${e.message}\n${e.stack}`);
    }
  }

  private formatByte(numByte: number): string {
    if (isNaN(numByte)) return 'NaN';
    if (!isFinite(numByte)) return numByte > 0 ? '∞' : '-∞';
    const notations = ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi', 'Ri', 'Qi'];
    const sign = numByte >= 0 ? '' : '-';
    numByte = Math.abs(numByte);
    let idx = 0;
    while (numByte >= 1024) {
      numByte /= 1024;
      idx++;
    }
    const valueStr = numByte.toFixed(3).slice(0, 5);
    if (notations.length <= idx) {
      return `${sign}${valueStr}*2^${idx * 10}B`;
    } else {
      return `${sign}${valueStr}${notations[idx]}B`;
    }
  }

}

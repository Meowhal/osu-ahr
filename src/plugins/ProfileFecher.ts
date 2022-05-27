import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { LobbyPlugin } from './LobbyPlugin';
import { WebApiClient } from '../webapi/WebApiClient';
import { UserProfile } from '../webapi/UserProfile';
import { getConfig } from '../TypedConfig';

export interface ProfileFecherOption {
  profile_expired_day: number
}


export class ProfileFecher extends LobbyPlugin {
  option: ProfileFecherOption;
  hasError: boolean = false;
  profileMap: Map<string, UserProfile>;
  pendingNames: Set<string>;
  task: Promise<void>;

  constructor(lobby: Lobby, option: Partial<ProfileFecherOption> = {}) {
    super(lobby, 'profile', 'profile');
    this.option = getConfig(this.pluginName, option) as ProfileFecherOption;
    this.profileMap = new Map<string, UserProfile>();
    this.pendingNames = new Set<string>();
    this.task = this.initializeAsync();
    this.registerEvents();
  }

  private async initializeAsync(): Promise<void> {
    await WebApiClient.updateToken();
  }

  private registerEvents(): void {
    this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.player));
  }

  private onPlayerJoined(player: Player): void {
    if (this.hasError) return;
    this.addTaskQueueIfNeeded(player);
  }

  private addTaskQueueIfNeeded(player: Player): boolean {

    if (player.id !== 0) return false;
    const profile = this.profileMap.get(player.name);
    if (profile && !this.isExpiredProfile(profile)) {
      player.id = profile.id;
      player.profile = profile;
      return true;
    }

    if (this.pendingNames.has(player.name)) {
      return false;
    }
    this.pendingNames.add(player.name);

    this.task = this.task.then(async () => {
      try {
        const profile = await this.getProfileFromWebApi(player);

        if (profile !== null) {
          player.id = profile.id;
          player.profile = profile;
          this.logger.info(`Fetching player profile: ${player.name}`);
        } else {
          this.logger.warn(`Player cannot be found: ${player.name}`);
        }
        this.pendingNames.delete(player.name);
      } catch (e: any) {
        this.logger.error(`@ProfileFecher#addTaskQueueIfNeeded\n${e.message}\n${e.stack}`);
      }

    });

    return true;
  }

  private getProfileFromWebApi(player: Player): Promise<UserProfile | null> {
    return WebApiClient.getUser(player.name);
  }

  private isExpiredProfile(profile: UserProfile): boolean {
    return Date.now() < this.option.profile_expired_day * 24 * 60 * 60 * 1000 + profile.get_time;
  }
}

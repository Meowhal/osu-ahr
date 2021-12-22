import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType } from "../parsers";
import config from "config";
import { BeatmapRepository, FetchBeatmapError, FetchBeatmapErrorReason } from "../webapi/BeatmapRepository";
import { FetchProfileError, FetchProfileErrorReason, ProfileRepository } from "../webapi/ProfileRepository";

export interface MiscLoaderOption {
}

/**
 * Get beatmap mirror link from Beatconnect
 * Use !mirror to fetch the mirror link
 */
export class MiscLoader extends LobbyPlugin {
  option: MiscLoaderOption;
  canResend: boolean = true;
  rootURL: string = "https://beatconnect.io/b/";

  constructor(lobby: Lobby, option: Partial<MiscLoaderOption> = {}) {
    super(lobby, "MiscLoader", "miscLoader");
    const d = config.get<MiscLoaderOption>(this.pluginName);
    this.option = { ...d, ...option } as MiscLoaderOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player))
    this.lobby.ReceivedBanchoResponse.on(a => {
      if (a.response.type == BanchoResponseType.BeatmapChanged) {
        this.canResend = true;
      }
    });
  }

  private async onReceivedChatCommand(command: string, param: string, player: Player): Promise<void> {
    if (command == "!mirror") {
      if (this.canResend) {
        this.checkMirror(this.lobby.mapId);
      }
    }
    if (command == "!rank") {
      this.getProfile(player)
    }
  }

  async getProfile(player: Player){
    try {
      let currentPlayer = this.lobby.GetPlayer(player.name);
      if(!currentPlayer)
        return;
      if(currentPlayer.id == 0 || this.lobby.gameMode == undefined){
        this.lobby.SendMessageWithCoolTime("!stats " + currentPlayer.name, "!rank", 10000);
        return;
      }
      let selectedMode = "";
      switch(this.lobby.gameMode.value){
        case "0":
          selectedMode = "osu";
          break;
        case "1":
          selectedMode = "taiko";
          break;
        case "2":
          selectedMode = "fruits";
          break;
        case "3":
          selectedMode = "mania";
          break;
      }
      const profile = await ProfileRepository.getProfile(currentPlayer.id, selectedMode);
      
      const msg = profile.username + " your rank is #" + profile.statistics.global_rank;
      this.lobby.SendMessageWithCoolTime(msg, "!rank",5000);
    } catch (e: any) {
      if (e instanceof FetchProfileError) {
        switch (e.reason) {
          case FetchProfileErrorReason.FormatError:
            this.logger.error(`Couldn't parse the webpage. checked:${player.id}`);
            break;
          case FetchProfileErrorReason.NotFound:
            this.logger.info(`Profile not found. checked:${player.id}`);
            break;
        }
      } else {
        this.logger.error(`unexpected error. checking:${player.id}, err:${e.message}`);
      }
    }
  }

  async checkMirror(mapId: number): Promise<void> {
    try {
      let map = await BeatmapRepository.getBeatmap(mapId);
      this.canResend = false;
      if (!map) {
        this.lobby.SendMessage("Current beatmap doesn't have mirror...");
        this.canResend = false;
        return;
      }
      this.canResend = true;
      var downloadLink = this.rootURL + map.beatmapset_id;
      this.lobby.SendMessageWithCoolTime("Alternative download link for [" + downloadLink + " " + map.beatmapset?.title + "]", "!mirror", 5000);
    } catch (e: any) {
      this.canResend = false;
      if (e instanceof FetchBeatmapError) {
        switch (e.reason) {
          case FetchBeatmapErrorReason.FormatError:
            this.logger.error(`Couldn't parse the webpage. checked:${mapId}`);
            break;
          case FetchBeatmapErrorReason.NotFound:
            this.logger.info(`Map can not be found. checked:${mapId}`);
            break;
          case FetchBeatmapErrorReason.PlayModeMismatched:
            this.logger.info(`Gamemode Mismatched. checked:${mapId}`);
            break;
          case FetchBeatmapErrorReason.NotAvailable:
            this.logger.info(`Map is not available. checked:${mapId}`);
            break;
        }
      } else {
        this.logger.error(`unexpected error. checking:${mapId}, err:${e.message}`);
      }
    }
  }
}
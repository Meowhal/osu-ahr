import { Lobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType } from "../parsers";
import { WebApiClient } from "../webapi/WebApiClient";
import { Beatmap } from "../webapi/Beatmapsets";
import config from "config";
import { BeatmapRepository } from "../webapi/BeatmapRepository";

export interface MapMirrorLoaderOption {
}

/**
 * Get beatmap mirror link from Beatconnect
 * Use !mirror to fetch the mirror link
 */
export class MapMirrorLoader extends LobbyPlugin {
  option: MapMirrorLoaderOption;
  canResend: boolean = true;
  rootURL: string = "https://beatconnect.io/b/";
  maps: { [id: number]: Beatmap & { fetchedAt: number } } = {};
  webApiClient: WebApiClient | null;
  mirrorExist: boolean = false;
  constructor(lobby: Lobby, client: WebApiClient | null = null, option: Partial<MapMirrorLoaderOption> = {}) {
    super(lobby, "MapMirrorLoader", "mirrorLoader");
    const d = config.get<MapMirrorLoaderOption>(this.pluginName);
    this.option = { ...d, ...option } as MapMirrorLoaderOption;
    this.webApiClient = client;
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
        this.checkMirror(this.lobby.mapId,this.lobby.mapTitle);
      }
    }
  }

  private async getBeatmap(mapId: number): Promise<Beatmap | undefined> {
    // check cache
    if (mapId in this.maps) {
      const v = this.maps[mapId];
      //Cache map for 1 day
      if (Date.now() < v.fetchedAt + 1 * 24 * 3600 * 1000) {
        return v;
      }
    }

    let q = null;
    if (this.webApiClient) {
      try {
        q = await this.webApiClient.lookupBeatmap(mapId);
      } catch (e) {
        if (e instanceof Error) {
          this.logger.error(e.message);
        } else {
          this.logger.error(e);
        }
        if (!this.webApiClient.token) {
          this.webApiClient = null;
        }
      }
    }

    if (!q) {
      try {
        q = await BeatmapRepository.getBeatmap(mapId);
      } catch (e) {
        if (e instanceof Error) {
          this.logger.error(e.message);
        } else {
          this.logger.error(e);
        }
      }
    }

    if (q) {
      let v = { ...q, fetchedAt: Date.now() };
      this.maps[mapId] = v;
      return v;
    }

  }

  async checkMirror(mapId: number, mapTitle: string): Promise<void>{
    let map = await this.getBeatmap(mapId);
    this.canResend = false;
    if (!map) {
      this.mirrorExist = false;
      this.lobby.SendMessage("Current beatmap doesn't have mirror...");
      return;
    }
    this.mirrorExist = true;
    var downloadLink = this.rootURL + map.beatmapset_id;
    this.lobby.SendMessage("Alternative Download Link for ["+ downloadLink +" "+this.lobby.mapTitle+"]");
  }
}
import { ILobby, Player } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType } from "../parsers";
import config from "config";
import log4js from "log4js";

const logger = log4js.getLogger("mapRecaster");

export interface MapRecasterOption {
}

const DefaultOption = config.get<MapRecasterOption>("MapRecaster");

/**
 * ホストが古いバージョンのマップを選択した際に、コマンドでマップを貼り直して最新版にする。
 * !updateコマンドなどで発動。マップ選択後に1度だけ実行できる。
 */
export class MapRecaster extends LobbyPlugin {
  option: MapRecasterOption;
  canRecast: boolean = true;
  constructor(lobby: ILobby, option: Partial<MapRecasterOption> = {}) {
    super(lobby);
    this.option = { ...DefaultOption, ...option } as MapRecasterOption;
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.ReceivedCustomCommand.on(a => this.onReceivedCustomCommand(a.command, a.param, a.player))
    this.lobby.RecievedBanchoResponse.on(a => {
      if (a.response.type == BanchoResponseType.BeatmapChanged) {
        this.canRecast = true;
      }
    });
  }

  onReceivedCustomCommand(command: string, param: string, player: Player): any {
    if(command == "!update") {
      if (this.canRecast) {
        this.canRecast = false;
        this.lobby.SendMessage("!mp map " + this.lobby.mapId);
      }
    }
  }

  getInfoMessage(): string[] {
    return ["!update => update selected map. use when host has old map."]
  }

}
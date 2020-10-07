import { Lobby } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType } from "../parsers";
import { WebApiClient } from "../webapi/WebApiClient";

import config from "config";
import { Beatmap, fetchBeatmap } from "../webapi/Beatmapsets";
import { Player } from "../Player";

const ValidatorConstructors: { [id: string]: ValidatorConstructor } = {};

export function RegisterValidatorConstructor(v: ValidatorConstructor, name: string) {
  if (name in ValidatorConstructors) {
    throw new Error("validator name conflict detected: " + name);
  }
  ValidatorConstructors[name] = v;
}

export type ValidatorConstructor = (paret: MapChecker) => IValidator;

export interface IValidator {
  /**
   * returns Penalty points 0 to 1.
   * 0 means accepted, above 0 means rejected.
   * Penalty points are accumulated and the host will be punished if the point reaches 1.
   * @param map target beatmap
   * @param parent mapchecker plugin
   */
  RateBeatmap(map: Beatmap, parent: MapChecker): number;

  /**
   * Handles configuration change commands
   * from osu chat (only bot owner): *regulation [configuration]
   * from command line: regulation [configuration]
   * return true if config has been accepted 
   * ex *regulation star_max = 5.99
   * configuration format depends on validator implementation
   * @param command 
   * @param parent mapchecker plugin
   */
  OnGotSettingCommand(configuration: string, parent: MapChecker): boolean;

  /**
   * returns a map regulation description for players
   */
  GetDescription(): string;
}

export abstract class ValidatorBase implements IValidator {
  abstract RateBeatmap(map: Beatmap, parent: MapChecker): number;
  abstract SetConfiguration(name: string, value: string, parent: MapChecker): boolean;
  abstract GetDescription(): string;

  OnGotSettingCommand(configuration: string, parent: MapChecker): boolean {
    // valid configuration samples
    //  star_max=1
    //  hello = world
    //  aieue = 2342.3, abcde = 12, 123=456
    const re = /([0-9a-zA-Z_\-]+)\s*=\s*([^\s,]+)/g;
    let m = re.exec(configuration);
    let r = false;
    while (m) {
      r ||= this.SetConfiguration(m[1], m[2], parent);
      m = re.exec(configuration);
    }
    return r;
  }
  formatSec(sec: number): string {
    let m = Math.floor(sec / 60);
    let s = Math.round(sec - m * 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}

class DefaultValidator extends ValidatorBase {
  star = { min: 0, max: 0 };
  length = { min: 0, max: 0 };

  constructor(config: DefaultRegulation) {
    super();
    this.star.min = config.star_min;
    this.star.max = config.star_max;
    this.length.min = config.length_min;
    this.length.max = config.length_max;
  }

  RateBeatmap(map: Beatmap, parent: MapChecker): number {
    let r = 0;
    if (map.difficulty_rating < this.star.min) {
      r += (this.star.min - map.difficulty_rating) * 0.5;
    }

    if (this.star.max < map.difficulty_rating) {
      r += map.difficulty_rating - this.star.max;
    }

    if (map.total_length < this.length.min) {
      r += (this.length.min - map.total_length) / 60.0;
    }

    if (this.length.max < map.total_length) {
      r += (map.total_length - this.length.max) / 60.0;
    }

    if (0.2 < r) {
      parent.lobby.SendMessage("Violation of Regulation :( \n" + this.GetDescription());
      return r;
    } else if (0.01 < r) {
      parent.lobby.SendMessage("The map is a bit out of regulation. you can skip this host with '!skip' voting command. ");
    }
    return 0;
  }

  SetConfiguration(name: string, value: string, parent: MapChecker): boolean {
    let v = parseFloat(value);
    if (isNaN(v)) {
      parent.logger.warn(`invalid regulation config : ${name} = ${value}`);
      return false;
    }

    name = name.toLowerCase();

    if (name.includes("star") || name.includes("diff")) {
      if (name.includes("low") || name.includes("min")) {
        this.star.min = v;
        return true;
      } else if (name.includes("up") || name.includes("max")) {
        this.star.max = v;
        return true;
      }
    } else if (name.includes("len")) {
      if (name.includes("low") || name.includes("min")) {
        this.length.min = v;
        return true;
      } else if (name.includes("up") || name.includes("max")) {
        this.length.max = v;
        return true;
      }
    }

    parent.logger.warn(`invalid regulation config : ${name} = ${value}`);
    return false;
  }

  GetDescription(): string {
    let d_star = "";
    let d_length = "";

    if (this.star.min != 0 && this.star.max != 0) {
      d_star = `${this.star.min.toFixed(2)} <= difficulty <= ${this.star.max.toFixed(2)}`;
    } else if (this.star.min != 0) {
      d_star = `${this.star.min.toFixed(2)} <= difficulty`;
    } else if (this.star.max != 0) {
      d_star = `difficulty <= ${this.star.max.toFixed(2)}`;
    }

    if (this.length.min != 0 && this.length.max != 0) {
      d_length = `${this.formatSec(this.length.min)} <= length <= ${this.formatSec(this.length.max)}`;
    } else if (this.length.min != 0) {
      d_length = `${this.formatSec(this.length.min)} <= length`;
    } else if (this.length.max != 0) {
      d_length = `length <= ${this.formatSec(this.length.max)}`;
    }

    if (d_star != "" && d_length != "") {
      return `${d_star}, ${d_length}`;
    } else if (d_star == "" && d_length == "") {
      return "no regulation";
    } else {
      return d_star + d_length;
    }
  }
}

RegisterValidatorConstructor((parent: MapChecker) => new DefaultValidator(parent.option), "default_validator");

export type DefaultRegulation = {
  star_min: number;
  star_max: number;
  length_min: number;
  length_max: number;
}

export type MapCheckerOption = {
  enabled: boolean;
  cache_expired_day: number;
} & DefaultRegulation;

const defaultOption = config.get<MapCheckerOption>("mapChecker");

export class MapChecker extends LobbyPlugin {
  option: MapCheckerOption;
  webApiClient: WebApiClient | null;
  task: Promise<void>;
  lastMapId: number = 0;
  checkingMapId: number = 0;
  warningCount: number = 0;
  penaltyPoint: number = 0; // if reached 1, host will skip
  maps: { [id: number]: Beatmap & { fetchedAt: number } } = {};
  validator: IValidator;

  constructor(lobby: Lobby, client: WebApiClient | null = null, option: Partial<MapCheckerOption> = {}) {
    super(lobby, "mapChecker");
    this.option = { ...defaultOption, ...option } as MapCheckerOption;
    this.task = Promise.resolve();
    this.webApiClient = client;
    this.validator = ValidatorConstructors["default_validator"](this);
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.JoinedLobby.once(a => this.onJoinedLobby());
    this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player));
    this.lobby.ReceivedBanchoResponse.on(a => {
      switch (a.response.type) {
        case BanchoResponseType.BeatmapChanged:
          this.onBeatmapChanged(a.response.params[0], a.response.params[1]);
          break;
        case BanchoResponseType.BeatmapChanging:
        case BanchoResponseType.HostChanged:
          this.cancelCheck();
          break;
        case BanchoResponseType.MatchStarted:
          this.onMatchStarted();
          break;
      }
    });
  }

  private onJoinedLobby(): void {
    if (this.option.enabled) {
      this.SendPluginMessage("enabledMapChecker");
    }
  }

  private onReceivedChatCommand(command: string, param: string, player: Player): void {
    if (command == "!r") {
      this.lobby.SendMessageWithCoolTime(this.validator.GetDescription(), "regulation", 30000);
    }

    if (!player.isAuthorized) {
      return;
    };

    switch (command.toLocaleLowerCase()) {
      case "*mapchecker_enable":
        this.SetEnabled(true);
        break;
      case "*mapchecker_disable":
        this.SetEnabled(false);
        break;
      case "*regulation":
        this.SetConfig(param);
        break;

    }
  }

  SetEnabled(v: boolean): void {
    if (v == this.option.enabled) return;

    if (v) {
      this.SendPluginMessage("enabledMapChecker");
    } else {
      this.SendPluginMessage("disabledMapChecker");
    }
    this.option.enabled = v;
  }

  SetConfig(config: string): void {
    this.validator.OnGotSettingCommand(config, this);
  }

  private onMatchStarted() {
    if (this.checkingMapId) {
      this.lastMapId = this.checkingMapId;
    }
    this.cancelCheck();
  }

  private onBeatmapChanged(mapId: number, mapTitle: string) {
    this.checkingMapId = mapId;
    this.check(mapId, mapTitle);
  }

  private async cancelCheck() {
    this.checkingMapId = 0;
    this.penaltyPoint = 0;
  }

  private async check(mapId: number, mapTitle: string): Promise<void> {
    const map = await this.getBeatmap(mapId);
    if (!map || mapId != this.checkingMapId) {
      this.logger.warn(`couldn't find map id:${mapId}, title:${mapTitle}`);
      return;
    }
    let p = this.validator.RateBeatmap(map, this);
    this.penaltyPoint += p;
    if (1 < this.penaltyPoint) {
      this.punishHost();
    } else if (0 < p) {
      this.revertMap();
    } else {
      this.accpectMap();
    }

  }

  private punishHost(): void {
    this.SendPluginMessage("skip");
  }

  private revertMap(): void {
    this.lobby.SendMessage("!mp map " + this.lastMapId);
  }

  private accpectMap(): void {
    this.SendPluginMessage("validatedMap");
  }

  private async getBeatmap(mapId: number): Promise<Beatmap | undefined> {
    // check cache
    if (mapId in this.maps) {
      const v = this.maps[mapId];
      if (Date.now() < v.fetchedAt + this.option.cache_expired_day * 24 * 3600 * 1000) {
        return v;
      }
    }

    const q = await this.webApiClient?.lookupBeatmap(mapId) ?? await fetchBeatmap(mapId);

    if (q) {
      let v = { ...q, fetchedAt: Date.now() };
      this.maps[mapId] = v;
      return v;
    }
    return;
  }

}
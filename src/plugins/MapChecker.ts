import { Lobby } from "..";
import { LobbyPlugin } from "./LobbyPlugin";
import { BanchoResponseType } from "../parsers";
import { WebApiClient } from "../webapi/WebApiClient";
import log4js from "log4js";
import config from "config";
import { Beatmap, fetchBeatmap } from "../webapi/Beatmapsets";
import { Player } from "../Player";

export type ValidatorConstructor = (paret: MapChecker) => IValidator;

export interface IValidator {
  /**
   * returns Penalty points 0 to 1.
   * 0 means accepted, above 0 means rejected.
   * Penalty points are accumulated and the host will be punished if the point reaches 1.
   * @param map target beatmap
   */
  RateBeatmap(map: Beatmap): { rate: number, message: string };

  /**
   * Handles configuration change commands
   * from osu chat (only bot owner): *regulation [configuration]
   * from command line: regulation [configuration]
   * return true if config has been accepted 
   * ex *regulation star_max = 5.99
   * configuration format depends on validator implementation
   * @param command 
   */
  OnGotSettingCommand(configuration: string): boolean;

  /**
   * returns a map regulation description for players
   */
  GetDescription(): string;
}

export abstract class ValidatorBase implements IValidator {
  abstract RateBeatmap(map: Beatmap): { rate: number, message: string };
  abstract SetConfiguration(name: string, value: string): boolean;
  abstract GetDescription(): string;

  OnGotSettingCommand(configuration: string): boolean {
    // valid configuration samples
    //  star_max=1
    //  hello = world
    //  aieue = 2342.3, abcde = 12, 123=456
    const re = /([0-9a-zA-Z_\-]+)\s*=\s*([^\s,]+)/g;
    let m = re.exec(configuration);
    let r = false;
    while (m) {
      const rs = this.SetConfiguration(m[1], m[2]);
      r ||= rs;
      m = re.exec(configuration);
    }
    return r;
  }
}

export function secToTimeNotation(sec: number): string {
  let m = Math.floor(sec / 60);
  let s = Math.round(sec - m * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type DefaultRegulation = {
  star_min: number;
  star_max: number;
  length_min: number;
  length_max: number;
}

export class DefaultValidator extends ValidatorBase {
  logger: log4js.Logger;
  star = { min: 0, max: 0 };
  length = { min: 0, max: 0 };

  constructor(config: DefaultRegulation, logger: log4js.Logger) {
    super();
    this.star.min = config.star_min;
    this.star.max = config.star_max;
    this.length.min = config.length_min;
    this.length.max = config.length_max;
    this.logger = logger;
  }

  RateBeatmap(map: Beatmap): { rate: number, message: string } {
    let r = 0;
    if (map.mode != "osu") {
      r += 1;
    }

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

    let rs = { rate: r, message: "" };

    if (0.01 < r) {
      rs.message
        = `picked map: ${map.url} ${map.beatmapset?.title} star=${map.difficulty_rating} length=${secToTimeNotation(map.total_length)}` + "\n"
        + `Violation of Regulation : ${this.GetDescription()}`;
      rs.rate = Math.min(Math.max(r, 0.45), 0.9);
    } else if (0.001 < r) {
      rs.message
        = `picked map: ${map.url} ${map.beatmapset?.title} star=${map.difficulty_rating} length=${secToTimeNotation(map.total_length)}` + "\n"
        + `Violation of Regulation : ${this.GetDescription()}` + "\n"
        + `you can skip current host with '!skip' voting command.`
        ;
      rs.rate = 0;
    }

    return rs;
  }

  SetConfiguration(name: string, value: string): boolean {
    let v = parseFloat(value);
    if (isNaN(v)) {
      this.logger.warn(`invalid regulation config : ${name} = ${value}`);
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

    this.logger.warn(`invalid regulation config : ${name} = ${value}`);
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
      d_length = `${secToTimeNotation(this.length.min)} <= length <= ${secToTimeNotation(this.length.max)}`;
    } else if (this.length.min != 0) {
      d_length = `${secToTimeNotation(this.length.min)} <= length`;
    } else if (this.length.max != 0) {
      d_length = `length <= ${secToTimeNotation(this.length.max)}`;
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

const ValidatorConstructors: { [id: string]: ValidatorConstructor } = {};

export function RegisterValidatorConstructor(v: ValidatorConstructor, name: string) {
  if (name in ValidatorConstructors) {
    throw new Error("validator name conflict detected: " + name);
  }
  ValidatorConstructors[name] = v;
}

RegisterValidatorConstructor((parent: MapChecker) => new DefaultValidator(parent.option, parent.logger), "default_validator");

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
  doSkip: boolean = false;

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
        case BanchoResponseType.HostChanged:
          this.cancelCheck();
          break;
        case BanchoResponseType.BeatmapChanging:
          this.checkingMapId = 0;
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

  getRegulationDescription(): string {
    if (this.option.enabled) {
      return this.validator.GetDescription();
    } else {
      return "disabled (" + this.validator.GetDescription() + ")";
    }
  }

  private onReceivedChatCommand(command: string, param: string, player: Player): void {
    if (command == "!r" || command == "!regulation") {
      this.lobby.SendMessageWithCoolTime(this.getRegulationDescription(), "regulation", 10000);
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
        if (!param) break;
        if (param.startsWith("enable")) {
          this.SetEnabled(true);
        } else if (param.startsWith("disable")) {
          this.SetEnabled(false);
        } else {
          this.SetConfig(param);
        }
        break;
      case "*no":
        if (param == "regulation") {
          this.SetEnabled(false);
        }
        break;
    }
  }

  SetEnabled(v: boolean): void {
    if (v == this.option.enabled) return;

    if (v) {
      this.SendPluginMessage("enabledMapChecker");
      this.lobby.SendMessage("mapChecker Enabled");
    } else {
      this.SendPluginMessage("disabledMapChecker");
      this.lobby.SendMessage("mapChecker Disabled");
    }
    this.option.enabled = v;
  }

  SetConfig(config: string): void {
    const r = this.validator.OnGotSettingCommand(config);
    if (r) {
      const m = "new regulation: " + this.validator.GetDescription();
      this.lobby.SendMessage(m);
      this.logger.info(m);
    }
  }

  private onMatchStarted() {
    if (this.checkingMapId) {
      this.lastMapId = this.checkingMapId;
    }
    this.cancelCheck();
  }

  private onBeatmapChanged(mapId: number, mapTitle: string) {
    if (this.option.enabled) {
      this.checkingMapId = mapId;
      this.check(mapId, mapTitle);
    }
  }

  private async cancelCheck() {
    this.checkingMapId = 0;
    this.penaltyPoint = 0;
  }

  private async check(mapId: number, mapTitle: string): Promise<void> {
    let map = await this.getBeatmap(mapId);
    if (!map) {
      this.logger.warn(`couldn't find map id:${mapId}, title:${mapTitle}, retrying...`);
      map = await this.getBeatmap(mapId);
    }
    if (!map || mapId != this.checkingMapId) {
      this.logger.warn(`couldn't find map id:${mapId}, title:${mapTitle}`);
      return;
    }
    let r = this.validator.RateBeatmap(map);
    this.penaltyPoint += r.rate;
    if (1 <= this.penaltyPoint && this.doSkip) {
      this.punishHost();
    } else if (0 < r.rate) {
      this.revertMap();
      this.lobby.SendMessage(r.message);
    } else {
      this.accpectMap();
    }
  }

  private punishHost(): void {
    this.logger.info("punished " + this.lobby.host?.escaped_name);
    this.lobby.SendMessage("!mp map " + this.lastMapId);
    this.SendPluginMessage("skip");
  }

  private revertMap(): void {
    this.logger.info("revertMap " + this.lobby.host?.escaped_name);
    this.lobby.SendMessage("!mp map " + this.lastMapId);
  }

  private accpectMap(): void {
    this.SendPluginMessage("validatedMap");
    this.lastMapId = this.lobby.mapId;
  }

  private async getBeatmap(mapId: number): Promise<Beatmap | undefined> {
    // check cache
    if (mapId in this.maps) {
      const v = this.maps[mapId];
      if (Date.now() < v.fetchedAt + this.option.cache_expired_day * 24 * 3600 * 1000) {
        return v;
      }
    }

    let q = null;
    if (this.webApiClient) {
      try {
        q = await this.webApiClient.lookupBeatmap(mapId);
      } catch (e) {
        this.logger.error(e);
        // トークンがない状態ならもう使わない。
        // マップが存在しない可能性を考慮
        if (!this.webApiClient.token) {
          this.webApiClient = null;
        }
      }
    }

    if (!q) {
      try {
        q = await fetchBeatmap(mapId);
      } catch (e) {
        this.logger.error(e);
      }
    }

    if (q) {
      let v = { ...q, fetchedAt: Date.now() };
      this.maps[mapId] = v;
      return v;
    }

  }

  GetPluginStatus(): string {
    return `-- Mapchecker --
  current regulation : ${this.getRegulationDescription()}`;
  }
}
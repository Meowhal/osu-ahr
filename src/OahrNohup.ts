import { AutoHostSelector, AutoStarter, HostSkipper, Lobby, logIrcEvent, IIrcClient, parser, LobbyTerminator, LobbyStatus } from "./models";
import * as readline from 'readline';
import config from "config";
import log4js from "log4js";

const logger = log4js.getLogger("cli");

export interface OahrCliOption {
  invite_users: string[]; // ロビー作成時に招待するプレイヤー, 自分を招待する場合など
  password: string;　// デフォルトのパスワード, 空文字でパスワードなし。
}

const OahrCliDefaultOption = config.get<OahrCliOption>("OahrCli");

export class OahrNohup {
  client: IIrcClient;
  lobby: Lobby;
  selector: AutoHostSelector;
  starter: AutoStarter;
  skipper: HostSkipper;
  terminator: LobbyTerminator;
  option: OahrCliOption = OahrCliDefaultOption;

  constructor(client: IIrcClient) {
    this.client = client;
    this.lobby = new Lobby(this.client);
    this.selector = new AutoHostSelector(this.lobby);
    this.starter = new AutoStarter(this.lobby);
    this.skipper = new HostSkipper(this.lobby);
    this.terminator = new LobbyTerminator(this.lobby);
  }

  displayInfo(): void {
    logger.info(this.lobby.getLobbyStatus());
  }

  connectAsync() : Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.once("registered", () => {
        resolve();
      });
    });    
  }

  makeLobby(name: string) {
    logger.trace("waiting for registration from bancho");
    this.client.once("registered", async () => {
      try {
        logger.info("make lobby, name : " + name);
        await this.lobby.MakeLobbyAsync(name);
        this.lobby.SendMessage("!mp password " + this.option.password);
        for (let p of this.option.invite_users) {
          this.lobby.SendMessage("!mp invite " + p);
        }
      } catch (e) {
        logger.info("faiiled to make lobby : %s", e);
        process.exit(1);
      }
    });
  }

  async enterLobbyAsync(id:string) :Promise<void> {
    try {
      const channel = parser.EnsureMpChannelId(id);
      logger.info("enter lobby, channel : %s", channel);
      await this.lobby.EnterLobbyAsync(channel);
      await this.lobby.LoadLobbySettingsAsync();
    } catch (e) {
      logger.info("invalid channel : %s", e);
    }
  }
}
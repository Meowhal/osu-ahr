import { Lobby, IIrcClient } from "..";
import config from "config";
import log4js from "log4js";
import { AutoHostSelector, MatchStarter, HostSkipper, LobbyTerminator, MatchAborter, WordCounter, Recorder, MapRecaster, InOutLogger } from "../plugins";
import { parser } from "../parsers";

const logger = log4js.getLogger("cli");

export interface OahrCliOption {
  invite_users: string[]; // ロビー作成時に招待するプレイヤー, 自分を招待する場合など
  password: string;　// デフォルトのパスワード, 空文字でパスワードなし。
  use_recoder: boolean; // プレイヤーの入退室記録や選択マップなどを保存するか
}

const OahrCliDefaultOption = config.get<OahrCliOption>("OahrCli");

export class OahrBase {
  client: IIrcClient;
  lobby: Lobby;
  selector: AutoHostSelector;
  starter: MatchStarter;
  skipper: HostSkipper;
  terminator: LobbyTerminator;
  aborter: MatchAborter;
  wordCounter: WordCounter;
  recorder: Recorder | null = null;
  recaster: MapRecaster;
  inoutLogger: InOutLogger;
  option: OahrCliOption = OahrCliDefaultOption;

  constructor(client: IIrcClient) {
    this.client = client;
    this.lobby = new Lobby(this.client);
    this.selector = new AutoHostSelector(this.lobby);
    this.starter = new MatchStarter(this.lobby);
    this.skipper = new HostSkipper(this.lobby);
    this.terminator = new LobbyTerminator(this.lobby);
    this.aborter = new MatchAborter(this.lobby);
    this.wordCounter = new WordCounter(this.lobby);
    this.inoutLogger = new InOutLogger(this.lobby);
    
    if (this.option.use_recoder) {
      this.recorder = new Recorder(this.lobby, true);
    }    
    this.recaster = new MapRecaster(this.lobby);
  }

  get isRegistered(): boolean {
    return this.client.hostMask != "";
  }

  displayInfo(): void {
    logger.info(this.lobby.GetLobbyStatus());
  }

  ensureRegisteredAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRegistered) {
        logger.trace("waiting for registration from bancho");
        this.client.once("registered", () => {
          logger.trace("registerd");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async makeLobbyAsync(name: string): Promise<void> {
    if (!this.isRegistered) await this.ensureRegisteredAsync();
    logger.info("Making lobby, name : " + name);
    await this.lobby.MakeLobbyAsync(name);
    this.lobby.SendMessage("!mp password " + this.option.password);
    for (let p of this.option.invite_users) {
      this.lobby.SendMessage("!mp invite " + p);
    }
    logger.info(`Made lobby : ${this.lobby.channel}`);
  }

  async enterLobbyAsync(id: string): Promise<void> {
    if (!this.isRegistered) await this.ensureRegisteredAsync();
    const channel = parser.EnsureMpChannelId(id);
    logger.info("Entering lobby, channel : %s", channel);
    await this.lobby.EnterLobbyAsync(channel);
    await this.lobby.LoadLobbySettingsAsync(true);

    logger.info(`Entered lobby : ${this.lobby.channel}`);
  }
}
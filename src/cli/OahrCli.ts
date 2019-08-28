import { Lobby, IIrcClient, LobbyStatus } from "..";
import * as readline from 'readline';
import config from "config";
import log4js from "log4js";
import { AutoHostSelector, AutoStarter, HostSkipper, LobbyTerminator } from "../plugins";
import { parser } from "../parsers";

const logger = log4js.getLogger("cli");

export interface OahrCliOption {
  invite_users: string[]; // ロビー作成時に招待するプレイヤー, 自分を招待する場合など
  password: string;　// デフォルトのパスワード, 空文字でパスワードなし。
}

const OahrCliDefaultOption = config.get<OahrCliOption>("OahrCli");

interface Scene {
  name: string;
  prompt: string;
  reaction: (line: string) => Promise<void>;
}

export class OahrCli {
  client: IIrcClient;
  lobby: Lobby;
  selector: AutoHostSelector;
  starter: AutoStarter;
  skipper: HostSkipper;
  terminator: LobbyTerminator;
  option: OahrCliOption = OahrCliDefaultOption;
  private scene: Scene;

  constructor(client: IIrcClient) {
    this.client = client;
    this.lobby = new Lobby(this.client);
    this.selector = new AutoHostSelector(this.lobby);
    this.starter = new AutoStarter(this.lobby);
    this.skipper = new HostSkipper(this.lobby);
    this.terminator = new LobbyTerminator(this.lobby);
    this.scene = this.scenes.mainMenu;
  }

  private scenes = {
    mainMenu: {
      name: "",
      prompt: "[m]ake lobby, [e]nter lobby, [q]uit > ",
      reaction: async (line: string) => {
        let l = parser.SplitCliCommand(line);
        switch (l.command) {
          case "m":
            if (l.arg == "") return;
            try {
              logger.info("make lobby, name : " + l.arg);
              await this.lobby.MakeLobbyAsync(l.arg);
              this.lobby.SendMessage("!mp password " + this.option.password);
              for (let p of this.option.invite_users) {
                this.lobby.SendMessage("!mp invite " + p);
              }
              this.scene = this.scenes.lobbyMenu;
            } catch (e) {
              logger.info("faiiled to make lobby : %s", e);
              this.scene = this.scenes.exited;
            }
            break;
          case "e":
            try {
              if (l.arg == "") return;
              const channel = parser.EnsureMpChannelId(l.arg);
              logger.info("enter lobby, channel : %s", channel);
              await this.lobby.EnterLobbyAsync(channel);
              await this.lobby.LoadLobbySettingsAsync();
              this.scene = this.scenes.lobbyMenu;
            } catch (e) {
              logger.info("invalid channel : %s", e);
              this.scene = this.scenes.exited;
            }
            break;
          case "q":
            this.scene = this.scenes.exited;
            break;
          default:
            logger.info("invalid command : %s", line);
            break;
        }
      }
    },

    lobbyMenu: {
      name: "lobbyMenu",
      prompt: "[s]say, [i]nfo, [c]lose, [q]uit > ",
      reaction: async (line: string) => {
        let l = parser.SplitCliCommand(line);
        if (this.lobby.status == LobbyStatus.Left || this.client.conn == null) {
          this.scene = this.scenes.exited;
          return;
        }
        switch (l.command) {
          case "s":
            this.lobby.SendMessage(l.arg);
            break;
          case "i":
            this.displayInfo();
            break;
          case "c":
            logger.info("close");
            await this.lobby.CloseLobbyAsync();
            this.scene = this.scenes.exited;
            break;
          case "q":
            logger.info("quit");
            this.scene = this.scenes.exited;
            break;
          default:
            logger.info("invalid command : %s", line);
            break;
        }
      }
    },

    exited: {
      name: "exited",
      prompt: "ended",
      reaction: async (line: string) => { }
    }
  };

  displayInfo(): void {
    logger.info(this.lobby.GetLobbyStatus());
  }

  get prompt(): string {
    return this.scene.prompt;
  }

  get exited(): boolean {
    return this.scene === this.scenes.exited;
  }

  startApp(rl: readline.Interface | null) {
    if (rl == null) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }
    let r = rl as readline.Interface;

    logger.trace("waiting for registration from bancho");
    this.client.once("registered", () => {
      r.setPrompt(this.prompt);
      r.prompt();
    });

    r.on("line", line => {
      logger.trace("scene:%s, line:%s", this.scene.name, line);
      this.scene.reaction(line).then(() => {
        if (!this.exited) {
          r.setPrompt(this.prompt);
          r.prompt();
        } else {
          logger.trace("closing interface");
          r.close();
        }
      });
    });
    r.on("close", () => {
      if (this.client != null) {
        logger.info("readline closed");
        if (this.client.conn != null && !this.client.conn.requestedDisconnect) {
          this.client.disconnect("goodby", () => {
            logger.info("ircClient disconnected");
            process.exit(0);
          });
        } else {
          logger.info("exit");
          process.exit(0);
        }
      }
    });
  }
}
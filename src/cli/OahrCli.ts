import { Lobby, IIrcClient, LobbyStatus } from "..";
import * as readline from 'readline';
import config from "config";
import log4js from "log4js";
import { AutoHostSelector, AutoStarter, HostSkipper, LobbyTerminator, MatchAborter } from "../plugins";
import { parser } from "../parsers";
import { OahrBase } from "./OahrBase";

const logger = log4js.getLogger("cli");

interface Scene {
  name: string;
  prompt: string;
  reaction: (line: string) => Promise<void>;
}

export class OahrCli extends OahrBase {
  private scene: Scene;

  constructor(client: IIrcClient) {
    super(client);
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
            if (l.arg == "") {
              logger.info("m command needs lobby name. ex:m testlobby");
              return;
            }
            try {
              this.makeLobbyAsync(l.arg);
              this.scene = this.scenes.lobbyMenu;
            } catch (e) {
              logger.info("faiiled to make lobby : %s", e);
              this.scene = this.scenes.exited;
            }
            break;
          case "e":
            try {
              if (l.arg == "") {
                logger.info("e command needs lobby id. ex:e 123456");
                return;
              }
              this.enterLobbyAsync(l.arg);
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
import { IIrcClient, LobbyStatus, Player } from '..';
import * as readline from 'readline';
import log4js from 'log4js';
import { parser } from '../parsers';
import { OahrBase } from './OahrBase';

const logger = log4js.getLogger("cli");

const mainMenuCommandsMessage = `
MainMenu Commands 
  [make <Lobby_name>] Make a lobby.  ex: 'make 5* auto host rotation'
  [enter <LobbyID>]   Enter the lobby. ex: 'enter 123456' (It only works in a Tournament lobby ID.)
  [help] Show this message.
  [quit] Quit this application.
`;

const lobbyMenuCommandsMessage = `
LobbyMenu Commands 
  [say <Message>] Send Message to #multiplayer.
  [info] Show current application's informations.
  [reorder] arragne host queue. ex: 'reorder player1, player2, player3'
  [regulation <regulation command>] change regulation. ex: 'regulation star_min=2 star_max=5 len_min=60 len_max=300' 
  [regulation enable] Enable regulation checking 
  [regulation disable] Disable regulation checking
  [close] Close the lobby and Quit this application. ex: 'close now'
            DO NOT Quit application before close the lobby!
  [quit]  Quit this application. (lobby won't close.)
`;

interface Scene {
  name: string;
  prompt: string;
  action: (line: string) => Promise<void>;
  completer: readline.Completer
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
      prompt: "> ",
      action: async (line: string) => {
        let l = parser.SplitCliCommand(line);
        switch (l.command) {
          case "m":
          case "make":
            if (l.arg == "") {
              logger.info("make command needs lobby name. ex:make testlobby");
              return;
            }
            try {
              await this.makeLobbyAsync(l.arg);
              this.transitionToLobbyMenu();
            } catch (e) {
              logger.info("faiiled to make lobby : %s", e);
              this.scene = this.scenes.exited;
            }
            break;
          case "e":
          case "enter":
            try {
              if (l.arg == "") {
                logger.info("enter command needs lobby id. ex:enter 123456");
                return;
              }
              await this.enterLobbyAsync(l.arg);
              this.transitionToLobbyMenu();
            } catch (e) {
              logger.info("invalid channel : %s", e);
              this.scene = this.scenes.exited;
            }
            break;
          case "q":
          case "quit":
          case "exit":
            this.scene = this.scenes.exited;
            break;
          case "h":
          case "help":
          case "command":
          case "commands":
          case "/?":
          case "-?":
          case "?":
            console.log(mainMenuCommandsMessage);
            break;
          case "":
            break;
          default:
            logger.info("invalid command : %s", line);
            break;
        }
      },
      completer: (line: string): readline.CompleterResult => {
        const completions = ["make", "enter", "quit", "exit", "help"];
        const hits = completions.filter(v => v.startsWith(line));
        return [hits.length ? hits : ["make", "enter", "quit", "help"], line];
      }
    },
    lobbyMenu: {
      name: "lobbyMenu",
      prompt: "> ",
      action: async (line: string) => {
        let l = parser.SplitCliCommand(line);
        if (this.lobby.status == LobbyStatus.Left || this.client.conn == null) {
          this.scene = this.scenes.exited;
          return;
        }
        switch (l.command) {
          case "s":
          case "say":
            if ((l.arg.startsWith("!") && !l.arg.startsWith("!mp ")) || l.arg.startsWith("*")) {
              this.lobby.RaiseReceivedChatCommand(this.lobby.GetOrMakePlayer(this.client.nick), l.arg)
            } else {
              this.lobby.SendMessage(l.arg);
            }
            break;
          case "i":
          case "info":
            this.displayInfo();
            break;
          case "reorder":
            this.selector.Reorder(l.arg);
            break;
          case "regulation":
            if (!l.arg) {
              console.log(this.checker.getRegulationDescription());
            } else {
              this.checker.processOwnerCommand("*regulation", l.arg); // TODO check
            }
            break;
          case "c":
          case "close":
            if (l.arg == "now") {
              // close now
              await this.lobby.CloseLobbyAsync();
              this.scene = this.scenes.exited;
            } else if (l.arg.match(/\d+/)) {
              // close after secs
              this.terminator.CloseLobby(parseInt(l.arg) * 1000);
            } else {
              // close after everyone leaves
              this.terminator.CloseLobby();
            }
            break;
          case "q":
          case "quit":
            logger.info("quit");
            this.scene = this.scenes.exited;
            break;
          case "h":
          case "help":
          case "command":
          case "commands":
          case "/?":
          case "-?":
          case "?":
            console.log(lobbyMenuCommandsMessage);
            break;
          case "check_order":
            this.lobby.historyRepository.calcCurrentOrderAsName().then(r => {
              logger.info("history order = " + r.join(", "));
              logger.info("current order = " + this.selector.hostQueue.map(p => p.name).join(", "));
            });
            break;
          case "":
            break;
          default:
            if (l.command.startsWith("!mp")) {
              this.lobby.SendMessage("!mp " + l.arg);
            } else if (l.command.startsWith("!") || l.command.startsWith("*")) {
              this.lobby.RaiseReceivedChatCommand(this.lobby.GetOrMakePlayer(this.client.nick), l.command + " " + l.arg)
            } else {
              console.log("invalid command : %s", line);
            }
            break;
        }
      },
      completer: (line: string): readline.CompleterResult => {
        const completions = ["say", "info", "reorder", "regulation", "close", "quit", "help"];
        const hits = completions.filter(v => v.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    },

    exited: {
      name: "exited",
      prompt: "ended",
      action: async (line: string) => { },
      completer: (line: string): readline.CompleterResult => {
        return [["exit"], line];
      }
    }
  };

  get prompt(): string {
    return this.scene.prompt;
  }

  get exited(): boolean {
    return this.scene === this.scenes.exited;
  }

  start(rl: readline.Interface | null) {
    if (rl == null) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: (line: string) => {
          return this.scene.completer(line);
        }
      });
    }
    let r = rl as readline.Interface;

    logger.trace("waiting for registration from bancho");
    console.log("Connecting to Osu Bancho ...");
    this.client.once("registered", () => {
      console.log("Connected :D");
      console.log("\n=== Welcome to osu-ahr ===");
      console.log(mainMenuCommandsMessage);
      r.setPrompt(this.prompt);
      r.prompt();
    });

    r.on("line", line => {
      logger.trace("scene:%s, line:%s", this.scene.name, line);
      this.scene.action(line).then(() => {
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

  transitionToLobbyMenu() {
    this.scene = this.scenes.lobbyMenu;
    this.scene.prompt = (this.lobby.channel || "") + " > ";
    console.log(lobbyMenuCommandsMessage);
  }
}

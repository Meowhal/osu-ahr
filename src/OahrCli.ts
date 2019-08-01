import { AutoHostSelector, Lobby, logIrcEvent, IIrcClient, parser } from "./models";
import * as readline from 'readline';

interface Scene {
  prompt: string;
  reaction: (line: string) => Promise<void>;
}

function decScene(m: string, r: (line: string) => Promise<void>): Scene {
  return {
    prompt: m,
    reaction: r
  };
}

export class OahrCli {
  client: IIrcClient;
  lobby: Lobby;
  selector: AutoHostSelector;

  private scene: Scene;
  private scenes = {
    mainMenu: decScene("[m]ake lobby, [e]nter lobby, [q]uit > ", async line => {
      let l = parser.SplitCliCommand(line);
      switch (l.command) {
        case "m":
          if (l.arg == "") return;
          try {
            console.log("make lobby, name : " + l.arg);
            await this.lobby.MakeLobbyAsync(l.arg);
            this.scene = this.scenes.lobbyMenu;
          } catch (e) {
            console.log("faiiled to make lobby " + e);
            this.scene = this.scenes.exited;
          }
          break;
        case "e":
          try {
            if (l.arg == "") return;
            const channel = parser.EnsureMpChannelId(l.arg);
            console.log("enter lobby, channel : " + channel);
            await this.lobby.EnterLobbyAsync(channel);
            await this.lobby.LoadLobbySettingsAsync();
            this.scene = this.scenes.lobbyMenu;
          } catch (e) {
            console.log("invalid channel : " + e);
            this.scene = this.scenes.exited;
          }
          break;
        case "q":
          this.scene = this.scenes.exited;
          break;
        default:
          console.log("invalid command");
          break;
      }
    }),

    lobbyMenu: decScene("[s]say, [d]splaly, [c]lose, [e]xit > ", async line => {
      let l = parser.SplitCliCommand(line);
      switch (l.command) {
        case "s":
          this.lobby.SendMessage(l.arg);
          break;
        case "d":
          this.displayStatus();
          break;
        case "c":
          console.log("close");
          await this.lobby.CloseLobbyAsync();
          this.scene = this.scenes.exited;
          break;
        case "e":
          console.log("exit");


          this.scene = this.scenes.exited;
          break;
        default:
          console.log("invalid command");
          break;
      }
    }),

    exited: decScene("ended", async _ => { })
  };

  displayStatus(): void {
    console.log("queue:");
    for (let p of this.selector.hostQueue) {
      console.log("  " + p.id);
    }
    console.log("");
  }

  get prompt(): string {
    return this.scene.prompt;
  }

  get exited(): boolean {
    return this.scene === this.scenes.exited;
  }

  constructor(client: IIrcClient) {
    this.client = client;
    this.lobby = new Lobby(this.client);
    this.selector = new AutoHostSelector(this.lobby);
    this.scene = this.scenes.mainMenu;
  }

  startApp(rl: readline.Interface | null) {
    if (rl == null) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }
    let r = rl as readline.Interface;

    this.client.once("registered", () => {
      r.setPrompt(this.prompt);
      r.prompt();
    });

    r.on("line", line => {
      this.scene.reaction(line).then(() => {
        if (!this.exited) {
          r.setPrompt(this.prompt);
          r.prompt();
        } else {
          console.log("interface closing");
          r.close();
        }
      });
    });
    r.on("close", () => {
      if (this.client != null) {
        this.client.disconnect("goodby", () => { });
      }
    });
  }
}




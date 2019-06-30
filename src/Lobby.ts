import { ILobby, LobbyStatus } from "./ILobby";
import { Player } from "./Player";
import { CommandParser } from "./CommandParser";
import { IIrcClient } from "./IIrcClient";

const BanchoHostMask: string = "osu!Bancho.";

export class Lobby implements ILobby {
  host: Player | null;
  name: string | undefined;
  id: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  players: Player[];
  parser: CommandParser;
  ircClient: IIrcClient;

  constructor(ircClient: IIrcClient) {
    if (ircClient.conn == null) {
      throw new Error("clientが未接続です");
    }

    this.status = LobbyStatus.Standby;
    this.players = [];
    this.parser = new CommandParser();
    this.ircClient = ircClient;
    this.host = null;
    this.ircClient.on("message", (from, to, message) => {

    });
  }

  SendMpHost(userid: string): void {
    throw new Error("Method not implemented.");
  }
  SendMpAbort(): void {
    throw new Error("Method not implemented.");
  }
  SendMpClose(): void {
    throw new Error("Method not implemented.");
  }
  SendMessage(message: string): void {
    if (this.channel != undefined) {
      this.ircClient.say(this.channel, message);
    }
  }

  MakeLobbyAsync(title: string): Promise<string> {
    return new Promise<string>(resolve => {
      if (this.ircClient.hostMask == BanchoHostMask) {
        console.log("already registered");
        this.MakeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        console.log("wait register");
        this.ircClient.once("registered", () => {
          this.MakeLobbyAsyncCore(title).then(v => resolve(v));
        })
      }
    });
  }

  private MakeLobbyAsyncCore(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const isResolved = () => {
        console.log("is resolved");
        if (this.name != undefined && this.id != undefined && this.channel != undefined) {
          console.log(" resolved");
          this.status = LobbyStatus.Entered;
          resolve(this.id);
        }
      }
      const onJoin = (channel: string, who: string) => {
        console.log("on join");
        if (who == this.ircClient.nick) {
          this.channel = channel;
          this.ircClient.off("join", onJoin);
          isResolved();
        }
      };
      const onPm = (from: string, message: string) => {
        console.log(`onPm from=${from}, msg=${message}`);
        if (from == "BanchoBot" && this.id == null) {
          const v = this.parser.ParseMpMakeResponse(from, message);
          if (v != null) {
            this.name = v.title;
            this.id = v.id;
            this.ircClient.off("pm", onPm);
            this.status = LobbyStatus.Made;
            isResolved();
          }
        }
      };
      this.ircClient.once("join", onJoin);
      this.ircClient.once("pm", onPm);
      this.ircClient.say("BanchoBot", "!mp make " + title);
    });
  }

  EnterLobbyAsync(channel: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  CloseLobbyAsync(): Promise<void> {
    throw new Error("Method not implemented.");
  }


}
import { ILobby, LobbyStatus, Player } from "./ILobby";
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
        this.MakeLobbyAsyncCore(title).then(v => resolve(v));
      } else {
        this.ircClient.once("registered", () => {
          this.MakeLobbyAsyncCore(title).then(v => resolve(v));
        })
      }
    });
  }

  private MakeLobbyAsyncCore(title: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const onJoin = (channel: string, who: string) => {
        if (who == this.ircClient.nick) {
          this.channel = channel;
          this.name = title;
          this.id = channel.replace("#mp_", "");
          this.ircClient.off("join", onJoin);
          this.status = LobbyStatus.Entered;
          resolve(this.id);
        }
      };
      this.ircClient.on("join", onJoin);
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
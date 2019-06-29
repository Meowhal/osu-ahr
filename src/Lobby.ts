import { ILobby, LobbyStatus } from "./ILobby";
import { Player } from "./Player";
import {CommandParser} from "./CommandParser";
import { IIrcClient} from "./IIrcClient";

export class Lobby implements ILobby {
  host: Player | null;
  name: string | undefined;  id: string | undefined;
  status: LobbyStatus;
  players: Player[];
  parser: CommandParser;
  ircClient: IIrcClient;

  constructor(ircClient: IIrcClient) {
    this.status = LobbyStatus.Standby;
    this.players = [];
    this.parser = new CommandParser();
    this.ircClient = ircClient;
    this.host = null;    
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
    throw new Error("Method not implemented.");
  }
  MakeLobbyAsync(title: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  EnterLobbyAsync(channel: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  CloseLobbyAsync(): Promise<void> {
    throw new Error("Method not implemented.");
  }


}
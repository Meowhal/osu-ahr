import { ILobby } from "./ILobby";
import { LobbyPlugin } from "./LobbyPlugin";

export class Autostarter extends LobbyPlugin {
  constructor(lobby: ILobby) {
    super(lobby);
    lobby.AllPlayerReady.on(() => {
      lobby.SendMessage("!mp start");
    })
  }
}
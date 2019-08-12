import { ILobby } from "./ILobby";
import { LobbyPlugin } from "./LobbyPlugin";

export class AutoStarter extends LobbyPlugin {
  constructor(lobby: ILobby) {
    super(lobby);
    lobby.AllPlayerReady.on(() => {
      lobby.SendMessage("!mp start");
    })
  }
  getPluginStatus(): string {
    return `-- AutoStarter --
    waiting all players get ready 
  `;
  }
}
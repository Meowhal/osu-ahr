import { ILobby } from "../ILobby";
import { LobbyPlugin } from "./LobbyPlugin";

export class MatchStarter extends LobbyPlugin {
  constructor(lobby: ILobby) {
    super(lobby);
    lobby.AllPlayerReady.on(() => {
      lobby.SendMessage("!mp start");
    })
  }
  getPluginStatus(): string {
    return `-- MatchStarter --
    waiting all players get ready 
  `;
  }
}
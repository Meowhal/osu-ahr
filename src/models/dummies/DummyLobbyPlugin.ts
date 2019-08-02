import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { LobbyPlugin } from "../LobbyPlugin";


export class DummyLobbyPlugin extends LobbyPlugin {

  constructor(lobby: ILobby) {
    super(lobby);
  }

  getPluginStatus(): string {
    return `-- Dummy Lobby Plugin --
  this is dummy lobby info
    `;
  }
}

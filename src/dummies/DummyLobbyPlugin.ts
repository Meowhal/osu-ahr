import { ILobby } from "../ILobby";
import { LobbyPlugin } from "../plugins/LobbyPlugin";

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

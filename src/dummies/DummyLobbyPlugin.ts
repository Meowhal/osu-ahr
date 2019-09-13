import { Lobby } from "..";
import { LobbyPlugin } from "../plugins/LobbyPlugin";

export class DummyLobbyPlugin extends LobbyPlugin {

  constructor(lobby: Lobby) {
    super(lobby);
  }

  getPluginStatus(): string {
    return `-- Dummy Lobby Plugin --
  this is dummy lobby info
    `;
  }
}

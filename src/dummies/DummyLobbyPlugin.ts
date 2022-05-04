import { Lobby } from '../Lobby.js';
import { LobbyPlugin } from '../plugins/LobbyPlugin.js';

export class DummyLobbyPlugin extends LobbyPlugin {

  constructor(lobby: Lobby) {
    super(lobby, "dummy");
  }

  GetPluginStatus(): string {
    return `-- Dummy Lobby Plugin --
  this is dummy lobby info
    `;
  }
}

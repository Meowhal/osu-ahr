import { Lobby } from '../Lobby';
import { LobbyPlugin } from '../plugins/LobbyPlugin';

export class DummyLobbyPlugin extends LobbyPlugin {

  constructor(lobby: Lobby) {
    super(lobby, 'dummy');
  }

  GetPluginStatus(): string {
    return `-- Dummy Lobby Plugin --
  this is dummy lobby info
    `;
  }
}

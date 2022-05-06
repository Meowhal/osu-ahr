import { Lobby } from '../Lobby';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { LobbyTerminator } from '../plugins/LobbyTerminator';
import tu from './TestUtils';

describe.skip('Lobby Terminator Tests', function () {
  before(function () {
    tu.configMochaVerbosely();
  });
  async function setupAsync(interval: number = 10): Promise<{ terminator: LobbyTerminator, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    const terminator = new LobbyTerminator(lobby);
    terminator.multilimeMessageInterval = interval;
    return { terminator, lobby, ircClient };
  }
  it('CloseLobby time', async () => {
    const { terminator, lobby, ircClient } = await setupAsync();
    terminator.CloseLobby(100);
  });
});

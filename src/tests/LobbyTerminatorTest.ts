import { assert } from 'chai';
import { Lobby } from '../Lobby.js';
import { parser, BanchoResponse } from '../parsers/CommandParser.js';
import { DummyIrcClient } from '../dummies/DummyIrcClient.js';
import { LobbyTerminator } from '../plugins/LobbyTerminator.js';
import tu from './TestUtils.js';

describe.skip("Lobby Terminator Tests", function () {
  before(function () {
    tu.configMochaVerbosely();
  });
  async function setupAsync(interval: number = 10): Promise<{ terminator: LobbyTerminator, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    const terminator = new LobbyTerminator(lobby);
    terminator.multilimeMessageInterval = interval;
    return { terminator, lobby, ircClient };
  }
  it("CloseLobby time", async () => {
    const { terminator, lobby, ircClient } = await setupAsync();
    terminator.CloseLobby(100);
  })
});

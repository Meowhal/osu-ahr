import { assert } from 'chai';
import { Lobby } from "..";
import { parser, BanchoResponse } from "../parsers";
import { DummyIrcClient } from '../dummies';
import { LobbyTerminator } from "../plugins";
import tu from "./TestUtils";

describe.skip("Lobby Terminator Tests", function () {
  before(function () {
    tu.configMochaAsNoisy();
  });
  async function setupAsync(interval: number = 10): Promise<{ terminator: LobbyTerminator, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    const option = {
      sleep_message_interval: interval
    }
    return { terminator: new LobbyTerminator(lobby, option), lobby, ircClient };
  }
  it("CloseLobby time", async () => {
    const { terminator, lobby, ircClient } = await setupAsync();
    terminator.CloseLobby(100);
  })
});
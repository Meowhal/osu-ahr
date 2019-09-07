import { assert } from 'chai';
import { Lobby } from "..";
import {parser, BanchoResponse} from "../parsers";
import { DummyIrcClient } from '../dummies';
import { LobbyTerminator } from "../plugins";
import tu from "./TestUtils";

describe.skip("Lobby Terminator Tests", function () {
  before(function () {
    tu.configMochaAsNoisy();
  });
  async function prepare(logIrc = false): Promise<{ terminator: LobbyTerminator, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    return { terminator: new LobbyTerminator(lobby), lobby, ircClient };
  }

  it("request sleep test", async() => {
    const { terminator, lobby, ircClient } = await prepare();
    const message = "[https://www.youtube.com/watch?v=y61v2QCHlpY Don't let osu! keep you up until 4 AM. Getting sleep is important too!]";
    ircClient.emulateMessage("BanchoBot", ircClient.channel, message);
  })

});
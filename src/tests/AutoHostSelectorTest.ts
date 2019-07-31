import { assert } from 'chai';
import { DummyIrcClient } from '../models/dummies';
import { AutoHostSelector, Lobby, LobbyStatus, logIrcEvent, Player, ILobby, IHostSelector, IIrcClient } from "../models";

export function AutoHostSelectorTest() {
  async function prepareSelector(logIrc = false): Promise<{ selector: AutoHostSelector, lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    if (logIrc) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    return { selector: new AutoHostSelector(lobby), lobby, ircClient };
  }

  async function AddPlayers(ids: string[], client: DummyIrcClient): Promise<void> {
    ids.forEach(async (id) => await client.emulateAddPlayerAsync(id));
  }

  function assertHostIs(userid: string, lobby: Lobby): void {
    const host = lobby.host;
    if (host == null) {
      assert.fail();
    } else {
      assert.equal(host.id, userid);
    }

  }

  // async呼び出し用のディレイ関数
  function delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function assertStateIs(state: string, s: AutoHostSelector): void {
    const l = s.lobby;
    switch (state) {
      case "s0":
        assert.equal(s.hostQueue.length, 0);
        break;
      case "s1":
        assert.isTrue(s.hostQueue.length > 0 );
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host == null);
        break;
      case "h":
        assert.isTrue(s.hostQueue.length > 0 );
        assert.isTrue(!l.isMatching);
        assert.isTrue( l.host != null);
        break;
      case "m":
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(l.isMatching);
        break;
      default:
        assert.fail();
        break;
    }
  }

  it("constructor test", async () => {
    const { selector } = await prepareSelector();
    assertStateIs("s0", selector);
  });

  it("s0 -> h test", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    assertStateIs("s0", selector);
    await ircClient.emulateAddPlayerAsync("player1");
    assertStateIs("h", selector);
  });

  it("s0 -> s1 -> h test", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    ircClient.latency = 1;
    let s1checked = false;
    lobby.PlayerJoined.once(({player, slot}) => {
      assert.equal(player.id, "player1");
      assertStateIs("s1", selector);
      s1checked = true;
    });
    assertStateIs("s0", selector);
    
    await ircClient.emulateAddPlayerAsync("player1");
    await delay(5);
    assertStateIs("h", selector);
    assert.isTrue(s1checked);
  });

  it("s0 -> h[1] -> s0 test", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    assertStateIs("s0", selector);
    await ircClient.emulateAddPlayerAsync("player1");
    assertStateIs("h", selector);
    await delay(10);
    await ircClient.emulateRemovePlayerAsync("player1");
    assertStateIs("s0", selector);
  });

  it("h[1] -> h[3] -> s0", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    assertStateIs("s0", selector);
    const pids = ["player1", "player2", "player3"];
    await AddPlayers(pids, ircClient);
    assertHostIs("player1", lobby);
    assertStateIs("h", selector);

    await ircClient.emulateRemovePlayerAsync("player2");
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    await ircClient.emulateRemovePlayerAsync("player1");
    assertStateIs("h", selector);
    assertHostIs("player3", lobby);

    await ircClient.emulateRemovePlayerAsync("player3");
    assertStateIs("s0", selector);
  });

  it("h[3] -> m -> h[3]", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    await AddPlayers(["player1", "player2", "player3"], ircClient);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    await ircClient.emulateMatchAsync(0);
    assertStateIs("h", selector);
    assertHostIs("player2", lobby);
  }); 

  it("h[3] -> m -> h[3] repeat", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    await AddPlayers(["player1", "player2", "player3"], ircClient);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    await ircClient.emulateMatchAsync(0);
    assertStateIs("h", selector);
    assertHostIs("player2", lobby);

    await ircClient.emulateMatchAsync(0);
    assertStateIs("h", selector);
    assertHostIs("player3", lobby);

    await ircClient.emulateMatchAsync(0);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);
  }); 

  it("m join", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    await AddPlayers(["player1", "player2"], ircClient);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    const task = ircClient.emulateMatchAsync(4);
    await delay(1);
    ircClient.emulateAddPlayerAsync("player3");
    await task;

    assertStateIs("h", selector);
    assertHostIs("player2", lobby);

    await ircClient.emulateMatchAsync();
    assertStateIs("h", selector);
    assertHostIs("player3", lobby);
  }); 

  it("m left", async () => {
    const { selector, lobby, ircClient } = await prepareSelector();
    await AddPlayers(["player1", "player2", "player3"], ircClient);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    let task = ircClient.emulateMatchAsync(4);
    await delay(1);
    await ircClient.emulateRemovePlayerAsync("player3");
    await task;

    assertStateIs("h", selector);
    assertHostIs("player2", lobby);

    task = ircClient.emulateMatchAsync(4);
    await delay(1);
    await ircClient.emulateRemovePlayerAsync("player2");
    await ircClient.emulateRemovePlayerAsync("player3");
    await task;
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);
  }); 

  it("host skip test", async () => {
    const { selector, lobby, ircClient } = await prepareSelector(true);
    await AddPlayers(["player1", "player2", "player3"], ircClient);
    assertStateIs("h", selector);
    assertHostIs("player1", lobby);

    lobby.RaiseHostChanged("player2");
    assertHostIs("player2", lobby);

    lobby.RaiseHostChanged("player1");
    assertHostIs("player3", lobby);

    lobby.RaiseHostChanged("player3");
    assertHostIs("player3", lobby);

    lobby.RaiseHostChanged("player2");
    assertHostIs("player1", lobby);
  }); 


}
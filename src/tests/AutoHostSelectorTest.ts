import { assert } from 'chai';
import { DummyIrcClient } from '../dummies';
import { Lobby } from "..";
import { AutoHostSelector } from "../plugins";
import tu from "./TestUtils";

describe("AutoHostSelectorTest", function () {
  before(function () {
    tu.configMochaAsSilent();
  });
  async function prepareSelector(logIrc = false): Promise<{ selector: AutoHostSelector, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    return { selector: new AutoHostSelector(lobby), lobby, ircClient };
  }

  function assertStateIs(state: string, s: AutoHostSelector): void {
    const l = s.lobby;
    switch (state) {
      case "s0": // no players
        assert.equal(s.hostQueue.length, 0);
        break;
      case "s1": // no host
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host == null);
        break;
      case "h": // has host
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host != null);
        break;
      case "m": // matching
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
  
  describe("state transition tests", function () {
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
      lobby.PlayerJoined.once(({ player, slot }) => {
        assert.equal(player.id, "player1");
        assertStateIs("s1", selector);
        s1checked = true;
      });
      assertStateIs("s0", selector);

      await ircClient.emulateAddPlayerAsync("player1");
      await tu.delayAsync(5);
      assertStateIs("h", selector);
      assert.isTrue(s1checked);
    });

    it("s0 -> h[1] -> s0 test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      assertStateIs("s0", selector);
      await ircClient.emulateAddPlayerAsync("player1");
      assertStateIs("h", selector);
      await tu.delayAsync(10);
      await ircClient.emulateRemovePlayerAsync("player1");
      assertStateIs("s0", selector);
    });

    it("h[1] -> h[3] -> s0", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      assertStateIs("s0", selector);
      const pids = ["player1", "player2", "player3"];
      await tu.AddPlayersAsync(pids, ircClient);
      tu.assertHost("player1", lobby);
      assertStateIs("h", selector);

      await ircClient.emulateRemovePlayerAsync("player2");
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateRemovePlayerAsync("player1");
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);

      await ircClient.emulateRemovePlayerAsync("player3");
      assertStateIs("s0", selector);
    });

    it("h[3] -> m -> h[3]", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);
    });

    it("h[3] -> m -> h[3] repeat", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
    });
  });

  describe("join and left tests", function () {
    // 試合中にプレイヤーが入ってきた場合、現在のホストの後ろに配置される
    it("m join", async () => {
      const { selector, lobby, ircClient } = await prepareSelector(false);
      await tu.AddPlayersAsync(["player1", "player2"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      const task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      ircClient.emulateAddPlayerAsync("player3");
      await task;

      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);

      await ircClient.emulateMatchAsync();
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
    });

    it("m left", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      let task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync("player3");
      await task;

      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);

      task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync("player2");
      await task;
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateAddPlayerAsync("player4");
      await ircClient.emulateAddPlayerAsync("player5");
      await ircClient.emulateAddPlayerAsync("player6");

      task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync("player1");
      await task;
      assertStateIs("h", selector);
      tu.assertHost("player4", lobby);
    });

    it("host skip test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      lobby.RaiseHostChanged("player2");
      await tu.delayAsync(1);
      tu.assertHost("player2", lobby);

      lobby.RaiseHostChanged("player1");
      await tu.delayAsync(1);
      tu.assertHost("player3", lobby);

      lobby.RaiseHostChanged("player3");
      await tu.delayAsync(1);
      tu.assertHost("player3", lobby);

      lobby.RaiseHostChanged("player2");
      await tu.delayAsync(1);
      tu.assertHost("player1", lobby);
    });

    it("h left test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateRemovePlayerAsync("player1");
      await tu.delayAsync(1);
      tu.assertHost("player2", lobby);
    });
  });

  describe("external operation tests", function () {
    it("plugin message skip test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
      selector.sendPluginMessage("skip");
      await tu.delayAsync(5);
      tu.assertHost("player2", lobby);
    });

    it("plugin message skipto test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
      selector.sendPluginMessage("skipto", ["player3"]);
      await tu.delayAsync(5);
      tu.assertHost("player3", lobby);
      assert.equal(selector.hostQueue[0].id, "player3");
      assert.equal(selector.hostQueue[1].id, "player1");
      assert.equal(selector.hostQueue[2].id, "player2");
    });
  });

  describe("skip tests", function () {
    it("should change host when map change -> !skip -> map change -> match start", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateRemovePlayerAsync("player2");
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
      assert.isTrue(selector.needsRotate);
    });
    it("should not change host when. map change -> !skip -> match start", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateRemovePlayerAsync("player2");
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);
    });
  });

  describe("match abort tests", function () {
    it("should not change host if match is aborted before any player finished", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await tu.delayAsync(1);
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);

      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateMatchAsync(0);
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);
    });
    it("should change host when match is aborted after some players finished", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await tu.delayAsync(1);
      ircClient.emulatePlayerFinishAsync("player1");
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);

      await tu.delayAsync(10);

      await ircClient.emulateMatchAsync(10);
      assertStateIs("h", selector);
      tu.assertHost("player3", lobby);
    });
    it("should change host when match start -> abort -> map change", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await tu.delayAsync(1);
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);

      assertStateIs("h", selector);
      tu.assertHost("player1", lobby);

      await ircClient.emulateChangeMapAsync();

      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);

      await tu.delayAsync(10);

      await ircClient.emulateMatchAsync(10);
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      tu.assertHost("player2", lobby);
    });
    it("should change host and be remainable when map change -> match start -> host left -> match abort", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost(players[1], lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      let t = ircClient.emulateMatchAsync(100);
      await tu.delayAsync(5);
      await ircClient.emulateRemovePlayerAsync(players[1]);
      assertStateIs("m", selector);
      assert.isNull(lobby.host);
      await lobby.AbortMatch();
      assertStateIs("h", selector);
      tu.assertHost(players[2], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      tu.assertHost(players[2], lobby);
    });
    it("should not change host when -> match start -> host left -> match abort -> map change", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      tu.assertHost(players[1], lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      let t = ircClient.emulateMatchAsync(100);
      await tu.delayAsync(5);
      await ircClient.emulateRemovePlayerAsync(players[1]);
      assertStateIs("m", selector);
      assert.isNull(lobby.host);
      await lobby.AbortMatch();
      assertStateIs("h", selector);
      tu.assertHost(players[2], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateChangeMapAsync(0);
      tu.assertHost(players[2], lobby);
      assert.isTrue(selector.needsRotate);
    });
  });
});
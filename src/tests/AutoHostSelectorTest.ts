import { assert } from 'chai';
import { DummyIrcClient } from '../models/dummies';
import { AutoHostSelector, Lobby, logIrcEvent } from "../models";
import log4js from "log4js";

export function AutoHostSelectorTest() {
  before(function () {
    log4js.configure("config/log_mocha_silent.json");
  });
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
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host == null);
        break;
      case "h":
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host != null);
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

  describe("setup tests", function () {
    it("constructor test", async () => {
      const { selector } = await prepareSelector();
      assertStateIs("s0", selector);
    });
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
  });

  describe("join and left tests", function () {
    // 試合中にプレイヤーが入ってきた場合、現在のホストの後ろに配置される
    it("m join", async () => {
      const { selector, lobby, ircClient } = await prepareSelector(false);
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
      assertHostIs("player1", lobby);
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
      await task;
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      await ircClient.emulateAddPlayerAsync("player4");
      await ircClient.emulateAddPlayerAsync("player5");
      await ircClient.emulateAddPlayerAsync("player6");

      task = ircClient.emulateMatchAsync(4);
      await delay(1);
      await ircClient.emulateRemovePlayerAsync("player1");
      await task;
      assertStateIs("h", selector);
      assertHostIs("player4", lobby);
    });

    it("host skip test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      lobby.RaiseHostChanged("player2");
      await delay(1);
      assertHostIs("player2", lobby);

      lobby.RaiseHostChanged("player1");
      await delay(1);
      assertHostIs("player3", lobby);

      lobby.RaiseHostChanged("player3");
      await delay(1);
      assertHostIs("player3", lobby);

      lobby.RaiseHostChanged("player2");
      await delay(1);
      assertHostIs("player1", lobby);
    });

    it("h left test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      await ircClient.emulateRemovePlayerAsync("player1");
      await delay(1);
      assertHostIs("player2", lobby);
    });
  });

  describe("external operation tests", function () {
    it("plugin message skip test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);
      selector.sendPluginMessage("skip");
      await delay(5);
      assertHostIs("player2", lobby);
    });

    it("plugin message skipto test", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);
      selector.sendPluginMessage("skipto", ["player3"]);
      await delay(5);
      assertHostIs("player3", lobby);
      assert.equal(selector.hostQueue[0].id, "player3");
      assert.equal(selector.hostQueue[1].id, "player1");
      assert.equal(selector.hostQueue[2].id, "player2");
    });
  });

  describe("match abort and skip tests", function () {
    it("does not change host if match is aborted before any player finished", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await delay(1);
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);

      assertStateIs("h", selector);
      assertHostIs("player1", lobby);     

      await ircClient.emulateMatchAsync(0);
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      assertHostIs("player2", lobby);
    });
    it("change host if match is aborted after some players finished", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await delay(1);
      ircClient.emulatePlayerFinishAsync("player1");
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      assertHostIs("player2", lobby);

      await delay(10);

      await ircClient.emulateMatchAsync(10);
      assertStateIs("h", selector);
      assertHostIs("player3", lobby);
    });
    it("host will change. match start -> abort -> map change", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      ircClient.emulateMatchAsync(10);
      await delay(1);
      await lobby.AbortMatch();
      assert.isFalse(lobby.isMatching);
      assert.isFalse(selector.needsRotate);

      assertStateIs("h", selector);
      assertHostIs("player1", lobby);

      await ircClient.emulateChangeMapAsync();

      assertStateIs("h", selector);
      assertHostIs("player2", lobby);

      await delay(10);

      await ircClient.emulateMatchAsync(10);
      assert.isFalse(lobby.isMatching);
      assert.isTrue(selector.needsRotate);
      assertStateIs("h", selector);
      assertHostIs("player2", lobby);
    });

    it("host will ramain. map change -> !skip -> match start", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      assertHostIs("player2", lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateRemovePlayerAsync("player2");
      assertStateIs("h", selector);
      assertHostIs("player3", lobby);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      assertHostIs("player3", lobby);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);
    });

    it("host will change. map change -> !skip -> map change -> match start", async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await AddPlayers(["player1", "player2", "player3"], ircClient);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      assertHostIs("player2", lobby);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateRemovePlayerAsync("player2");
      assertStateIs("h", selector);
      assertHostIs("player3", lobby);
      assert.isFalse(selector.needsRotate);
      await ircClient.emulateChangeMapAsync(0);
      assert.isTrue(selector.needsRotate);
      await ircClient.emulateMatchAsync(0);
      assertStateIs("h", selector);
      assertHostIs("player1", lobby);
      assert.isTrue(selector.needsRotate);
    });
  });

}
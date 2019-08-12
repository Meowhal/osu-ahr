import { assert } from 'chai';
import { DummyIrcClient } from '../models/dummies';
import { HostSkipper, HostSkipperOption, Lobby, logIrcEvent, Player } from "../models";
import config from "config";

export function HostSkipperTest() {
  async function prepare(skip_timer_ms: number, logIrc: boolean = false):
    Promise<{ skipper: HostSkipper, lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    if (logIrc) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    const skipper = new HostSkipper(lobby, { skip_timer_delay_ms: skip_timer_ms })
    return { skipper, lobby, ircClient };
  }

  async function AddPlayers(ids: string[] | number, client: DummyIrcClient): Promise<void> {
    if (typeof ids == "number") {
      const start = client.players.size;
      for (let i = 0; i < ids; i++) {
        await client.emulateAddPlayerAsync("p" + (i + start));
      }
    } else {
      ids.forEach(async (id) => await client.emulateAddPlayerAsync(id));
    }
  }

  // async呼び出し用のディレイ関数
  function delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function assertHostIs(userid: string, lobby: Lobby): void {
    const host = lobby.host;
    if (host == null) {
      assert.fail();
    } else {
      assert.equal(host.id, userid);
    }
  }

  async function changeHostAsync(id: string, lobby: Lobby): Promise<number> {
    const p = new Promise<number>(resolve => {
      lobby.HostChanged.once(async () => {
        resolve(new Date().getTime());
      });
    });
    lobby.TransferHost(lobby.GetPlayer(id) as Player);
    return p;
  }

  async function recieveSkipAsync(lobby: Lobby, callback: (() => void) | null = null): Promise<number> {
    return new Promise<number>(resolve => {
      lobby.PluginMessage.once(a => {
        assert.equal(a.type, "skip");
        if (callback) callback();
        resolve(new Date().getTime());
      });
    });
  }

  async function rejectSkipAsync(lobby: Lobby, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      setTimeout(() => {
        resolve(new Date().getTime());
      }, timeout);
      lobby.PluginMessage.once(a => {
        assert.fail();
        reject();
      });
    });
  }

  describe("construction test", () => {
    it("default", async () => {
      const ircClient = new DummyIrcClient("osu_irc_server", "creator");
      const lobby = new Lobby(ircClient);
      await lobby.MakeLobbyAsync("test");
      const skipper = new HostSkipper(lobby);
      const option = config.get<HostSkipperOption>("HostSkipper");
      assert.deepEqual(skipper.option, option);
    });
    it("with option full", async () => {
      const ircClient = new DummyIrcClient("osu_irc_server", "creator");
      const lobby = new Lobby(ircClient);
      await lobby.MakeLobbyAsync("test");
      const option: HostSkipperOption = {
        skip_request_min: 1,
        skip_request_rate: 2,
        skip_timer_delay_ms: 3
      }
      const skipper = new HostSkipper(lobby, option);
      assert.deepEqual(skipper.option, option);
    });
    it("with option partial", async () => {
      const ircClient = new DummyIrcClient("osu_irc_server", "creator");
      const lobby = new Lobby(ircClient);
      await lobby.MakeLobbyAsync("test");
      const option = {
        skip_request_rate: 2,
      }
      const defaultOption = config.get<HostSkipperOption>("HostSkipper");
      const skipper = new HostSkipper(lobby, option);
      assert.equal(skipper.option.skip_request_min, defaultOption.skip_request_min);
      assert.notEqual(skipper.option.skip_request_rate, defaultOption.skip_request_rate);
      assert.equal(skipper.option.skip_request_rate, option.skip_request_rate);
      assert.equal(skipper.option.skip_timer_delay_ms, defaultOption.skip_timer_delay_ms);
    });
    it("prepare function", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      lobby.TransferHost(lobby.GetPlayer("p1") as Player);
      assert.isNotNull(lobby.host);
      assertHostIs("p1", lobby);
    });
  });
  describe("skip timer test", function () {
    it("skip 10ms", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      assert.isUndefined(skipper.skipTimer);
      await changeHostAsync("p1", lobby);
      assert.isDefined(skipper.skipTimer);
      assert.isEmpty(skipper.skipRequesters);
      await recieveSkipAsync(lobby);
      assert.isUndefined(skipper.skipTimer);
    });

    const dslow = this.slow();
    this.slow(500);

    it("skip time check", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      let test = async (waitTime: number) => {
        skipper.option.skip_timer_delay_ms = waitTime;
        skipper.clearAll();
        const startTime = await changeHostAsync("p1", lobby);
        const endTime = await recieveSkipAsync(lobby);
        const elapsed = endTime - startTime;
        assert.closeTo(elapsed, waitTime, 10);
      }
      await test(10);
      await test(50);
      await test(100);
    });
    it("timer reset when host changed", async () => {
      const { skipper, lobby, ircClient } = await prepare(30);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      const startTime = await changeHostAsync("p1", lobby);
      const rt = recieveSkipAsync(lobby);
      assertHostIs("p1", lobby);
      await delay(10);
      await changeHostAsync("p2", lobby);
      const endTime = await rt;
      assertHostIs("p2", lobby);
      const elapsed = endTime - startTime;
      assert.closeTo(elapsed, 10 + 30, 5);
    });
    it("timer reset when host changing map", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      const startTime = await changeHostAsync("p1", lobby);
      await delay(5);
      assert.isDefined(skipper.skipTimer);
      ircClient.emulateChangeMapAsync(0);
      await delay(10);
      assert.isUndefined(skipper.skipTimer);
      await rejectSkipAsync(lobby, 10);
    });
    this.slow(dslow);
  });

  describe("skip vote test", function () {
    it("vote required check", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      assert.equal(skipper.requiredSkip, 2);
      await AddPlayers(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await AddPlayers(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await AddPlayers(1, ircClient);
      assert.equal(skipper.requiredSkip, 2); // player:3
      await AddPlayers(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await AddPlayers(1, ircClient);
      assert.isAtMost(skipper.requiredSkip, 3); // player:5
      await AddPlayers(1, ircClient);
      assert.isAtMost(skipper.requiredSkip, 3);
      await AddPlayers(1, ircClient);
      assert.isAtMost(skipper.requiredSkip, 4); // player:7
      await AddPlayers(1, ircClient);
      assert.isAtMost(skipper.requiredSkip, 4);
    });
    it("host skip", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(3, ircClient);
      await changeHostAsync("p0", lobby);
      const rt = recieveSkipAsync(lobby);
      ircClient.raiseMessage("p0", ircClient.channel, "!skip");
      await rt;
    });
    it("host invalid skip", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      skipper.stopTimer();
      ircClient.raiseMessage("p0", ircClient.channel, "!skipaaaaa");
      await rejectSkipAsync(lobby, 10);
    });
    it("skip by players", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      skipper.stopTimer();
      let skiped = false;
      const task = recieveSkipAsync(lobby, () => skiped = true);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 1);
      assert.isFalse(skiped);
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
      assert.isFalse(skiped);

      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      await delay(10);
      await task;
      assert.equal(skipper.countSkip, 0);
      assert.isTrue(skiped);
    });
    it("duplicate vote", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      skipper.stopTimer();

      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
    });
    it("vote can valid after mapchanging", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      skipper.stopTimer();
      let skiped = false;
      const task = recieveSkipAsync(lobby, () => skiped = true);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.isFalse(skiped);
      ircClient.emulateChangeMapAsync(0);
      await delay(10);
      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      await delay(10);
      await task;
      assert.equal(skipper.countSkip, 0);
      assert.isTrue(skiped);
    });
    it("vote reject when match", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.skip_request_rate = 0.5;
      skipper.option.skip_request_min = 2;
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      skipper.stopTimer();
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      ircClient.emulateMatchAsync(10);
      await delay(1);
      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      ircClient.raiseMessage("p4", ircClient.channel, "!skip");
      await delay(1);
      assert.equal(skipper.countSkip, 0);
      await delay(10);
      assert.equal(skipper.countSkip, 0);
    });
  });

}
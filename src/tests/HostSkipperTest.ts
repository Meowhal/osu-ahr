import { assert } from 'chai';
import { DummyIrcClient } from '../models/dummies';
import { HostSkipper, HostSkipperOption, Lobby, logIrcEvent, Player } from "../models";
import config from "config";

export function HostSkipperTest() {
  async function prepare(timer_delay: number = 0, vote_delay: number = 0, logIrc: boolean = false):
    Promise<{ skipper: HostSkipper, lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    if (logIrc) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    const option: HostSkipperOption = {
      skip_request_min: 2,
      skip_request_rate: 0.5,
      skip_vote_delay_ms: vote_delay,
      afk_timer_delay_ms: timer_delay,
      afk_timer_message: "",
      afk_timer_do_skip: true
    }
    const skipper = new HostSkipper(lobby, option)
    return { skipper, lobby, ircClient };
  }

  async function AddPlayers(ids: string[] | number, client: DummyIrcClient): Promise<string[]> {
    if (typeof ids == "number") {
      const start = client.players.size;
      const p = [];
      for (let i = 0; i < ids; i++) {
        p[i] = "p" + (i + start)
        await client.emulateAddPlayerAsync(p[i]);
      }
      return p;
    } else {
      ids.forEach(async (id) => await client.emulateAddPlayerAsync(id));
      return ids;
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
        resolve(Date.now());
      });
    });
    lobby.TransferHost(lobby.GetPlayer(id) as Player);
    return p;
  }

  async function resolveSkipAsync(lobby: Lobby, callback: (() => void) | null = null): Promise<number> {
    return new Promise<number>(resolve => {
      lobby.PluginMessage.once(a => {
        assert.equal(a.type, "skip");
        if (callback) callback();
        resolve(Date.now());
      });
    });
  }

  async function rejectSkipAsync(lobby: Lobby, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      setTimeout(() => {
        resolve(Date.now());
      }, timeout);
      lobby.PluginMessage.once(a => {
        if (a.type == "skip") {
          assert.fail();
          reject();
        }        
      });
    });
  }

  async function resolveSkiptoAsync(lobby: Lobby, userid:string, callback: (() => void) | null = null): Promise<number> {
    return new Promise<number>(resolve => {
      lobby.PluginMessage.once(a => {
        assert.equal(a.type, "skipto");
        assert.equal(a.args[0], userid);
        if (callback) callback();
        resolve(Date.now());
      });
    });
  }

  async function rejectSkiptoAsync(lobby: Lobby, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      setTimeout(() => {
        resolve(Date.now());
      }, timeout);
      lobby.PluginMessage.once(a => {
        if (a.type == "skipto") {
          assert.fail();
          reject();
        }        
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
        skip_vote_delay_ms: 0,
        afk_timer_delay_ms: 3,
        afk_timer_message: "hello",
        afk_timer_do_skip: true
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
      assert.equal(skipper.option.afk_timer_delay_ms, defaultOption.afk_timer_delay_ms);
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
      assert.isUndefined(skipper.afkTimer);
      await changeHostAsync("p1", lobby);
      assert.isDefined(skipper.afkTimer);
      assert.isEmpty(skipper.skipRequesters);
      await resolveSkipAsync(lobby);
      assert.isUndefined(skipper.afkTimer);
    });

    const dslow = this.slow();
    this.slow(500);

    it("skip time check", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      let test = async (waitTime: number) => {
        skipper.option.afk_timer_delay_ms = waitTime;
        skipper.restart();
        const startTime = await changeHostAsync("p1", lobby);
        const endTime = await resolveSkipAsync(lobby);
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
      const rt = resolveSkipAsync(lobby);
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
      assert.isDefined(skipper.afkTimer);
      ircClient.emulateChangeMapAsync(0);
      await delay(10);
      assert.isUndefined(skipper.afkTimer);
      await rejectSkipAsync(lobby, 10);
    });
    it("if delay time is 0, timer dosent work", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      await changeHostAsync("p1", lobby);
      assert.isUndefined(skipper.afkTimer);
      await delay(10);
      assert.isUndefined(skipper.afkTimer);
      await rejectSkipAsync(lobby, 100);
    });
    it("dosent skip if option is false", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.afk_timer_do_skip = false;
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      await changeHostAsync("p1", lobby);
      await rejectSkipAsync(lobby, 100);
    });
    it("timer stop when host chated", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await AddPlayers(["p1", "p2", "p3"], ircClient);
      await changeHostAsync("p1", lobby);
      await ircClient.raiseMessageAsync("p1", ircClient.channel, "hello");
      await rejectSkipAsync(lobby, 100);
    });
    this.slow(dslow);

  });

  describe("skip vote test", function () {
    it("vote required check", async () => {
      const { skipper, lobby, ircClient } = await prepare();
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
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await AddPlayers(3, ircClient);
      await changeHostAsync("p0", lobby);
      const rt = resolveSkipAsync(lobby);
      ircClient.raiseMessage("p0", ircClient.channel, "!skip");
      await rt;
    });
    it("host skip should be ignored at cool time", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 10);
      await AddPlayers(3, ircClient);
      await changeHostAsync("p0", lobby);
      const rt = rejectSkipAsync(lobby, 20);
      ircClient.raiseMessage("p0", ircClient.channel, "!skip");
      await rt;
    });
    it("host invalid skip", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p0", ircClient.channel, "!skipaaaaa");
      await rejectSkipAsync(lobby, 10);
    });
    it("skip by players", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 1);
      assert.isFalse(skipped);
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
      assert.isFalse(skipped);

      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      await delay(10);
      await task;
      assert.equal(skipper.countSkip, 3);
      assert.isTrue(skipped);
    });
    it("is player skip ignored at cooltime", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 100);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      let skipped = false;
      const task = rejectSkipAsync(lobby, 50);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);

      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      await delay(10);
      await task;
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);
    });
    it("duplicate vote", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      await delay(10);
      assert.equal(skipper.countSkip, 2);
    });
    it("vote can valid after mapchanging", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip");
      ircClient.raiseMessage("p2", ircClient.channel, "!skip");
      await delay(10);
      assert.isFalse(skipped);
      ircClient.emulateChangeMapAsync(0);
      await delay(10);
      ircClient.raiseMessage("p3", ircClient.channel, "!skip");
      await delay(10);
      await task;
      assert.equal(skipper.countSkip, 3);
      assert.isTrue(skipped);
    });
    it("vote reject when match", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
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
    it("is lots of vote ignored", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      const numplayers = 16;
      await AddPlayers(numplayers, ircClient);
      await changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      for (let i = 1; i < numplayers; i++) {
        ircClient.raiseMessage("p" + i, ircClient.channel, "!skip");
        await delay(1);
        assert.equal(skipper.countSkip, Math.min(i, skipper.requiredSkip));
        assert.equal(skipped, skipper.requiredSkip <= i);
      }
    });
    it("accept !skip with host id", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip p0");
      assert.equal(skipper.countSkip, 1);
    });
    it("accept !skip with host id with complex name", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      const players = ["abc xxx[aaui]", "a", "b", "c"];
      await AddPlayers(players, ircClient);
      await changeHostAsync(players[0], lobby);
      ircClient.raiseMessage(players[1], ircClient.channel, "!skip " + players[0]);
      assert.equal(skipper.countSkip, 1);
    });
    it("accept !skip with space", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      const players = await AddPlayers(5, ircClient);
      await changeHostAsync(players[0], lobby);
      ircClient.raiseMessage(players[1], ircClient.channel, "!skip ");
      assert.equal(skipper.countSkip, 1);
    });

    it("ignore !skip if none host player targeted", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "!skip abc");
      assert.equal(skipper.countSkip, 0);
    });

  });
  describe("custom command tests", function () {
    it("*skip by authorized user test", async() => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkipAsync(lobby);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "*skip");
      await t;
    });
    it("*skip by authorized user with param test", async() => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkipAsync(lobby);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "*skip aaa");
      await t;
    });
    it("*skip by Unauthorized test", async() => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = rejectSkipAsync(lobby, 25);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p2", ircClient.channel, "*skip");
      await t;
    });
    it("*skipto test", async() => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkiptoAsync(lobby, "p3");
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "*skipto p3");
      await t;
    });
    it("failed *skipto if param isn't userid", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = rejectSkiptoAsync(lobby, 25);
      await AddPlayers(5, ircClient);
      await changeHostAsync("p0", lobby);
      ircClient.raiseMessage("p1", ircClient.channel, "*skipto pvv3 asdv");
      await t;
    });
  })

}
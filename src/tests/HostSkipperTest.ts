import { assert } from 'chai';
import { DummyIrcClient } from '../dummies';
import { Lobby, Player } from "..";
import config from "config";
import tu from "./TestUtils";
import { HostSkipper, HostSkipperOption } from '../plugins';

describe("ostSkipperTest", function () {
  before(function () {
    tu.configMochaAsSilent();
  });
  async function prepare(timer_delay: number = 0, vote_delay: number = 0, logIrc: boolean = false):
    Promise<{ skipper: HostSkipper, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const option: HostSkipperOption = {
      skip_request_min: 2,
      skip_request_rate: 0.5,
      skip_vote_delay_ms: vote_delay,
      afk_timer_delay_ms: timer_delay,
      afk_timer_message: "",
      afk_timer_do_skip: true
    }
    const skipper = new HostSkipper(li.lobby, option)
    return { skipper, ...li };
  }

  async function resolveSkipAsync(lobby: Lobby, callback: (() => void) | null = null): Promise<number> {
    const t = tu.assertEventFire(lobby.PluginMessage, a => a.type == "skip");
    if (callback != null) {
      t.then(a => {
        callback();
        return a;
      })
    }
    return t;
  }

  async function rejectSkipAsync(lobby: Lobby, timeout: number): Promise<number> {
    return tu.assertEventNeverFire(lobby.PluginMessage, a => a.type == "skip", timeout);
  }

  async function resolveSkiptoAsync(lobby: Lobby, userid: string): Promise<number> {
    return tu.assertEventFire(lobby.PluginMessage, a => a.type == "skipto" && a.args[0] == userid);
  }

  async function rejectSkiptoAsync(lobby: Lobby, timeout: number): Promise<number> {
    return tu.assertEventNeverFire(lobby.PluginMessage, a => a.type == "skipto", timeout);
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
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      lobby.TransferHost(lobby.GetPlayer("p1") as Player);
      assert.isNotNull(lobby.host);
      tu.assertHost("p1", lobby);
    });
  });
  describe("skip timer test", function () {
    it("skip 10ms", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      assert.isUndefined(skipper.afkTimer);
      await tu.changeHostAsync("p1", lobby);
      assert.isDefined(skipper.afkTimer);
      assert.isEmpty(skipper.skipRequesters);
      await resolveSkipAsync(lobby);
      assert.isUndefined(skipper.afkTimer);
    });

    const dslow = this.slow();
    this.slow(500);

    it("skip time check", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      let test = async (waitTime: number) => {
        skipper.option.afk_timer_delay_ms = waitTime;
        skipper.restart();
        const startTime = await tu.changeHostAsync("p1", lobby);
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
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      const startTime = await tu.changeHostAsync("p1", lobby);
      const rt = resolveSkipAsync(lobby);
      tu.assertHost("p1", lobby);
      await tu.delayAsync(10);
      await tu.changeHostAsync("p2", lobby);
      const endTime = await rt;
      tu.assertHost("p2", lobby);
      const elapsed = endTime - startTime;
      assert.closeTo(elapsed, 10 + 30, 5);
    });
    it("timer reset when host changing map", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      const startTime = await tu.changeHostAsync("p1", lobby);
      await tu.delayAsync(5);
      assert.isDefined(skipper.afkTimer);
      ircClient.emulateChangeMapAsync(0);
      await tu.delayAsync(10);
      assert.isUndefined(skipper.afkTimer);
      await rejectSkipAsync(lobby, 10);
    });
    it("if delay time is 0, timer dosent work", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      await tu.changeHostAsync("p1", lobby);
      assert.isUndefined(skipper.afkTimer);
      await tu.delayAsync(10);
      assert.isUndefined(skipper.afkTimer);
      await rejectSkipAsync(lobby, 100);
    });
    it("dosent skip if option is false", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      skipper.option.afk_timer_do_skip = false;
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      await tu.changeHostAsync("p1", lobby);
      await rejectSkipAsync(lobby, 100);
    });
    it("timer stop when host chated", async () => {
      const { skipper, lobby, ircClient } = await prepare(10);
      await tu.AddPlayersAsync(["p1", "p2", "p3"], ircClient);
      await tu.changeHostAsync("p1", lobby);
      await ircClient.emulateMessageAsync("p1", ircClient.channel, "hello");
      await rejectSkipAsync(lobby, 100);
    });
    this.slow(dslow);

  });

  describe("skip vote test", function () {
    it("vote required check", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      assert.equal(skipper.requiredSkip, 2);
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 2); // player:3
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 2);
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 3); // player:5
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 3);
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 4); // player:7
      await tu.AddPlayersAsync(1, ircClient);
      assert.equal(skipper.requiredSkip, 4);
    });
    it("host skip", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await tu.AddPlayersAsync(3, ircClient);
      await tu.changeHostAsync("p0", lobby);
      const rt = resolveSkipAsync(lobby);
      ircClient.emulateMessage("p0", ircClient.channel, "!skip");
      await rt;
    });
    it("host skip should be ignored at cool time", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 10);
      await tu.AddPlayersAsync(3, ircClient);
      await tu.changeHostAsync("p0", lobby);
      const rt = rejectSkipAsync(lobby, 20);
      ircClient.emulateMessage("p0", ircClient.channel, "!skip");
      await rt;
    });
    it("host invalid skip", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p0", ircClient.channel, "!skipaaaaa");
      await rejectSkipAsync(lobby, 10);
    });
    it("skip by players", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 1);
      assert.isFalse(skipped);
      ircClient.emulateMessage("p2", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 2);
      assert.isFalse(skipped);

      ircClient.emulateMessage("p3", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      await task;
      assert.equal(skipper.countSkip, 3);
      assert.isTrue(skipped);
    });
    it("is player skip ignored at cooltime", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 100);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      let skipped = false;
      const task = rejectSkipAsync(lobby, 50);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);
      ircClient.emulateMessage("p2", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);

      ircClient.emulateMessage("p3", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      await task;
      assert.equal(skipper.countSkip, 0);
      assert.isFalse(skipped);
    });
    it("duplicate vote", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      ircClient.emulateMessage("p2", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 2);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 2);
    });
    it("vote can valid after mapchanging", async () => {
      const { skipper, lobby, ircClient } = await prepare(0, 0);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      ircClient.emulateMessage("p2", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      assert.isFalse(skipped);
      ircClient.emulateChangeMapAsync(0);
      await tu.delayAsync(10);
      ircClient.emulateMessage("p3", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      await task;
      assert.equal(skipper.countSkip, 3);
      assert.isTrue(skipped);
    });
    it("vote reject when match", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip");
      ircClient.emulateMessage("p2", ircClient.channel, "!skip");
      await tu.delayAsync(10);
      ircClient.emulateMatchAsync(10);
      await tu.delayAsync(1);
      ircClient.emulateMessage("p3", ircClient.channel, "!skip");
      ircClient.emulateMessage("p4", ircClient.channel, "!skip");
      await tu.delayAsync(1);
      assert.equal(skipper.countSkip, 0);
      await tu.delayAsync(10);
      assert.equal(skipper.countSkip, 0);
    });
    it("is lots of vote ignored", async () => {
      const { skipper, lobby, ircClient } = await prepare(0);
      const numplayers = 16;
      await tu.AddPlayersAsync(numplayers, ircClient);
      await tu.changeHostAsync("p0", lobby);
      let skipped = false;
      const task = resolveSkipAsync(lobby, () => skipped = true);
      for (let i = 1; i < numplayers; i++) {
        ircClient.emulateMessage("p" + i, ircClient.channel, "!skip");
        await tu.delayAsync(1);
        assert.equal(skipper.countSkip, Math.min(i, skipper.requiredSkip));
        assert.equal(skipped, skipper.requiredSkip <= i);
      }
    });
    it("accept !skip with host id", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip p0");
      assert.equal(skipper.countSkip, 1);
    });
    it("accept !skip with host id with complex name", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      const players = ["abc xxx[aaui]", "a", "b", "c"];
      await tu.AddPlayersAsync(players, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMessage(players[1], ircClient.channel, "!skip " + players[0]);
      assert.equal(skipper.countSkip, 1);
    });
    it("accept !skip with space", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMessage(players[1], ircClient.channel, "!skip ");
      assert.equal(skipper.countSkip, 1);
    });

    it("ignore !skip if none host player targeted", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "!skip abc");
      assert.equal(skipper.countSkip, 0);
    });

  });
  describe("custom command tests", function () {
    it("*skip by authorized user test", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkipAsync(lobby);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "*skip");
      await t;
    });
    it("*skip by authorized user with param test", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkipAsync(lobby);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "*skip aaa");
      await t;
    });
    it("*skip by Unauthorized test", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = rejectSkipAsync(lobby, 25);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p2", ircClient.channel, "*skip");
      await t;
    });
    it("*skipto test", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = resolveSkiptoAsync(lobby, "p3");
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "*skipto p3");
      await t;
    });
    it("failed *skipto if param isn't userid", async () => {
      const { skipper, lobby, ircClient } = await prepare();
      lobby.option.authorized_users.push("p1");
      var t = rejectSkiptoAsync(lobby, 25);
      await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync("p0", lobby);
      ircClient.emulateMessage("p1", ircClient.channel, "*skipto pvv3 asdv");
      await t;
    });
  })
});
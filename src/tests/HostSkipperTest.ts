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

  async function AddPlayers(ids: string[], client: DummyIrcClient): Promise<void> {
    ids.forEach(async (id) => await client.emulateAddPlayerAsync(id));
  }

  // async呼び出し用のディレイ関数
  function delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
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
      const {skipper, lobby, ircClient} = await prepare(10);
      AddPlayers(["p1", "p2", "p3"], ircClient);
      lobby.TransferHost(lobby.GetPlayer("p1") as Player);
      assert.isNotNull(lobby.host);
      assert.equal((lobby.host as Player).id, "p1");
    });
  });
  describe("skip timer test", () =>{
    it("skip 10ms", async () =>{
      const {skipper, lobby, ircClient} = await prepare(10);
      let done = false;
      const hostChangedAsync = new Promise<void>(resolve=>{
        lobby.HostChanged.once(async () => {
          resolve();
        });
      });
      const pluginMessageAsync = new Promise<void>(resolve =>{ 
        lobby.PluginMessage.once(a => {
          assert.equal(a.type, "skip");
          done = true;
          resolve();
        });
      });
      AddPlayers(["p1", "p2", "p3"], ircClient);
      assert.isUndefined(skipper.skipTimer);
      lobby.TransferHost(lobby.GetPlayer("p1") as Player);
      await hostChangedAsync;
      assert.isDefined(skipper.skipTimer);
      assert.isEmpty(skipper.skipRequesters);
      assert.isFalse(done);
      await pluginMessageAsync;
      assert.isUndefined(skipper.skipTimer);
      assert.isTrue(done);
    });
  });
}
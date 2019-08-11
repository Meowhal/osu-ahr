import { assert } from 'chai';
import { DummyIrcClient } from '../models/dummies';
import { HostSkipper, Lobby, logIrcEvent } from "../models";

export function HostSkipperTest() {
  async function prepareSelector(logIrc = false):
    Promise<{ skipper: HostSkipper, lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    if (logIrc) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    return { skipper: new HostSkipper(lobby), lobby, ircClient };
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

    })
  });
}
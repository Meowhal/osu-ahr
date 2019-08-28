import { Lobby, logIrcEvent, Player } from "..";
import { DummyIrcClient } from "../dummies";
import { assert } from 'chai';
import log4js from "log4js";
import { TypedEvent } from "../libs/events";

class TestUtils {
  ownerNickname: string = "creator";
  lobbyName: string = "test";

  async SetupLobbyAsync(logging: boolean = false):
    Promise<{ lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient("osu_irc_server", this.ownerNickname);
    if (logging) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync(this.lobbyName);
    return { lobby, ircClient };
  }

  async AddPlayersAsync(ids: string[] | number, client: DummyIrcClient): Promise<string[]> {
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
  delayAsync(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  assertHost(userid: string, lobby: Lobby): void {
    const host = lobby.host;
    if (host == null) {
      assert.fail();
    } else {
      assert.equal(host.id, userid);
    }
  }

  async changeHostAsync(id: string, lobby: Lobby): Promise<number> {
    const p = new Promise<number>(resolve => {
      lobby.HostChanged.once(async () => {
        resolve(Date.now());
      });
    });
    lobby.TransferHost(lobby.GetPlayer(id) as Player);
    return p;
  }

  configMochaNoisy(): void {
    log4js.configure("config/log_mocha.json");
  }

  configMochaSilent(): void {
    log4js.configure("config/log_mocha_silent.json");
  }

  /**
   * 時間内に指定したイベントが発生することを確認する
   * @param event 対象のイベント
   * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返す監視は継続される
   * @param timeout リジェクトまでのミリ秒時間
   */
  async assertEventFire<T>(event: TypedEvent<T>, cb: ((a: T) => (boolean)) | null, timeout: number = 0): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let id : NodeJS.Timeout;
      if (timeout != 0) {
        id = setTimeout(() => {
          d.dispose();          
          reject("The event was expected to fire, but it didn't fire");
        }, timeout);
      }
      const d = event.on(a => {
        if (cb != null && cb(a) === false) return;
        d.dispose();
        clearTimeout(id);
        resolve(Date.now());
      });
    });
  }

  /**
   * 時間内に指定したイベントが発生"しない"ことを確認する
   * @param event 対象のイベント
   * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返す監視は継続される
   * @param timeout イベント発生までの待ち時間
   */
  async assertEventNeverFire<T>(event: TypedEvent<T>, cb: ((a: T) => (boolean)) | null, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const id = setTimeout(() => {
        d.dispose();
        resolve(Date.now());
      }, timeout);
      const d = event.on(a => {
        if (cb != null && cb(a) === false) return;
        clearTimeout(id);
        d.dispose();
        reject("The event was expected not to fire, but it fired");
      });
    });
  }
}

const instance = new TestUtils();
export default instance;
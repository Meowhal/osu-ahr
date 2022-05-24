import { Lobby } from '../Lobby';
import { logIrcEvent } from '../IIrcClient';
import { Player, Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { BanchoResponse, BanchoResponseType } from '../parsers/CommandParser';
import { MpSettingsResult } from '../parsers/MpSettingsParser';
import { TypedEvent } from '../libs/TypedEvent';
import { assert } from 'chai';
import log4js from 'log4js';

class TestUtils {
  ownerNickname: string = 'creator';
  lobbyName: string = 'test';

  async SetupLobbyAsync(logging: boolean = false):
    Promise<{ lobby: Lobby, ircClient: DummyIrcClient }> {
    const ircClient = new DummyIrcClient('osu_irc_server', this.ownerNickname);
    if (logging) {
      logIrcEvent(ircClient);
    }
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync(this.lobbyName);
    return { lobby, ircClient };
  }

  async AddPlayersAsync(names: string[] | number, client: DummyIrcClient): Promise<string[]> {
    if (typeof names === 'number') {
      const start = client.players.size;
      const p = [];
      for (let i = 0; i < names; i++) {
        p[i] = `p${i + start}`;
        await client.emulateAddPlayerAsync(p[i]);
      }
      return p;
    } else {
      names.forEach(async (name) => await client.emulateAddPlayerAsync(name));
      return names;
    }
  }

  async sendMessageAsOwner(lobby: Lobby, message: string) {
    const owner = lobby.GetOrMakePlayer(this.ownerNickname);
    lobby.RaiseReceivedChatCommand(owner, message);
  }

  // async呼び出し用のディレイ関数
  delayAsync(ms: number): Promise<void> {
    if (ms === 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  assertHost(username: string, lobby: Lobby): void {
    const host = lobby.host;
    if (host === null) {
      assert.fail('No one is host now.');
    } else {
      assert.equal(host.name, username);
    }
    for (const p of lobby.players) {
      if (p === host) {
        assert.isTrue(p.isHost);
      } else {
        assert.isFalse(p.isHost);
      }
    }
  }

  async changeHostAsync(name: string, lobby: Lobby): Promise<number> {
    const p = new Promise<number>(resolve => {
      lobby.HostChanged.once(async () => {
        resolve(Date.now());
      });
    });
    lobby.TransferHost(lobby.GetPlayer(name) as Player);
    return p;
  }
  loggerMode = '';

  configMochaVerbosely(): void {
    if (this.loggerMode !== 'Verbosely') {
      this.loggerMode = 'Verbosely';
      log4js.shutdown();
      log4js.configure('config/log_mocha_verbose.json');
    }

  }

  configMochaAsSilent(): void {
    if (this.loggerMode !== 'Silent') {
      this.loggerMode = 'Silent';
      log4js.shutdown();
      log4js.configure('config/log_mocha.json');
    }
  }


  /**
   * 時間内に指定したイベントが発生することを確認する
   * @param event 対象のイベント
   * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返すと監視が継続される
   * @param timeout リジェクトまでのミリ秒時間
   */
  async assertEventFire<T>(event: TypedEvent<T>, cb: ((a: T) => (boolean)) | null, timeout: number = 0): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let id: NodeJS.Timeout;
      if (timeout !== 0) {
        id = setTimeout(() => {
          d.dispose();
          reject('The expected event was not fired');
        }, timeout);
      }
      const d = event.on(a => {
        if (cb !== null && cb(a) === false) return;
        d.dispose();
        clearTimeout(id);
        resolve(Date.now());
      });
    });
  }

  /**
   * 時間内に指定したイベントが"発生しない"ことを確認する
   * @param event 対象のイベント
   * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返すと監視が継続される
   * @param timeout イベント発生までの待ち時間
   */
  async assertEventNeverFire<T>(event: TypedEvent<T>, cb: ((a: T) => (boolean)) | null, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const id = setTimeout(() => {
        d.dispose();
        resolve(Date.now());
      }, timeout);
      const d = event.on(a => {
        if (cb !== null && cb(a) === false) return;
        clearTimeout(id);
        d.dispose();
        reject('The event expected not to fire was fired');
      });
    });
  }

  /**
   * 時間内に指定したBanchoResponseが返されることを確認する
   * @param lobby 対象のlobby
   * @param expected 期待されるBanshoResponseの種類
   * @param cb BanchoResponseを評価するためのコールバック関数。falseを返すと監視が継続される
   * @param timeout リジェクトまでのミリ秒時間
   */
  async assertBanchoRespond(lobby: Lobby, expected: BanchoResponseType, cb: ((a: BanchoResponse) => (boolean)) | null, timeout: number = 0): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let id: NodeJS.Timeout;
      if (timeout !== 0) {
        id = setTimeout(() => {
          d.dispose();
          reject('the expected response was not returned.');
        }, timeout);
      }
      const d = lobby.ReceivedBanchoResponse.on(a => {
        if (a.response.type !== expected) return;
        if (cb !== null && cb(a.response) === false) return;
        d.dispose();
        clearTimeout(id);
        resolve(Date.now());
      });
    });
  }

  /**
   * 時間内に指定したBanchoResponseが"返されない"ことを確認する
   * @param lobby 対象のlobby
   * @param expected 期待されるBanshoResponseの種類
   * @param cb BanchoResponseを評価するためのコールバック関数。falseを返すと監視が継続される
   * @param timeout 監視継続ミリ秒時間
   */
  async assertBanchoNotRespond(lobby: Lobby, notExpected: BanchoResponseType, cb: ((a: BanchoResponse) => (boolean)) | null, timeout: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const id = setTimeout(() => {
        d.dispose();
        resolve(Date.now());
      }, timeout);
      const d = lobby.ReceivedBanchoResponse.on(a => {
        if (a.response.type !== notExpected) return;
        if (cb !== null && cb(a.response) === false) return;
        clearTimeout(id);
        d.dispose();
        reject('the response not expected was returned.');
      });
    });
  }

  assertMpSettingsResult(lobby: Lobby, result: MpSettingsResult) {
    assert.equal(lobby.players.size, result.players.length);
    for (const r of result.players) {
      const p = lobby.GetPlayer(r.name);
      if (p === null) {
        assert.fail();
        return;
      }
      assert.isTrue(lobby.players.has(p));
      assert.isTrue(p.is(Roles.Player));
      assert.equal(p.isHost, r.isHost);
    }
  }
}

const instance = new TestUtils();
export default instance;

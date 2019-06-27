import { assert } from 'chai';
import { DummyLobby } from './DummyLobby';
import { LobbyStatus } from '../ILobby';

export function DummyLobbyTest() {
  it("make lobby test", async () => {
    const lobby = new DummyLobby();
    const name = "test";
    const id = await lobby.MakeLobbyAsync(name);
    assert.equal(lobby.id, id);
    assert.equal(lobby.name, name);
    assert.equal(lobby.status, LobbyStatus.Entered);
  });

  it("make lobby network error test", async () => {
    const lobby = new DummyLobby();
    lobby.networkFailureFlag = true;
    try {
      await lobby.MakeLobbyAsync("test");
      assert.fail();
    } catch (e) {
      console.log(e);
    }
  });

  it("change host test", (done) => {
    const lobby = new DummyLobby();
    const userid = "testuser";

    lobby.on("HostChanged", (uid: string) => {
      assert.equal(uid, userid);
      done();
    });

    lobby.MakeLobbyAsync("test").then(() => {
      lobby.SendMpHost(userid);
    });
  });

  it("change host serial test", (done) => {
    const lobby = new DummyLobby();
    const len = 10;
    const users: string[] = [];
    const users_check: { [index: string]: boolean } = {};
    for (let i = 0; i < len; i++) {
      users[i] = "user_" + i;
      users_check[users[i]] = false;
    }

    let count = 0;
    lobby.on("HostChanged", (uid: string) => {
      assert.isTrue(uid in users_check);
      users_check[uid] = true;
      count++;
      if (count < users.length) {
        lobby.SendMpHost(users[count]);
      } else {
        assert.isTrue(users.every(u => users_check[u]));
        done();
      }
    });

    lobby.MakeLobbyAsync("test").then(() => {
      lobby.SendMpHost(users[0]);
    });
  });
}; 
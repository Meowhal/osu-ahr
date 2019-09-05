import { assert } from 'chai';
import fs from "fs";
import Nedb from 'nedb';

import { Recorder } from "../plugins";
import tu from "./TestUtils";
import { Lobby } from '../Lobby';
import { DummyIrcClient } from '../dummies';

const DB_PATHS: { [key: string]: string } = {
  test: "data/test.nedb",
  player: "data/test_player.nedb",
  map: "data/test_map.nedb"
}

function deleteDbfiles() {
  for (let k in DB_PATHS) {
    const p = DB_PATHS[k];
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
}

async function setupAsync(inMemory: boolean = false): Promise<{ recorder: Recorder, lobby: Lobby, ircClient: DummyIrcClient }> {
  const { lobby, ircClient } = await tu.SetupLobbyAsync();
  let option;
  if (inMemory) {
    option = {
      path_player: "",
      path_map: "",
    }
  } else {
    option = {
      path_player: DB_PATHS.player,
      path_map: DB_PATHS.map,
    }
  }

  const recorder = new Recorder(lobby, false, option);
  return { recorder, lobby, ircClient };
}

describe.skip("Recorder tests", function () {
  before(function () {
    tu.configMochaAsSilent();
    deleteDbfiles();
  });
  describe("nedb test", () => {
    it("not found test", () => {
      const db = new Nedb();
      db.loadDatabase(err => {
        db.insert([{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }]);
        db.findOne({ a: 1 }, (err: any, doc: { a: number }) => {
          assert.isNull(err);
          assert.isNotNull(doc);
        });
        db.findOne({ a: 0 }, (err: any, doc: { a: number } | null) => {
          assert.isNull(err);
          assert.isNull(doc);
        });
      });
    });
    it("update test", () => {
      const db = new Nedb(DB_PATHS.test);
      db.loadDatabase(err => {
        db.insert([{ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 3, b: 1 }, { a: 4, b: 1 }]);
        db.findOne({ a: 1 }, (err: any, doc: any) => {
          doc.b = 100;
          db.update({ _id: doc._id }, doc);
          db.findOne({ a: 1 }, (err: any, doc: any) => {
            assert.isNull(err);
            assert.isNotNull(doc);
            assert.equal(doc.b, 100);
          });
        });
      });
    });
  });

  describe("setup tests", function () {
    beforeEach(deleteDbfiles);
    it("constructor file test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync(false);
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));
    });
    it("constructor inmemory test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync(true);
      await recorder.LoadDatabaseAsync();
      assert.isFalse(fs.existsSync(DB_PATHS.map));
    });
  });

  describe("recording tests", function () {
    it("join and left test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync(false);
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));

      const players = await tu.AddPlayersAsync(5, ircClient);

      await tu.delayAsync(10);

      for (let p of players) {
        await ircClient.emulateRemovePlayerAsync(p);
      }

      await tu.delayAsync(10);

      const pd = recorder.db.player;
      await new Promise(resolve => {
        pd.findOne({ eid: "p0" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.playCount, 0);
          resolve();
        })
      });
    });

    it("select map and match test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync(false);
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));

      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.delayAsync(10);
      await tu.changeHostAsync(players[0], lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateMatchAsync(0);

      for (let p of players) {
        await ircClient.emulateRemovePlayerAsync(p);
      }

      await tu.delayAsync(10);

      const pd = recorder.db.player;
      const md = recorder.db.map;

      await Promise.all(
        [
          new Promise(resolve => {
            pd.findOne({ eid: "p0" }, (err: any, doc: any) => {
              assert.isNull(err);
              assert.isNotNull(doc);
              assert.equal(doc.playCount, 1);
              resolve();
            })
          }),
          new Promise(resolve => {
            md.findOne({}, (err: any, doc: any) => {
              assert.isNull(err);
              assert.isNotNull(doc);
              assert.equal(doc.mapId, lobby.mapId);
              resolve();
            })
          }),
        ]
      );
    });
  });
});
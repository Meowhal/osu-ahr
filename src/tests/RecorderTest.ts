import { assert } from 'chai';
import { Lobby } from '..';
import { Recorder, RecorderOption } from "../plugins";
import { DummyIrcClient } from '../dummies';
import fs from "fs";
import Nedb from 'nedb';
import tu from "./TestUtils";

const DB_PATHS: { [key: string]: string } = {
  test: "data/test/db.nedb",
  player: "data/test/player.nedb",
  map: "data/test/map.nedb",
  player_v1: "data/test/player_v1.nedb",
  player_v2: "data/test/player_v2.nedb"
}

function deleteDbfiles() {
  for (let k in DB_PATHS) {
    const p = DB_PATHS[k];
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
}

async function setupAsync(option: Partial<RecorderOption> = {}): Promise<{ recorder: Recorder, lobby: Lobby, ircClient: DummyIrcClient }> {
  const { lobby, ircClient } = await tu.SetupLobbyAsync();
  let defaultOption = {
    path_player: DB_PATHS.player,
    path_map: DB_PATHS.map,
  };

  option = { ...defaultOption, ...option } as RecorderOption;

  const recorder = new Recorder(lobby, false, option);
  return { recorder, lobby, ircClient };
}


describe("Recorder tests", function () {
  before(function () {
    tu.configMochaAsSilent();
    deleteDbfiles();
  });
  describe.skip("nedb test", () => {
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
      const { recorder, lobby, ircClient } = await setupAsync();
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));
    });
    it("constructor inmemory test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync({ path_map: "", path_player: "" });
      await recorder.LoadDatabaseAsync();
      assert.isFalse(fs.existsSync(DB_PATHS.map));
    });
  });

  describe("recording tests", function () {
    it("join and left test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync();
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));
      const players = await tu.AddPlayersAsync(5, ircClient);
      await recorder.task;
      for (let p of players) {
        await ircClient.emulateRemovePlayerAsync(p);
      }
      await recorder.task;
      const pd = recorder.db.player;
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p0" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.playCount, 0);
          assert.equal(doc.visitCount, 1);
          resolve();
        })
      });
    });

    it("select map and match test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync();
      await recorder.LoadDatabaseAsync();
      assert.isTrue(fs.existsSync(DB_PATHS.map));

      const players = await tu.AddPlayersAsync(5, ircClient);
      await recorder.task;
      await tu.changeHostAsync(players[0], lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateMatchAsync(0);

      for (let p of players) {
        await ircClient.emulateRemovePlayerAsync(p);
      }
      await recorder.task;
      const pd = recorder.db.player;
      const md = recorder.db.map;

      await Promise.all(
        [
          new Promise<void>(resolve => {
            pd.findOne({ escaped_name: "p0" }, (err: any, doc: any) => {
              assert.isNull(err);
              assert.isNotNull(doc);
              assert.equal(doc.playCount, 1);
              assert.equal(doc.visitCount, 2);
              resolve();
            })
          }),
          new Promise<void>(resolve => {
            md.findOne({ mapId: { $exists: true } }, (err: any, doc: any) => {
              assert.isNull(err);
              assert.isNotNull(doc);
              assert.equal(doc.mapId, lobby.mapId);
              resolve();
            })
          }),
        ]
      );
    });

    it("disconnect test", async () => {
      const { recorder, lobby, ircClient } = await setupAsync();
      await recorder.LoadDatabaseAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await recorder.task;
      ircClient.raisePart(ircClient.channel, "");
      await recorder.task;
      const pd = recorder.db.player;
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p0" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.visitCount, 3);
          resolve();
        })
      });
    });

    it("PlayerDB Loading test", async () => {
      const srcFile = "src/tests/cases/player_v2.nedb";
      const dstFile = DB_PATHS.player_v2;
      fs.copyFileSync(srcFile, dstFile);
      const { recorder, lobby, ircClient } = await setupAsync({ path_player: dstFile });
      await recorder.LoadDatabaseAsync();
      const pd = recorder.db.player;
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p1" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.visitCount, 1);
          assert.equal(doc.playCount, 1);
          resolve();
        })
      });
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p2" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.visitCount, 5);
          assert.equal(doc.playCount, 2);
          resolve();
        })
      });
    });
  });

  describe("migration tests", function () {
    it("player from v1 to v2", async () => {
      const srcFile = "src/tests/cases/player_v1.nedb";
      const dstFile = DB_PATHS.player_v1;
      fs.copyFileSync(srcFile, dstFile);
      const { recorder, lobby, ircClient } = await setupAsync({ path_player: dstFile });
      await recorder.LoadDatabaseAsync();
      const pd = recorder.db.player;
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p1" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.visitCount, 1);
          assert.equal(doc.playCount, 1);
          resolve();
        })
      });
      await new Promise<void>(resolve => {
        pd.findOne({ escaped_name: "p2" }, (err: any, doc: any) => {
          assert.isNull(err);
          assert.isNotNull(doc);
          assert.equal(doc.visitCount, 5);
          assert.equal(doc.playCount, 2);
          resolve();
        })
      });
    });
  });
});
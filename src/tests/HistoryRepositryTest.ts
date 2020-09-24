import { assert } from 'chai';
import { DummyHistoryFecher } from "../dummies/DummyHistoryFetcher";

describe.only("History repositry Tests", () => {
  describe("dummy fetcher test", () => {
    it("simple fetch test", async () => {
      const d = new DummyHistoryFecher(1);
      let h1 = await d.fetchHistory(5, null, null);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.users[0].id, 1);
      assert.equal(h1.users[0].username, "user1");

      assert.equal(h1.events[0].id, 0);
      assert.equal(h1.events[1].id, 1);

      d.addEvent("player-joined", 2); // event 2
      d.addEvent("player-joined", 3); // event 3
      d.addEvent("player-joined", 4); // event 4

      let h2 = await d.fetchHistory(10, null, null, 0);
      assert.equal(h2.events.length, 5);
      assert.equal(h2.events[0].id, 0);
      assert.equal(h2.events[1].id, 1);
      assert.equal(h2.users.length, 4);
      assert.equal(h2.users[1].username, "user2");
    });
    it("before test", async () => {
      const d = new DummyHistoryFecher(1);
      d.addEvent("player-joined", 2); // event 2
      d.addEvent("player-joined", 3); // event 3
      d.addEvent("player-joined", 4); // event 4

      let h1 = await d.fetchHistory(10, 2, null, 0);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.events[0].id, 0);

      let h2 = await d.fetchHistory(1, 3, null, 0);
      assert.equal(h2.events.length, 1);
      assert.equal(h2.events[0].id, 2);
    });
    it("impolite before test", async () => {
      const d = new DummyHistoryFecher(1);
      d.addEvent("player-joined", 2); // event 2
      d.addEvent("player-joined", 3); // event 3
      d.addEvent("player-joined", 4); // event 4

      let h1 = await d.fetchHistory(-10, 2, null, 0);
      assert.equal(h1.events.length, 1);
      assert.equal(h1.events[0].id, 1);

      let h2 = await d.fetchHistory(10, 100, null, 0);
      assert.equal(h2.events.length, 5);
      assert.equal(h2.events[0].id, 0);

      let h3 = await d.fetchHistory(10, -100, null, 0);
      assert.equal(h3.events.length, 0);
    });
    it("after test", async () => {
      const d = new DummyHistoryFecher(1);
      d.addEvent("player-joined", 2); // event 2
      d.addEvent("player-joined", 3); // event 3
      d.addEvent("player-joined", 4); // event 4

      let h1 = await d.fetchHistory(10, null, 2, 0);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.events[0].id, 3);

      let h2 = await d.fetchHistory(1, null, 3, 0);
      assert.equal(h2.events.length, 1);
      assert.equal(h2.events[0].id, 4);
    });
    it("impolite after test", async () => {
      const d = new DummyHistoryFecher(1);
      d.addEvent("player-joined", 2); // event 2
      d.addEvent("player-joined", 3); // event 3
      d.addEvent("player-joined", 4); // event 4

      let h1 = await d.fetchHistory(-10, null, 2, 0);
      assert.equal(h1.events.length, 1);
      assert.equal(h1.events[0].id, 3);

      let h2 = await d.fetchHistory(2, null, 100, 0);
      assert.equal(h2.events.length, 0);

      let h3 = await d.fetchHistory(2, null, -100, 0);
      assert.equal(h3.events.length, 2);
      assert.equal(h3.events[0].id, 0);
    });
    it("add game test", async () => {
      const d = new DummyHistoryFecher(1);
      for (let i = 0; i < 5; i++) {
        d.addEvent("player-joined", i + 2);
      }
      assert.equal(d.users.length, 6);
      assert.equal(d.events.length, 7);

      d.addGameEvent([1, 2, 3]);
      assert.equal(d.users.length, 6);
      assert.equal(d.events.length, 8);
      const ge = d.events[7];
      assert.equal(ge.detail.type, "other");
      assert.equal(ge.game.scores[0].user_id, 1);
    });
  })

});
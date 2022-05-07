import { assert } from 'chai';
import { DummyHistoryFecher as DummyHistoryFetcher } from '../dummies/DummyHistoryFetcher';
import { HistoryRepository } from '../webapi/HistoryRepository';
import { EventType } from '../webapi/HistoryTypes';
import tu from './TestUtils';

describe('History repositry Tests', () => {
  before(function () {
    tu.configMochaAsSilent();
  });
  describe('dummy fetcher test', () => {
    it('simple fetch test', async () => {
      const d = new DummyHistoryFetcher(1);
      const h1 = await d.fetchHistory(5, null, null);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.users[0].id, 1);
      assert.equal(h1.users[0].username, 'user1');

      assert.equal(h1.events[0].id, 0);
      assert.equal(h1.events[1].id, 1);

      d.addEvent('player-joined', 2); // event 2
      d.addEvent('player-joined', 3); // event 3
      d.addEvent('player-joined', 4); // event 4

      const h2 = await d.fetchHistory(10, null, null, 0);
      assert.equal(h2.events.length, 5);
      assert.equal(h2.events[0].id, 0);
      assert.equal(h2.events[1].id, 1);
      assert.equal(h2.users.length, 4);
      assert.equal(h2.users[1].username, 'user2');
    });
    it('before test', async () => {
      const d = new DummyHistoryFetcher(1);
      d.addEvent('player-joined', 2); // event 2
      d.addEvent('player-joined', 3); // event 3
      d.addEvent('player-joined', 4); // event 4

      const h1 = await d.fetchHistory(10, 2, null, 0);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.events[0].id, 0);

      const h2 = await d.fetchHistory(1, 3, null, 0);
      assert.equal(h2.events.length, 1);
      assert.equal(h2.events[0].id, 2);
    });
    it('impolite before test', async () => {
      const d = new DummyHistoryFetcher(1);
      d.addEvent('player-joined', 2); // event 2
      d.addEvent('player-joined', 3); // event 3
      d.addEvent('player-joined', 4); // event 4

      const h1 = await d.fetchHistory(-10, 2, null, 0);
      assert.equal(h1.events.length, 1);
      assert.equal(h1.events[0].id, 1);

      const h2 = await d.fetchHistory(10, 100, null, 0);
      assert.equal(h2.events.length, 5);
      assert.equal(h2.events[0].id, 0);

      const h3 = await d.fetchHistory(10, -100, null, 0);
      assert.equal(h3.events.length, 0);

      const h4 = await d.fetchHistory(2, 100, null, 0);
      assert.equal(h4.events.length, 2);
      assert.equal(h4.events[0].id, 3);

      const h5 = await d.fetchHistory(2, -100, null, 0);
      assert.equal(h5.events.length, 0);
    });
    it('after test', async () => {
      const d = new DummyHistoryFetcher(1);
      d.addEvent('player-joined', 2); // event 2
      d.addEvent('player-joined', 3); // event 3
      d.addEvent('player-joined', 4); // event 4

      const h1 = await d.fetchHistory(10, null, 2, 0);
      assert.equal(h1.events.length, 2);
      assert.equal(h1.events[0].id, 3);

      const h2 = await d.fetchHistory(1, null, 3, 0);
      assert.equal(h2.events.length, 1);
      assert.equal(h2.events[0].id, 4);
    });
    it('impolite after test', async () => {
      const d = new DummyHistoryFetcher(1);
      d.addEvent('player-joined', 2); // event 2
      d.addEvent('player-joined', 3); // event 3
      d.addEvent('player-joined', 4); // event 4

      const h1 = await d.fetchHistory(-10, null, 2, 0);
      assert.equal(h1.events.length, 1);
      assert.equal(h1.events[0].id, 3);

      const h2 = await d.fetchHistory(2, null, 100, 0);
      assert.equal(h2.events.length, 0);

      const h3 = await d.fetchHistory(2, null, -100, 0);
      assert.equal(h3.events.length, 2);
      assert.equal(h3.events[0].id, 0);

      const h4 = await d.fetchHistory(100, null, 100, 0);
      assert.equal(h4.events.length, 0);

      const h5 = await d.fetchHistory(100, null, -100, 0);
      assert.equal(h5.events.length, 5);
      assert.equal(h5.events[0].id, 0);
    });
    it('add game test', async () => {
      const d = new DummyHistoryFetcher(1);
      for (let i = 0; i < 5; i++) {
        d.addEvent('player-joined', i + 2);
      }
      assert.equal(d.users.length, 6);
      assert.equal(d.events.length, 7);

      d.addGameEvent([1, 2, 3]);
      assert.equal(d.users.length, 6);
      assert.equal(d.events.length, 8);
      const ge = d.events[7];
      assert.equal(ge.detail.type, 'other');
      assert.equal(ge.game?.scores[0].user_id, 1);
    });
  });

  function buildJoinEventFetcher(count: number): DummyHistoryFetcher {
    const df = new DummyHistoryFetcher(1);
    for (let i = 2; i < count; i++) {
      df.addEvent('player-joined', i);
    }
    return df;
  }

  describe('HistoryRepository tests with dummyfetcher', () => {
    before(() => {
      HistoryRepository.COOL_TIME = 0;
    });
    it('basic updateToLatest test', async () => {
      const df = buildJoinEventFetcher(16);
      const hr = new HistoryRepository(1, df);
      await hr.updateToLatest();
      assert.isTrue(1 in hr.users);
      assert.equal(hr.users[1].id, 1);
      assert.isTrue(15 in hr.users);
      assert.isFalse(16 in hr.users);
      assert.equal(hr.events.length, 16);
      assert.equal<EventType>(hr.events[0].detail.type, 'match-created');
      assert.equal<EventType>(hr.events[15].detail.type, 'player-joined');
      assert.equal(hr.events[15].user_id, 15);
    });

    it('size limited updateToLatest test', async () => {
      const df = buildJoinEventFetcher(16);
      df.limit = 3;
      const hr = new HistoryRepository(1, df);
      await hr.updateToLatest();
      assert.equal(hr.events.length, 3);
      assert.equal<EventType>(hr.events[0].detail.type, 'player-joined');
      assert.equal(hr.events[0].id, 13);
      assert.equal<EventType>(hr.events[1].detail.type, 'player-joined');
      assert.equal(hr.events[1].id, 14);
      assert.equal<EventType>(hr.events[2].detail.type, 'player-joined');
      assert.equal(hr.events[2].id, 15);
      assert.equal<EventType>(hr.events[2].detail.type, 'player-joined');

      for (let i = 0; i < 16; i++) {
        df.addEvent('host-changed', i);
      }
      await hr.updateToLatest();
      assert.equal(hr.events.length, 19);
      assert.equal<EventType>(hr.events[18].detail.type, 'host-changed');
      assert.equal(hr.events[18].id, 31);
      assert.equal(hr.latestEventId, 31);
    });
    it('fetch test', async () => {
      const df = buildJoinEventFetcher(16);
      df.limit = 3;
      const hr = new HistoryRepository(1, df);
      const r = await hr.fetch();
      assert.equal(r.count, 3);
      assert.equal(r.filled, true);
      assert.equal(r.isRewind, false);
      assert.equal(hr.events.length, 3);
      assert.equal(hr.events[0].id, 13);
    });
    it('rewind fetch test', async () => {
      const df = buildJoinEventFetcher(16);
      df.limit = 3;
      const hr = new HistoryRepository(1, df);
      let r = await hr.fetch(true);
      assert.equal(r.count, 3);
      assert.equal(r.filled, false);
      assert.equal(r.isRewind, true);
      assert.equal(hr.events.length, 3);
      assert.equal(hr.events[0].id, 13);

      r = await hr.fetch(true);
      assert.equal(r.count, 3);
      assert.equal(r.filled, false);
      assert.equal(r.isRewind, true);
      assert.equal(hr.events.length, 6);
      assert.equal(hr.events[0].id, 10);
    });
    it('back and go test', async () => {
      const df = buildJoinEventFetcher(16);
      df.limit = 3;
      const hr = new HistoryRepository(1, df);
      let r = await hr.fetch(true);
      assert.equal(r.count, 3);
      assert.equal(r.filled, false);
      assert.equal(r.isRewind, true);
      assert.equal(hr.events.length, 3);
      assert.equal(hr.events[0].id, 13);

      r = await hr.fetch(false);
      assert.equal(r.count, 0);
      assert.equal(r.filled, true);
      assert.equal(r.isRewind, false);
      assert.equal(hr.events.length, 3);
      assert.equal(hr.events[0].id, 13);
    });

    it('basic order test', async () => {
      const df = buildJoinEventFetcher(16);
      const hr = new HistoryRepository(1, df);
      const o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    });
    it('basic host-change order test', async () => {
      const df = new DummyHistoryFetcher(1);
      df.addEvent('player-joined', 2);
      df.addEvent('player-joined', 3);
      df.addEvent('player-joined', 4);
      df.addEvent('player-joined', 5);
      df.addEvent('player-left', 3);
      df.addEvent('player-left', 5);
      const hr = new HistoryRepository(1, df);
      let o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [1, 2, 4]);
      df.addEvent('host-changed', 2);
      o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [2, 4, 1]);
    });
    it('host-change order test', async () => {
      const df = new DummyHistoryFetcher(1);
      df.addEvent('player-joined', 2);
      df.addEvent('player-joined', 3);
      df.addEvent('host-changed', 2);
      df.addEvent('player-joined', 4);
      df.addEvent('host-changed', 3);
      const hr = new HistoryRepository(1, df);
      let o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [3, 1, 4, 2]);
      df.addEvent('host-changed', 4);
      o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [4, 1, 2, 3]);
      df.addEvent('player-joined', 5);
      df.addEvent('host-changed', 5);
      o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [5, 1, 2, 3, 4]);
    });
    it('player-left order test', async () => {
      const df = new DummyHistoryFetcher(1);
      df.addEvent('player-joined', 2);
      df.addEvent('player-joined', 3);
      df.addEvent('player-joined', 4);
      df.addEvent('player-joined', 5);
      df.addEvent('player-left', 3);
      df.addEvent('player-left', 5);
      df.addEvent('host-changed', 2);
      df.addEvent('player-joined', 6);
      df.addEvent('player-joined', 5); // rejoin 5
      const hr = new HistoryRepository(1, df);
      const o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [2, 4, 1, 6, 5]);
    });

    it('lots of event order test', async () => {
      const df = new DummyHistoryFetcher(1);
      const hr = new HistoryRepository(1, df);
      for (let i = 2; i < 500; i++) {
        df.addEvent('player-joined', i);
        df.addEvent('player-left', i);
      }
      const o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [1]);
      assert.isAbove(hr.events.length, 300);
    });
    it('lots of event and game test 1', async () => {
      const df = new DummyHistoryFetcher(1);
      const hr = new HistoryRepository(1, df);
      for (let i = 2; i < 500; i++) {
        df.addEvent('player-joined', i);
        df.addEvent('player-left', i);
      }
      df.addGameEvent([1]);
      const o = await hr.calcCurrentOrderAsID();
      assert.sameOrderedMembers(o, [1]);
      assert.isAbove(hr.events.length, 300);
    });
    it('lots of event and game test 2', async () => {
      const df = new DummyHistoryFetcher(1);
      for (let i = 2; i < 500; i++) {
        df.addEvent('player-joined', i);
        df.addEvent('player-left', i);
      }
      df.addEvent('player-joined', 2);
      df.addEvent('player-joined', 3);
      df.addEvent('player-joined', 4);
      df.addEvent('player-left', 1);
      for (let i = 0; i < HistoryRepository.ESC_CRITERIA - 1; i++) {
        const hr = new HistoryRepository(1, df);
        df.addGameEvent([2, 3, 4]);
        const o = await hr.calcCurrentOrderAsID();
        assert.sameOrderedMembers(o, [2, 3, 4]);
        assert.isAbove(hr.events.length, 300);
      }
      {
        const hr = new HistoryRepository(1, df);
        df.addGameEvent([2, 3, 4]);
        const o = await hr.calcCurrentOrderAsID();
        assert.sameOrderedMembers(o, [2, 3, 4]);
        assert.isBelow(hr.events.length, 300);
      }
    });
    it('gotUserProfile event test', async () => {
      const df = buildJoinEventFetcher(16);
      const hr = new HistoryRepository(1, df);
      let count = 0;
      const t = tu.assertEventFire(hr.gotUserProfile, (e) => {
        count++;
        return count === 15;
      }, 100);
      await hr.updateToLatest();
      await t;
    });
    it('changedLobbyName event test', async () => {
      const df = buildJoinEventFetcher(16);
      const hr = new HistoryRepository(1, df);
      let a = 0; // aが0の間はイベント発生しない
      let b = 0; // 終了時にbが1でなければいけない
      hr.changedLobbyName.on(e => {
        switch (a) {
          case 0:
            assert.fail();
            break;
          case 1:
            b++;
            assert.equal(e.newName, 'newname 1');
            assert.equal(e.oldName, hr.matchInfo?.name);
            break;
          case 2:
            assert.fail();
            break;
          case 3:
            b++;
            assert.equal(e.newName, 'newname 2');
            assert.equal(e.oldName, 'newname 1');
            break;
        }
      });

      df.addGameEvent([1, 2, 3]);
      await hr.updateToLatest();
      a = 1;
      df.addGameEvent([1, 2, 3], 'newname 1');
      await hr.updateToLatest();
      assert.equal(b, 1);
      a = 2;
      df.addGameEvent([1, 2, 3], 'newname 1');
      await hr.updateToLatest();
      a = 3;
      df.addGameEvent([1, 2, 3], 'newname 2');
      await hr.updateToLatest();
      assert.equal(b, 2);
    });
  });

});

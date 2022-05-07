import { assert } from 'chai';
import Sinon from 'sinon';
import { Lobby } from '../Lobby';
import { Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { Mod, ScoreMode, TeamMode } from '../Modes';
import { LobbyKeeper, LobbyKeeperOption, SlotKeeper } from '../plugins/LobbyKeeper';
import tu from './TestUtils';

describe('LobbyKeepserTest', function () {

  before(function () {
    tu.configMochaAsSilent();
  });

  after(function () {
    Sinon.restore();
  });

  async function setupAsync(option?: Partial<LobbyKeeperOption>):
    Promise<{ keeper: LobbyKeeper, lobby: Lobby, ircClient: DummyIrcClient }> {
    option = {
      mode: null,
      hostkick_tolerance: 4,
      mods: null,
      password: null,
      size: 0,
      title: null, ...option
    };
    const li = await tu.SetupLobbyAsync();
    const keeper = new LobbyKeeper(li.lobby, option);
    await tu.AddPlayersAsync(['p1', 'p2', 'p3'], li.ircClient);
    return { keeper, ...li };
  }

  describe('SlotKeeper tests', () => {
    let clock: Sinon.SinonFakeTimers | undefined;
    before(function () {
      clock = Sinon.useFakeTimers();
    });

    after(function () {
      clock?.restore();
    });
    describe('size 4 test', () => {

      it('size over test', () => {
        const sk = new SlotKeeper(4);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        assert.isTrue(sk.checkJoin(5));
      });

      it('locked slot test', () => {
        const sk = new SlotKeeper(4);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isTrue(sk.checkJoin(4));
      });

      it('leave slot test', () => {
        const sk = new SlotKeeper(4);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));

        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkLeave(1));
        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkLeave(3));
        assert.isFalse(sk.checkLeave(4));
        assert.isFalse(sk.checkJoin(1));
      });

      it('move slot test', () => {
        const sk = new SlotKeeper(4);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkMove(1, 4));
        assert.isFalse(sk.checkJoin(1));

        assert.isTrue(sk.checkMove(1, 5));
      });

      it('move slot test', () => {
        const sk = new SlotKeeper(4);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkMove(1, 4));
        assert.isFalse(sk.checkJoin(1));

        assert.isTrue(sk.checkMove(1, 5));
      });

      it('check unused slot test', () => {
        const sk = new SlotKeeper(4);

        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkUnused());

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
        assert.isFalse(sk.checkUnused());

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
        assert.isTrue(sk.checkUnused());
      });
    });

    describe('size 0 tests', () => {
      it('size over test', () => {
        const sk = new SlotKeeper(0);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        assert.isFalse(sk.checkJoin(5));
      });

      it('locked slot test', () => {
        const sk = new SlotKeeper(0);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(4));
      });

      it('leave slot test', () => {
        const sk = new SlotKeeper(0);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));

        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkLeave(1));
        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkLeave(3));
        assert.isFalse(sk.checkLeave(4));
        assert.isFalse(sk.checkJoin(1));
      });

      it('move slot test', () => {
        const sk = new SlotKeeper(0);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkMove(1, 4));
        assert.isFalse(sk.checkJoin(1));

        assert.isFalse(sk.checkMove(1, 5));
      });

      it('move slot test', () => {
        const sk = new SlotKeeper(0);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));

        assert.isFalse(sk.checkMove(1, 4));
        assert.isFalse(sk.checkJoin(1));

        assert.isFalse(sk.checkMove(1, 5));
      });

      it('check unused slot test', () => {
        const sk = new SlotKeeper(0);

        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkUnused());

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
        assert.isFalse(sk.checkUnused());

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
        assert.isFalse(sk.checkUnused());
      });

    });
  });

  describe('option tests', () => {
    it('null option check', async () => {
      const { keeper } = await setupAsync({
        mode: null,
        hostkick_tolerance: 4,
        mods: null,
        password: null,
        size: 0,
        title: null
      });

      assert.isNull(keeper.option.mode);
      assert.isNull(keeper.option.mods);
      assert.isNull(keeper.option.password);
      assert.equal(keeper.option.size, 0);
      assert.isNull(keeper.option.title);
    });

    it('mode option check', async () => {
      const { keeper } = await setupAsync({
        mode: null,
      });

      assert.isNull(keeper.option.mode);

      keeper.option.mode = undefined as any;
      keeper.convertOptions();
      assert.isNull(keeper.option.mode);


      keeper.option.mode = { team: 1, score: 1 } as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagCoop, score: ScoreMode.Accuracy });

      keeper.option.mode = { team: 'Head To Head', score: 'Combo' } as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.Combo });

      keeper.option.mode = { team: 'tagcoop', score: 'scorev2' } as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagCoop, score: ScoreMode.ScoreV2 });

      keeper.option.mode = '1 1' as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagCoop, score: ScoreMode.Accuracy });

      keeper.option.mode = 'TagTeamVs ScoreV2' as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagTeamVs, score: ScoreMode.ScoreV2 });

      keeper.option.mode = 'Head To Head, Score V2' as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.ScoreV2 });

      keeper.option.mode = 'Head To Head' as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.Score });

      keeper.option.mode = 'ScoreV2' as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.ScoreV2 });

    });

    it('invalid mode option check', async () => {
      const { keeper } = await setupAsync({
        mode: null,
      });

      assert.isNull(keeper.option.mode);
      keeper.option.mode = 'test' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.mode = { aaa: 12, team: 'aaaa' } as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.mode = [1, 2] as any;
      assert.throw(() => keeper.convertOptions());
    });

    it('mods option check', async () => {
      const { keeper } = await setupAsync({
        mods: null,
      });

      assert.isNull(keeper.option.mods);

      keeper.option.mods = undefined as any;
      keeper.convertOptions();
      assert.isNull(keeper.option.mods);

      keeper.option.mods = 'None' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = '' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = 'freemod' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = 'HD' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden]);

      keeper.option.mods = 'HD, Dt' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = 'Hidden, DoubleTime' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = 'HD   Dt' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = 'Freemod doubleTime Hidden' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.DoubleTime]);

      keeper.option.mods = 'Freemod relax relax2' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = 'relax relax2' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Relax]);

      keeper.option.mods = '[hd, hr]' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.HardRock]);

      keeper.option.mods = [] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = [Mod.None] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = [Mod.Freemod] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = [Mod.Freemod, Mod.HardRock, Mod.Relax, Mod.Nightcore] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.DoubleTime, Mod.Nightcore]);

      keeper.option.mods = [] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = ['None'] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = ['Freemod'] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = ['Freemod', 'HardRock', 'Relax', 'Nightcore'] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.DoubleTime, Mod.Nightcore]);
    });

    it('invalid mods option check', async () => {
      const { keeper } = await setupAsync({
        mods: null,
      });

      assert.isNull(keeper.option.mods);

      keeper.option.mods = 'aaaaaa' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = 'aaaaaa, bbbbbb, sdsfs' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = 'aaaaaa bbbbbb sdsfs' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = 'aaaaaa bbbbbb sdsfs hidden sdf' as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden]);

      keeper.option.mods = ['adfs', '23fsd', 'Relax', 'xxxxxfds'] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Relax]);

    });

    it('size option check', async () => {
      const { keeper } = await setupAsync({
        size: 0,
      });

      assert.equal(keeper.option.size, 0);

      keeper.option.size = undefined as any;
      keeper.convertOptions();
      assert.equal(keeper.option.size, 0);

      keeper.option.size = 0 as any;
      keeper.convertOptions();
      assert.equal(keeper.option.size, 0);

      keeper.option.size = 8 as any;
      keeper.convertOptions();
      assert.equal(keeper.option.size, 8);

      keeper.option.size = 16 as any;
      keeper.convertOptions();
      assert.equal(keeper.option.size, 16);
    });

    it('invalid size option check', async () => {
      const { keeper } = await setupAsync({
        size: 0,
      });

      keeper.option.size = 1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = -1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = '1000' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = '-1000' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = 'aaaaa' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = 'NaN' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = new Date() as any;
      assert.throw(() => keeper.convertOptions());
    });

    it('password option check', async () => {
      const { keeper } = await setupAsync({
        password: null,
      });

      keeper.option.size = 1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = -1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = '1000' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = '-1000' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = 'aaaaa' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = 'NaN' as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = new Date() as any;
      assert.throw(() => keeper.convertOptions());
    });
  });

  describe('chat command tests', () => {
    it('command test : mode', async () => {
      const { keeper, lobby, ircClient } = await setupAsync({
        mode: null
      });

      const defaultOpton = { team: TeamMode.HeadToHead, score: ScoreMode.Score };

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 0 1');
      let mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.HeadToHead);
      assert.equal(mode?.score, ScoreMode.Accuracy);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 1'); // specify only team
      mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.TagCoop);
      assert.equal(mode?.score, ScoreMode.Score); // Inherit previous value

      keeper.option.mode.score = ScoreMode.Accuracy;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 1');// specify only team
      mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.TagCoop);
      assert.equal(mode?.score, ScoreMode.Accuracy); // Inherit previous value

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode combo'); // specify only score
      mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.HeadToHead);
      assert.equal(mode?.score, ScoreMode.Combo);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode head to head, accuracy'); // with space and comma
      mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.HeadToHead);
      assert.equal(mode?.score, ScoreMode.Accuracy);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode tag coop'); // team only, space
      mode = keeper.option.mode;
      assert.notEqual(mode, defaultOpton);
      assert.equal(mode?.team, TeamMode.TagCoop);
      assert.equal(mode?.score, ScoreMode.Score);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode null');
      assert.isNull(keeper.option.mode);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep mode');
      assert.isNull(keeper.option.mode);

    });

    it('invalid command test : mode', async () => {
      const { keeper, lobby, ircClient } = await setupAsync({
        mode: null
      });

      const defaultOpton = { team: TeamMode.HeadToHead, score: ScoreMode.Score };

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode'); // no param
      assert.equal(keeper.option.mode, defaultOpton);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode aaaaa');
      assert.equal(keeper.option.mode, defaultOpton);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 100 400 500');
      assert.equal(keeper.option.mode, defaultOpton);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 112');
      assert.equal(keeper.option.mode, defaultOpton);

      keeper.option.mode = defaultOpton;
      ircClient.emulateMessage('p1', ircClient.channel, '*keepheadtohead'); // team only, witoutspace
      assert.equal(keeper.option.mode, defaultOpton);
    });

    it('command test : size', async () => {
      const defaultSize = 100;
      const { keeper, lobby, ircClient } = await setupAsync({
        size: 4,
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size 0');
      const size = keeper.option.size;
      assert.isDefined(size);
      assert.equal(size, 0);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size 1');
      assert.equal(keeper.option.size, 1);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size 16');
      assert.equal(keeper.option.size, 16);


      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep size');
      assert.equal(keeper.option.size, 0);
    });

    it('invalid command test : size', async () => {
      const defaultSize = 100;
      const { keeper, lobby, ircClient } = await setupAsync({
        size: 4,
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size aaaa');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size12213 1');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size -1');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size -100000');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size NaN');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep sizesdfc');
      assert.equal(keeper.option.size, defaultSize);

      keeper.option.size = defaultSize;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep size12');
      assert.equal(keeper.option.size, defaultSize);
    });

    it('command test : mods', async () => {
      const defaultMods = [Mod.None]; // never match command reuslt

      const { keeper, lobby, ircClient } = await setupAsync({
        mods: [],
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mod hidden');
      assert.sameMembers(keeper.option.mods, [Mod.Hidden]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods hidden');
      assert.sameMembers(keeper.option.mods, [Mod.Hidden]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods HD');
      assert.sameMembers(keeper.option.mods, [Mod.Hidden]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods HIDDEN');
      assert.sameMembers(keeper.option.mods, [Mod.Hidden]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods None');
      assert.sameMembers(keeper.option.mods, []);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods Freemod');
      assert.sameMembers(keeper.option.mods, [Mod.Freemod]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods freemod hidden double');
      assert.sameMembers(keeper.option.mods, [Mod.Freemod, Mod.DoubleTime]);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep mod');
      assert.isNull(keeper.option.mods);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep mods');
      assert.isNull(keeper.option.mods);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mod null');
      assert.isNull(keeper.option.mods);
    });

    it('invalid command test : mods', async () => {
      const defaultMods = [Mod.None]; // never match command reuslt

      const { keeper, lobby, ircClient } = await setupAsync({
        mods: [],
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mods');
      assert.equal(keeper.option.mods, defaultMods);

      keeper.option.mods = defaultMods;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep mod');
      assert.equal(keeper.option.mods, defaultMods);
    });

    it('command test : password', async () => {
      const defaultPassword = 'aaaaaa';

      const { keeper, lobby, ircClient } = await setupAsync({
        password: null,
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password testtest');
      assert.equal(keeper.option.password, 'testtest');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password test test');
      assert.equal(keeper.option.password, 'test test');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password t e s t');
      assert.equal(keeper.option.password, 't e s t');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password     t e s t    ');
      assert.equal(keeper.option.password, 't e s t');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password');
      assert.equal(keeper.option.password, '');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password   ');
      assert.equal(keeper.option.password, '');
    });

    it('command test : password', async () => {
      const defaultPassword = 'aaaaaa';

      const { keeper, lobby, ircClient } = await setupAsync({
        password: null,
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password testtest');
      assert.equal(keeper.option.password, 'testtest');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password test test');
      assert.equal(keeper.option.password, 'test test');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password t e s t');
      assert.equal(keeper.option.password, 't e s t');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password     t e s t    ');
      assert.equal(keeper.option.password, 't e s t');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password');
      assert.equal(keeper.option.password, '');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep password   ');
      assert.equal(keeper.option.password, '');

      keeper.option.password = defaultPassword;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep password');
      assert.isNull(keeper.option.password);
    });

    it('command test : title', async () => {
      const defaultTitle = 'aaaaaa';

      const { keeper, lobby, ircClient } = await setupAsync({
        password: null,
      });

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title testtest');
      assert.equal(keeper.option.title, 'testtest');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep name testtest');
      assert.equal(keeper.option.title, 'testtest');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title test test');
      assert.equal(keeper.option.title, 'test test');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title t e s t');
      assert.equal(keeper.option.title, 't e s t');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title     t e s t    ');
      assert.equal(keeper.option.title, 't e s t');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title');
      assert.equal(keeper.option.title, '');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*keep title   ');
      assert.equal(keeper.option.title, '');

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep title');
      assert.isNull(keeper.option.title);

      keeper.option.title = defaultTitle;
      ircClient.emulateMessage('p1', ircClient.channel, '*no keep name');
      assert.isNull(keeper.option.title);
    });
  });


  describe('slotkeeper on lobbykeeper tests', () => {
    it('size over test', async () => {
      const { keeper, lobby, ircClient } = await setupAsync({
        size: 4,
      });

      const spy = Sinon.spy(lobby);
      await ircClient.emulateAddPlayerAsync('player4');
    });
  });
});

import { assert } from 'chai';
import Sinon from 'sinon';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { Mod, ScoreMode, TeamMode } from '../Modes';
import { AutoStartTimer, AutoStartTimerOption, LobbyKeeper, LobbyKeeperOption, SlotKeeper } from "../plugins";
import tu from "./TestUtils";

describe.only("LobbyKeepserTest", function () {

  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync(option?: Partial<LobbyKeeperOption>):
    Promise<{ keeper: LobbyKeeper, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const keeper = new LobbyKeeper(li.lobby, option);
    await tu.AddPlayersAsync(["p1", "p2", "p3"], li.ircClient);
    return { keeper, ...li };
  }


  describe("SlotKeeper tests", () => {
    let clock: Sinon.SinonFakeTimers | undefined;
    before(function () {
      clock = Sinon.useFakeTimers();
    });

    after(function () {
      clock?.restore();
    });
    describe("size 4 test", () => {

      it("size over test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        Sinon.assert.notCalled(callback);
        assert.isTrue(sk.checkJoin(5));
        Sinon.assert.calledOnce(callback);
      });

      it("locked slot test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);
        assert.isTrue(sk.checkJoin(4));
        Sinon.assert.calledOnce(callback);
      });

      it("leave slot test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkLeave(1));
        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkLeave(3));
        assert.isFalse(sk.checkLeave(4));
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);
      });

      it("move slot test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 4));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);

        assert.isTrue(sk.checkMove(1, 5));
        Sinon.assert.calledOnce(callback);
      });

      it("move slot test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 4));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);

        assert.isTrue(sk.checkMove(1, 5));
        Sinon.assert.calledOnce(callback);
      });

      it("check unused slot test", () => {
        const sk = new SlotKeeper(4);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);

        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkUnused());
        Sinon.assert.notCalled(callback);

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
        assert.isFalse(sk.checkUnused());
        Sinon.assert.notCalled(callback);

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
        assert.isTrue(sk.checkUnused());
        Sinon.assert.calledOnce(callback);
      });
    });

    describe("size 0 tests", () => {
      it("size over test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(5));
        Sinon.assert.notCalled(callback);
      });

      it("locked slot test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(4));
        Sinon.assert.notCalled(callback);
      });

      it("leave slot test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkJoin(3));
        assert.isFalse(sk.checkJoin(4));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkLeave(1));
        assert.isFalse(sk.checkLeave(2));
        assert.isFalse(sk.checkLeave(3));
        assert.isFalse(sk.checkLeave(4));
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);
      });

      it("move slot test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 4));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 5));
        Sinon.assert.notCalled(callback);
      });

      it("move slot test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);
        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 4));
        Sinon.assert.notCalled(callback);
        assert.isFalse(sk.checkJoin(1));
        Sinon.assert.notCalled(callback);

        assert.isFalse(sk.checkMove(1, 5));
        Sinon.assert.notCalled(callback);
      });

      it("check unused slot test", () => {
        const sk = new SlotKeeper(0);
        const callback = Sinon.spy();
        sk.detectedSlotsChange.on(callback);

        assert.isFalse(sk.checkJoin(1));
        assert.isFalse(sk.checkJoin(2));
        assert.isFalse(sk.checkUnused());
        Sinon.assert.notCalled(callback);

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
        assert.isFalse(sk.checkUnused());
        Sinon.assert.notCalled(callback);

        clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
        assert.isFalse(sk.checkUnused());
        Sinon.assert.notCalled(callback);
      });

    })
  });

  describe("option tests", () => {
    it("null option check", async () => {
      const { keeper } = await setupAsync({
        mode: null,
        hostkick_tolerance: 4,
        mods: null,
        password: null,
        size: null,
        title: null
      });

      assert.isNull(keeper.option.mode);
      assert.isNull(keeper.option.mods);
      assert.isNull(keeper.option.password);
      assert.equal(keeper.option.size, 0);
      assert.isNull(keeper.option.title);
    });

    it("mode option check", async () => {
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

      keeper.option.mode = { team: "Head To Head", score: "Combo" } as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.Combo });

      keeper.option.mode = { team: "tagcoop", score: "scorev2" } as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagCoop, score: ScoreMode.ScoreV2 });

      keeper.option.mode = "1 1" as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagCoop, score: ScoreMode.Accuracy });

      keeper.option.mode = "TagTeamVs ScoreV2" as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.TagTeamVs, score: ScoreMode.ScoreV2 });

      keeper.option.mode = "Head To Head, Score V2" as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.ScoreV2 });

      keeper.option.mode = "Head To Head" as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.Score });

      keeper.option.mode = "ScoreV2" as any;
      keeper.convertOptions();
      assert.deepEqual(keeper.option.mode, { team: TeamMode.HeadToHead, score: ScoreMode.ScoreV2 });

    });

    it("invalid mode option check", async () => {
      const { keeper } = await setupAsync({
        mode: null,
      });

      assert.isNull(keeper.option.mode);
      keeper.option.mode = "test" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.mode = { aaa: 12, team: "aaaa" } as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.mode = [1, 2] as any;
      assert.throw(() => keeper.convertOptions());
    });

    it("mods option check", async () => {
      const { keeper } = await setupAsync({
        mods: null,
      });

      assert.isNull(keeper.option.mods);

      keeper.option.mods = undefined as any;
      keeper.convertOptions();
      assert.isNull(keeper.option.mods);

      keeper.option.mods = "None" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = "" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = "freemod" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = "HD" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden]);

      keeper.option.mods = "HD, Dt" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = "Hidden, DoubleTime" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = "HD   Dt" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden, Mod.DoubleTime]);

      keeper.option.mods = "Freemod doubleTime Hidden" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.DoubleTime]);

      keeper.option.mods = "Freemod relax relax2" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = "relax relax2" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Relax]);

      keeper.option.mods = "[hd, hr]" as any;
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
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.Nightcore]);

      keeper.option.mods = [] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = ["None"] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = ["Freemod"] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod]);

      keeper.option.mods = ["Freemod", "HardRock", "Relax", "Nightcore"] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Freemod, Mod.Nightcore]);
    });

    it("invalid mods option check", async () => {
      const { keeper } = await setupAsync({
        mods: null,
      });

      assert.isNull(keeper.option.mods);

      keeper.option.mods = "aaaaaa" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = "aaaaaa, bbbbbb, sdsfs" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = "aaaaaa bbbbbb sdsfs" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, []);

      keeper.option.mods = "aaaaaa bbbbbb sdsfs hidden sdf" as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Hidden]);

      keeper.option.mods = ["adfs", "23fsd", "Relax", "xxxxxfds"] as any;
      keeper.convertOptions();
      assert.sameMembers(keeper.option.mods as any, [Mod.Relax]);

    });

    it("size option check", async () => {
      const { keeper } = await setupAsync({
        size: null,
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

    it("invalid size option check", async () => {
      const { keeper } = await setupAsync({
        size: null,
      });

      keeper.option.size = 1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = -1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "1000" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "-1000" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "aaaaa" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "NaN" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = new Date() as any;
      assert.throw(() => keeper.convertOptions());
    });

    it("password option check", async () => {
      const { keeper } = await setupAsync({
        password: null,
      });

      keeper.option.size = 1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = -1000 as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "1000" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "-1000" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "aaaaa" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = "NaN" as any;
      assert.throw(() => keeper.convertOptions());

      keeper.option.size = new Date() as any;
      assert.throw(() => keeper.convertOptions());
    });
  });

});
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const Player_1 = require("../Player");
const Modes_1 = require("../Modes");
const LobbyKeeper_1 = require("../plugins/LobbyKeeper");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('LobbyKeepserTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    after(function () {
        sinon_1.default.restore();
    });
    async function setupAsync(option) {
        option = {
            mode: null,
            hostkick_tolerance: 4,
            mods: null,
            password: null,
            size: 0,
            title: null, ...option
        };
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const keeper = new LobbyKeeper_1.LobbyKeeper(li.lobby, option);
        await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], li.ircClient);
        return { keeper, ...li };
    }
    describe('SlotKeeper tests', () => {
        let clock;
        before(function () {
            clock = sinon_1.default.useFakeTimers();
        });
        after(function () {
            clock?.restore();
        });
        describe('size 4 test', () => {
            it('size over test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkJoin(3));
                chai_1.assert.isFalse(sk.checkJoin(4));
                chai_1.assert.isTrue(sk.checkJoin(5));
            });
            it('locked slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isTrue(sk.checkJoin(4));
            });
            it('leave slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkJoin(3));
                chai_1.assert.isFalse(sk.checkJoin(4));
                chai_1.assert.isFalse(sk.checkLeave(2));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkLeave(1));
                chai_1.assert.isFalse(sk.checkLeave(2));
                chai_1.assert.isFalse(sk.checkLeave(3));
                chai_1.assert.isFalse(sk.checkLeave(4));
                chai_1.assert.isFalse(sk.checkJoin(1));
            });
            it('move slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkMove(1, 4));
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isTrue(sk.checkMove(1, 5));
            });
            it('move slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkMove(1, 4));
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isTrue(sk.checkMove(1, 5));
            });
            it('check unused slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(4);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkUnused());
                clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
                chai_1.assert.isFalse(sk.checkUnused());
                clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
                chai_1.assert.isTrue(sk.checkUnused());
            });
        });
        describe('size 0 tests', () => {
            it('size over test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkJoin(3));
                chai_1.assert.isFalse(sk.checkJoin(4));
                chai_1.assert.isFalse(sk.checkJoin(5));
            });
            it('locked slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkJoin(4));
            });
            it('leave slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkJoin(3));
                chai_1.assert.isFalse(sk.checkJoin(4));
                chai_1.assert.isFalse(sk.checkLeave(2));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkLeave(1));
                chai_1.assert.isFalse(sk.checkLeave(2));
                chai_1.assert.isFalse(sk.checkLeave(3));
                chai_1.assert.isFalse(sk.checkLeave(4));
                chai_1.assert.isFalse(sk.checkJoin(1));
            });
            it('move slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkMove(1, 4));
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkMove(1, 5));
            });
            it('move slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkMove(1, 4));
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkMove(1, 5));
            });
            it('check unused slot test', () => {
                const sk = new LobbyKeeper_1.SlotKeeper(0);
                chai_1.assert.isFalse(sk.checkJoin(1));
                chai_1.assert.isFalse(sk.checkJoin(2));
                chai_1.assert.isFalse(sk.checkUnused());
                clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2);
                chai_1.assert.isFalse(sk.checkUnused());
                clock?.tick(sk.timeToConsiderAsLockedSlotMS / 2 + 10);
                chai_1.assert.isFalse(sk.checkUnused());
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
            chai_1.assert.isNull(keeper.option.mode);
            chai_1.assert.isNull(keeper.option.mods);
            chai_1.assert.isNull(keeper.option.password);
            chai_1.assert.equal(keeper.option.size, 0);
            chai_1.assert.isNull(keeper.option.title);
        });
        it('mode option check', async () => {
            const { keeper } = await setupAsync({
                mode: null,
            });
            chai_1.assert.isNull(keeper.option.mode);
            keeper.option.mode = undefined;
            keeper.convertOptions();
            chai_1.assert.isNull(keeper.option.mode);
            keeper.option.mode = { team: 1, score: 1 };
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.TagCoop, score: Modes_1.ScoreMode.Accuracy });
            keeper.option.mode = { team: 'Head To Head', score: 'Combo' };
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.Combo });
            keeper.option.mode = { team: 'tagcoop', score: 'scorev2' };
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.TagCoop, score: Modes_1.ScoreMode.ScoreV2 });
            keeper.option.mode = '1 1';
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.TagCoop, score: Modes_1.ScoreMode.Accuracy });
            keeper.option.mode = 'TagTeamVs ScoreV2';
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.TagTeamVs, score: Modes_1.ScoreMode.ScoreV2 });
            keeper.option.mode = 'Head To Head, Score V2';
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.ScoreV2 });
            keeper.option.mode = 'Head To Head';
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.Score });
            keeper.option.mode = 'ScoreV2';
            keeper.convertOptions();
            chai_1.assert.deepEqual(keeper.option.mode, { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.ScoreV2 });
        });
        it('invalid mode option check', async () => {
            const { keeper } = await setupAsync({
                mode: null,
            });
            chai_1.assert.isNull(keeper.option.mode);
            keeper.option.mode = 'test';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.mode = { aaa: 12, team: 'aaaa' };
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.mode = [1, 2];
            chai_1.assert.throw(() => keeper.convertOptions());
        });
        it('mods option check', async () => {
            const { keeper } = await setupAsync({
                mods: null,
            });
            chai_1.assert.isNull(keeper.option.mods);
            keeper.option.mods = undefined;
            keeper.convertOptions();
            chai_1.assert.isNull(keeper.option.mods);
            keeper.option.mods = 'None';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = '';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = 'freemod';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod]);
            keeper.option.mods = 'HD';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = 'HD, Dt';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden, Modes_1.Mod.DoubleTime]);
            keeper.option.mods = 'Hidden, DoubleTime';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden, Modes_1.Mod.DoubleTime]);
            keeper.option.mods = 'HD   Dt';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden, Modes_1.Mod.DoubleTime]);
            keeper.option.mods = 'Freemod doubleTime Hidden';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod, Modes_1.Mod.DoubleTime]);
            keeper.option.mods = 'Freemod relax relax2';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod]);
            keeper.option.mods = 'relax relax2';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Relax]);
            keeper.option.mods = '[hd, hr]';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden, Modes_1.Mod.HardRock]);
            keeper.option.mods = [];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = [Modes_1.Mod.None];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = [Modes_1.Mod.Freemod];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod]);
            keeper.option.mods = [Modes_1.Mod.Freemod, Modes_1.Mod.HardRock, Modes_1.Mod.Relax, Modes_1.Mod.Nightcore];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod, Modes_1.Mod.DoubleTime, Modes_1.Mod.Nightcore]);
            keeper.option.mods = [];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = ['None'];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = ['Freemod'];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod]);
            keeper.option.mods = ['Freemod', 'HardRock', 'Relax', 'Nightcore'];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod, Modes_1.Mod.DoubleTime, Modes_1.Mod.Nightcore]);
        });
        it('invalid mods option check', async () => {
            const { keeper } = await setupAsync({
                mods: null,
            });
            chai_1.assert.isNull(keeper.option.mods);
            keeper.option.mods = 'aaaaaa';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = 'aaaaaa, bbbbbb, sdsfs';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = 'aaaaaa bbbbbb sdsfs';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = 'aaaaaa bbbbbb sdsfs hidden sdf';
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = ['adfs', '23fsd', 'Relax', 'xxxxxfds'];
            keeper.convertOptions();
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Relax]);
        });
        it('size option check', async () => {
            const { keeper } = await setupAsync({
                size: 0,
            });
            chai_1.assert.equal(keeper.option.size, 0);
            keeper.option.size = undefined;
            keeper.convertOptions();
            chai_1.assert.equal(keeper.option.size, 0);
            keeper.option.size = 0;
            keeper.convertOptions();
            chai_1.assert.equal(keeper.option.size, 0);
            keeper.option.size = 8;
            keeper.convertOptions();
            chai_1.assert.equal(keeper.option.size, 8);
            keeper.option.size = 16;
            keeper.convertOptions();
            chai_1.assert.equal(keeper.option.size, 16);
        });
        it('invalid size option check', async () => {
            const { keeper } = await setupAsync({
                size: 0,
            });
            keeper.option.size = 1000;
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = -1000;
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = '1000';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = '-1000';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = 'aaaaa';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = 'NaN';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = new Date();
            chai_1.assert.throw(() => keeper.convertOptions());
        });
        it('password option check', async () => {
            const { keeper } = await setupAsync({
                password: null,
            });
            keeper.option.size = 1000;
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = -1000;
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = '1000';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = '-1000';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = 'aaaaa';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = 'NaN';
            chai_1.assert.throw(() => keeper.convertOptions());
            keeper.option.size = new Date();
            chai_1.assert.throw(() => keeper.convertOptions());
        });
    });
    describe('chat command tests', () => {
        it('command test : mode', async () => {
            const { keeper, lobby, ircClient } = await setupAsync({
                mode: null
            });
            const defaultOpton = { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.Score };
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 0 1');
            let mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.HeadToHead);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Accuracy);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 1'); // specify only team
            mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.TagCoop);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Score); // Inherit previous value
            keeper.option.mode.score = Modes_1.ScoreMode.Accuracy;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 1'); // specify only team
            mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.TagCoop);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Accuracy); // Inherit previous value
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode combo'); // specify only score
            mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.HeadToHead);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Combo);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode head to head, accuracy'); // with space and comma
            mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.HeadToHead);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Accuracy);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode tag coop'); // team only, space
            mode = keeper.option.mode;
            chai_1.assert.notEqual(mode, defaultOpton);
            chai_1.assert.equal(mode?.team, Modes_1.TeamMode.TagCoop);
            chai_1.assert.equal(mode?.score, Modes_1.ScoreMode.Score);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode null');
            chai_1.assert.isNull(keeper.option.mode);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep mode');
            chai_1.assert.isNull(keeper.option.mode);
        });
        it('invalid command test : mode', async () => {
            const { keeper, lobby, ircClient } = await setupAsync({
                mode: null
            });
            const defaultOpton = { team: Modes_1.TeamMode.HeadToHead, score: Modes_1.ScoreMode.Score };
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode'); // no param
            chai_1.assert.equal(keeper.option.mode, defaultOpton);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode aaaaa');
            chai_1.assert.equal(keeper.option.mode, defaultOpton);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 100 400 500');
            chai_1.assert.equal(keeper.option.mode, defaultOpton);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mode 112');
            chai_1.assert.equal(keeper.option.mode, defaultOpton);
            keeper.option.mode = defaultOpton;
            ircClient.emulateMessage('p1', ircClient.channel, '*keepheadtohead'); // team only, witoutspace
            chai_1.assert.equal(keeper.option.mode, defaultOpton);
        });
        it('command test : size', async () => {
            const defaultSize = 100;
            const { keeper, lobby, ircClient } = await setupAsync({
                size: 4,
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size 0');
            const size = keeper.option.size;
            chai_1.assert.isDefined(size);
            chai_1.assert.equal(size, 0);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size 1');
            chai_1.assert.equal(keeper.option.size, 1);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size 16');
            chai_1.assert.equal(keeper.option.size, 16);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep size');
            chai_1.assert.equal(keeper.option.size, 0);
        });
        it('invalid command test : size', async () => {
            const defaultSize = 100;
            const { keeper, lobby, ircClient } = await setupAsync({
                size: 4,
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size aaaa');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size12213 1');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size -1');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size -100000');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size NaN');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep sizesdfc');
            chai_1.assert.equal(keeper.option.size, defaultSize);
            keeper.option.size = defaultSize;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep size12');
            chai_1.assert.equal(keeper.option.size, defaultSize);
        });
        it('command test : mods', async () => {
            const defaultMods = [Modes_1.Mod.None]; // never match command reuslt
            const { keeper, lobby, ircClient } = await setupAsync({
                mods: [],
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mod hidden');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods hidden');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods HD');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods HIDDEN');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Hidden]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods None');
            chai_1.assert.sameMembers(keeper.option.mods, []);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods Freemod');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods freemod hidden double');
            chai_1.assert.sameMembers(keeper.option.mods, [Modes_1.Mod.Freemod, Modes_1.Mod.DoubleTime]);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep mod');
            chai_1.assert.isNull(keeper.option.mods);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep mods');
            chai_1.assert.isNull(keeper.option.mods);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mod null');
            chai_1.assert.isNull(keeper.option.mods);
        });
        it('invalid command test : mods', async () => {
            const defaultMods = [Modes_1.Mod.None]; // never match command reuslt
            const { keeper, lobby, ircClient } = await setupAsync({
                mods: [],
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mods');
            chai_1.assert.equal(keeper.option.mods, defaultMods);
            keeper.option.mods = defaultMods;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep mod');
            chai_1.assert.equal(keeper.option.mods, defaultMods);
        });
        it('command test : password', async () => {
            const defaultPassword = 'aaaaaa';
            const { keeper, lobby, ircClient } = await setupAsync({
                password: null,
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password testtest');
            chai_1.assert.equal(keeper.option.password, 'testtest');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password test test');
            chai_1.assert.equal(keeper.option.password, 'test test');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password t e s t');
            chai_1.assert.equal(keeper.option.password, 't e s t');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password     t e s t    ');
            chai_1.assert.equal(keeper.option.password, 't e s t');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password');
            chai_1.assert.equal(keeper.option.password, '');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password   ');
            chai_1.assert.equal(keeper.option.password, '');
        });
        it('command test : password', async () => {
            const defaultPassword = 'aaaaaa';
            const { keeper, lobby, ircClient } = await setupAsync({
                password: null,
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password testtest');
            chai_1.assert.equal(keeper.option.password, 'testtest');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password test test');
            chai_1.assert.equal(keeper.option.password, 'test test');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password t e s t');
            chai_1.assert.equal(keeper.option.password, 't e s t');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password     t e s t    ');
            chai_1.assert.equal(keeper.option.password, 't e s t');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password');
            chai_1.assert.equal(keeper.option.password, '');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep password   ');
            chai_1.assert.equal(keeper.option.password, '');
            keeper.option.password = defaultPassword;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep password');
            chai_1.assert.isNull(keeper.option.password);
        });
        it('command test : title', async () => {
            const defaultTitle = 'aaaaaa';
            const { keeper, lobby, ircClient } = await setupAsync({
                password: null,
            });
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title testtest');
            chai_1.assert.equal(keeper.option.title, 'testtest');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep name testtest');
            chai_1.assert.equal(keeper.option.title, 'testtest');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title test test');
            chai_1.assert.equal(keeper.option.title, 'test test');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title t e s t');
            chai_1.assert.equal(keeper.option.title, 't e s t');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title     t e s t    ');
            chai_1.assert.equal(keeper.option.title, 't e s t');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title');
            chai_1.assert.equal(keeper.option.title, '');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*keep title   ');
            chai_1.assert.equal(keeper.option.title, '');
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep title');
            chai_1.assert.isNull(keeper.option.title);
            keeper.option.title = defaultTitle;
            ircClient.emulateMessage('p1', ircClient.channel, '*no keep name');
            chai_1.assert.isNull(keeper.option.title);
        });
    });
    describe('slotkeeper on lobbykeeper tests', () => {
        it('size over test', async () => {
            const { keeper, lobby, ircClient } = await setupAsync({
                size: 4,
            });
            const spy = sinon_1.default.spy(lobby);
            await ircClient.emulateAddPlayerAsync('player4');
        });
    });
});
//# sourceMappingURL=LobbyKeeperTest.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const WordCounter_1 = require("../plugins/WordCounter");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('WordCounter Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function setup(periods = [{ symbol: 'a', duration_ms: 1000 }]) {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const option = {
            periods: periods
        };
        const counter = new WordCounter_1.WordCounter(li.lobby, option);
        return { counter, ...li };
    }
    function assertPeriod(period, cpp, cppm, wpp, wppm) {
        chai_1.assert.equal(period.chatsPerPeriod, cpp, 'chat / p');
        chai_1.assert.equal(period.chatsPerPeriodMax, cppm, 'chat max / p');
        chai_1.assert.equal(period.wordsPerPeriod, wpp, 'word / p');
        chai_1.assert.equal(period.wordsPerPeriodMax, wppm, 'word max / p');
    }
    describe('single period tests', function () {
        it('info count', async () => {
            const { counter, lobby, ircClient } = await setup();
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!info');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(p.chatsPerPeriod, 1);
            chai_1.assert.equal(p.chatsPerPeriodMax, 1);
            chai_1.assert.isAbove(p.wordsPerPeriod, 1);
            chai_1.assert.isAbove(p.wordsPerPeriodMax, 1);
        });
        it('update test1', async () => {
            const { counter, lobby, ircClient } = await setup();
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            counter.update('hello world!', 0);
            assertPeriod(p, 1, 1, 12, 12);
        });
        it('update test2', async () => {
            const { counter, lobby, ircClient } = await setup();
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            counter.update('hello world!', 0);
            assertPeriod(p, 1, 1, 12, 12);
            counter.update('abcdefg', 1);
            assertPeriod(p, 2, 2, 19, 19);
        });
        it('period test', async () => {
            const { counter, lobby, ircClient } = await setup([{ symbol: 'a', duration_ms: 1 }]);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            counter.update('hello world!', 0);
            assertPeriod(p, 1, 1, 12, 12);
            counter.update('abcdefg', 10);
            assertPeriod(p, 1, 1, 7, 12);
        });
        it('max value test', async () => {
            const { counter, lobby, ircClient } = await setup([{ symbol: 'a', duration_ms: 1 }]);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            counter.update('hello world!', 0);
            assertPeriod(p, 1, 1, 12, 12);
            counter.update('hoge piyo hoge piyo!', 2);
            assertPeriod(p, 1, 1, 20, 20);
            counter.update('Yikes!', 4);
            assertPeriod(p, 1, 1, 6, 20);
        });
        it('border test', async () => {
            const { counter, lobby, ircClient } = await setup([{ symbol: 'a', duration_ms: 10 }]);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            counter.update('hello world!', 10);
            assertPeriod(p, 1, 1, 12, 12);
            counter.update('abcdefg', 21);
            assertPeriod(p, 1, 1, 7, 12);
        });
        it('garbage collection test', async () => {
            const { counter, lobby, ircClient } = await setup([{ symbol: 'a', duration_ms: 10 }]);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            const p = counter.periods[0];
            assertPeriod(p, 0, 0, 0, 0);
            for (let i = 0; i < 100; i++) {
                counter.update('hello world!', 10);
            }
            assertPeriod(p, 100, 100, 1200, 1200);
            chai_1.assert.equal(counter.samples.length, 100);
            counter.update('abcdefg', 100);
            chai_1.assert.equal(counter.samples.length, 1);
            assertPeriod(p, 1, 100, 7, 1200);
        });
    });
    describe('multi periods tests', function () {
        it('period test', async () => {
            const def_periods = [
                { symbol: 'a', duration_ms: 10 },
                { symbol: 'b', duration_ms: 100 }
            ];
            const { counter, lobby, ircClient } = await setup(def_periods);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            chai_1.assert.equal(counter.periods[0].symbol, 'a');
            assertPeriod(counter.periods[0], 0, 0, 0, 0);
            chai_1.assert.equal(counter.periods[1].symbol, 'b');
            assertPeriod(counter.periods[1], 0, 0, 0, 0);
            counter.update('hello world!', 0);
            assertPeriod(counter.periods[0], 1, 1, 12, 12);
            assertPeriod(counter.periods[1], 1, 1, 12, 12);
            counter.update('abcdefg', 30);
            assertPeriod(counter.periods[0], 1, 1, 7, 12);
            assertPeriod(counter.periods[1], 2, 2, 19, 19);
        });
        it('garbage collection test', async () => {
            const def_periods = [
                { symbol: 'a', duration_ms: 10 },
                { symbol: 'b', duration_ms: 100 },
                { symbol: 'c', duration_ms: 1000 }
            ];
            const { counter, lobby, ircClient } = await setup(def_periods);
            const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            chai_1.assert.equal(counter.periods[0].symbol, 'a');
            assertPeriod(counter.periods[0], 0, 0, 0, 0);
            chai_1.assert.equal(counter.periods[1].symbol, 'b');
            assertPeriod(counter.periods[1], 0, 0, 0, 0);
            for (let i = 0; i < 100; i++) {
                counter.update('hello world!', 10);
            }
            assertPeriod(counter.periods[0], 100, 100, 1200, 1200);
            assertPeriod(counter.periods[1], 100, 100, 1200, 1200);
            assertPeriod(counter.periods[2], 100, 100, 1200, 1200);
            chai_1.assert.equal(counter.samples.length, 100);
            counter.update('abcdef', 30);
            assertPeriod(counter.periods[0], 1, 100, 6, 1200);
            assertPeriod(counter.periods[1], 101, 101, 1206, 1206);
            assertPeriod(counter.periods[2], 101, 101, 1206, 1206);
            chai_1.assert.equal(counter.samples.length, 101);
            counter.update('abcdef', 130);
            assertPeriod(counter.periods[0], 1, 100, 6, 1200);
            assertPeriod(counter.periods[1], 2, 101, 12, 1206);
            assertPeriod(counter.periods[2], 102, 102, 1212, 1212);
            chai_1.assert.equal(counter.samples.length, 102);
            counter.update('abcdef', 5000);
            assertPeriod(counter.periods[0], 1, 100, 6, 1200);
            assertPeriod(counter.periods[1], 1, 101, 6, 1206);
            assertPeriod(counter.periods[2], 1, 102, 6, 1212);
            chai_1.assert.equal(counter.samples.length, 1);
        });
    });
    it('no period test', async () => {
        const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
        const option = {
            periods: []
        };
        const counter = new WordCounter_1.WordCounter(lobby, option);
        chai_1.assert.equal(counter.periods.length, 0);
        counter.update('test', Date.now());
    });
});
//# sourceMappingURL=WordCounterTest.js.map
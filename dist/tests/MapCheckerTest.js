"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const FakeBeatmapFetcher_1 = require("../dummies/FakeBeatmapFetcher");
const Modes_1 = require("../Modes");
const MapChecker_1 = require("../plugins/MapChecker");
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('Map Checker Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    afterEach(function () {
        BeatmapRepository_1.BeatmapRepository.maps.clear();
    });
    async function setup(option) {
        const defaultOption = {
            enabled: false,
            star_min: 0,
            star_max: 7.00,
            length_min: 0,
            length_max: 600,
            gamemode: 'osu',
            num_violations_allowed: 3,
            allow_convert: true
        };
        option = { ...defaultOption, ...option };
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const checker = new MapChecker_1.MapChecker(li.lobby, option);
        await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], li.ircClient);
        return { checker, ...li };
    }
    describe('mapchecker option tests', () => {
        it('default option test', async () => {
            const { checker, lobby, ircClient } = await setup();
            chai_1.assert.equal(checker.option.allow_convert, true);
            chai_1.assert.equal(checker.option.enabled, false);
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Osu);
            chai_1.assert.equal(checker.option.length_max, 600);
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.num_violations_allowed, 3);
            chai_1.assert.equal(checker.option.star_max, 7);
            chai_1.assert.equal(checker.option.star_min, 0);
        });
        it('type matched option test', async () => {
            const { checker, lobby, ircClient } = await setup({
                allow_convert: false,
                enabled: true,
                gamemode: Modes_1.PlayMode.OsuMania,
                length_max: 0,
                length_min: 100,
                num_violations_allowed: 1,
                star_max: 0,
                star_min: 3
            });
            chai_1.assert.equal(checker.option.allow_convert, false);
            chai_1.assert.equal(checker.option.enabled, true);
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.OsuMania);
            chai_1.assert.equal(checker.option.length_max, 0);
            chai_1.assert.equal(checker.option.length_min, 100);
            chai_1.assert.equal(checker.option.num_violations_allowed, 1);
            chai_1.assert.equal(checker.option.star_max, 0);
            chai_1.assert.equal(checker.option.star_min, 3);
        });
        it('type mismatched option test', async () => {
            const { checker, lobby, ircClient } = await setup({
                allow_convert: 'false',
                enabled: 1,
                gamemode: 'fruits',
                length_max: '0',
                length_min: '100',
                num_violations_allowed: '1',
                star_max: '0',
                star_min: '3'
            });
            chai_1.assert.equal(checker.option.allow_convert, false);
            chai_1.assert.equal(checker.option.enabled, true);
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.CatchTheBeat);
            chai_1.assert.equal(checker.option.length_max, 0);
            chai_1.assert.equal(checker.option.length_min, 100);
            chai_1.assert.equal(checker.option.num_violations_allowed, 1);
            chai_1.assert.equal(checker.option.star_max, 0);
            chai_1.assert.equal(checker.option.star_min, 3);
        });
        it('conflicted option test', async () => {
            const { checker, lobby, ircClient } = await setup({
                length_max: '20',
                length_min: '50',
                star_max: '3',
                star_min: '5'
            });
            chai_1.assert.equal(checker.option.length_max, 20);
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.star_max, 3);
            chai_1.assert.equal(checker.option.star_min, 0);
        });
        it('no max cap option test (not conflicted)', async () => {
            const { checker, lobby, ircClient } = await setup({
                length_max: '0',
                length_min: '50',
                star_max: '0',
                star_min: '5'
            });
            chai_1.assert.equal(checker.option.length_max, 0);
            chai_1.assert.equal(checker.option.length_min, 50);
            chai_1.assert.equal(checker.option.star_max, 0);
            chai_1.assert.equal(checker.option.star_min, 5);
        });
        it('no min cap option test (not conflicted)', async () => {
            const { checker, lobby, ircClient } = await setup({
                length_max: '50',
                length_min: '0',
                star_max: '5',
                star_min: '0'
            });
            chai_1.assert.equal(checker.option.length_max, 50);
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.star_max, 5);
            chai_1.assert.equal(checker.option.star_min, 0);
        });
        it('abolished option test', async () => {
            const { checker, lobby, ircClient } = await setup({
                allowConvert: false,
                num_violations_to_skip: 10,
            });
            chai_1.assert.equal(checker.option.allow_convert, false);
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
        });
        it('invalid option test : allow_convert', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    allow_convert: 'aaaa'
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : enabled', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    enabled: 'aaaa'
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : gamemode aaaa', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    gamemode: 'aaaa'
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : gamemode dsflkjsd', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    gamemode: 'dsflkjsd'
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : gamemode 123456', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    gamemode: 123456
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : length_max', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    length_max: -1
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : length_min', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    length_min: -1
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : num_violations_allowed', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    num_violations_allowed: -1
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : star_max', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    star_max: -1
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : star_min', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    star_min: -1
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : number NaN', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    star_min: NaN
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
        it('invalid option test : number string', async () => {
            let threw = false;
            try {
                const { checker, lobby, ircClient } = await setup({
                    star_min: 'aaaa'
                });
            }
            catch (e) {
                threw = true;
            }
            chai_1.assert.isTrue(threw);
        });
    });
    describe('owner command tests', () => {
        it('command: enabled ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.enabled = true;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation enabled');
            chai_1.assert.equal(checker.option.enabled, true);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation disabled');
            chai_1.assert.equal(checker.option.enabled, false);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation enable');
            chai_1.assert.equal(checker.option.enabled, true);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation disable');
            chai_1.assert.equal(checker.option.enabled, false);
        });
        it('command: num_violations_allowed ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.num_violations_allowed = 1;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 3');
            chai_1.assert.equal(checker.option.num_violations_allowed, 3);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 10');
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_to_skip 5');
            chai_1.assert.equal(checker.option.num_violations_allowed, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 0');
            chai_1.assert.equal(checker.option.num_violations_allowed, 0);
            checker.option.num_violations_allowed = 10;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed');
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed asf');
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed NaN');
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_to_skip');
            chai_1.assert.equal(checker.option.num_violations_allowed, 10);
        });
        it('command: star_min ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.star_min = 1;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 3');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 0');
            chai_1.assert.equal(checker.option.star_min, 0);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 10');
            chai_1.assert.equal(checker.option.star_min, 10);
            chai_1.assert.equal(checker.option.star_max, 0);
            checker.option.star_min = 1;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation    starmin  5   ');
            chai_1.assert.equal(checker.option.star_min, 5);
            chai_1.assert.equal(checker.option.star_max, 0);
            checker.option.star_min = 1;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation difflow 3');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            checker.option.star_min = 1;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min -3');
            chai_1.assert.equal(checker.option.star_min, 1);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min');
            chai_1.assert.equal(checker.option.star_min, 1);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min   ');
            chai_1.assert.equal(checker.option.star_min, 1);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min a');
            chai_1.assert.equal(checker.option.star_min, 1);
            chai_1.assert.equal(checker.option.star_max, 5);
        });
        it('command: star_max ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.star_min = 3;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 4');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 4);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 0');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 0);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 10');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 2');
            chai_1.assert.equal(checker.option.star_min, 0);
            chai_1.assert.equal(checker.option.star_max, 2);
            checker.option.star_min = 3;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation    starmax  5   ');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation diffupperlimit 3');
            chai_1.assert.equal(checker.option.star_min, 0);
            chai_1.assert.equal(checker.option.star_max, 3);
            checker.option.star_min = 3;
            checker.option.star_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max -3');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max   ');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max a');
            chai_1.assert.equal(checker.option.star_min, 3);
            chai_1.assert.equal(checker.option.star_max, 5);
        });
        it('command: length_min ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.length_min = 1;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 3');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 0');
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 10');
            chai_1.assert.equal(checker.option.length_min, 10);
            chai_1.assert.equal(checker.option.length_max, 0);
            checker.option.length_min = 1;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation    lenmin  5   ');
            chai_1.assert.equal(checker.option.length_min, 5);
            chai_1.assert.equal(checker.option.length_max, 0);
            checker.option.length_min = 1;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation lenlower 3');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            checker.option.length_min = 1;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min -3');
            chai_1.assert.equal(checker.option.length_min, 1);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min');
            chai_1.assert.equal(checker.option.length_min, 1);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min   ');
            chai_1.assert.equal(checker.option.length_min, 1);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min a');
            chai_1.assert.equal(checker.option.length_min, 1);
            chai_1.assert.equal(checker.option.length_max, 5);
        });
        it('command: length_max ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.length_min = 3;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 4');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 4);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 0');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 0);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 10');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 10);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 2');
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.length_max, 2);
            checker.option.length_min = 3;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation    lenmax  5   ');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation lenupperlimit 3');
            chai_1.assert.equal(checker.option.length_min, 0);
            chai_1.assert.equal(checker.option.length_max, 3);
            checker.option.length_min = 3;
            checker.option.length_max = 5;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max -3');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max   ');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max a');
            chai_1.assert.equal(checker.option.length_min, 3);
            chai_1.assert.equal(checker.option.length_max, 5);
        });
        it('command: gamemode ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            let initialValue = Modes_1.PlayMode.OsuMania;
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode osu');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Osu);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode Osu');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Osu);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 0');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Osu);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode taiko');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Taiko);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode TAIKO');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Taiko);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 1');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Taiko);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode CatchTheBeat');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.CatchTheBeat);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode fruits');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.CatchTheBeat);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode catch');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.CatchTheBeat);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 2');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.CatchTheBeat);
            initialValue = Modes_1.PlayMode.Osu;
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode OsuMania');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.OsuMania);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode mania');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.OsuMania);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 3');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.OsuMania);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode');
            chai_1.assert.equal(checker.option.gamemode, initialValue);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode boss');
            chai_1.assert.equal(checker.option.gamemode, initialValue);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode  asfsdf ');
            chai_1.assert.equal(checker.option.gamemode, initialValue);
            checker.option.gamemode = initialValue;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode  * fdssdflk lsdf lksdfl3342r ');
            chai_1.assert.equal(checker.option.gamemode, initialValue);
        });
        it('command: allow_convert ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.allow_convert = false;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert');
            chai_1.assert.equal(checker.option.allow_convert, true);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation disallow_convert');
            chai_1.assert.equal(checker.option.allow_convert, false);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert true');
            chai_1.assert.equal(checker.option.allow_convert, true);
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert false');
            chai_1.assert.equal(checker.option.allow_convert, false);
        });
        it('command  statement ', async () => {
            const { checker, lobby, ircClient } = await setup();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            checker.option.allow_convert = false;
            ircClient.emulateMessage('p1', ircClient.channel, '*regulation starmax=10 starmin=1 maxlen=100 lenmin = 20 gamemode= osu');
            chai_1.assert.equal(checker.option.gamemode, Modes_1.PlayMode.Osu);
            chai_1.assert.equal(checker.option.star_max, 10);
            chai_1.assert.equal(checker.option.star_min, 1);
            chai_1.assert.equal(checker.option.length_max, 100);
            chai_1.assert.equal(checker.option.length_min, 20);
        });
    });
    describe('description tests', () => {
        it('default config', async () => {
            const { checker, lobby, ircClient } = await setup({
                enabled: false,
                star_min: 0,
                star_max: 7.00,
                length_min: 0,
                length_max: 600,
                gamemode: 'osu',
                num_violations_allowed: 3,
                allow_convert: true
            });
            chai_1.assert.equal(checker.getRegulationDescription(), 'Disabled (difficulty <= 7.00, length <= 10:00, mode: osu!)');
        });
        it('config', async () => {
            const { checker, lobby, ircClient } = await setup({
                enabled: true,
                star_min: 0,
                star_max: 0,
                length_min: 0,
                length_max: 0,
                gamemode: 'osu',
                allow_convert: true
            });
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!');
            checker.option.gamemode = Modes_1.PlayMode.Taiko;
            checker.option.allow_convert = true;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!taiko (converts allowed)');
            checker.option.allow_convert = false;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!taiko (converts disallowed)');
            checker.option.gamemode = Modes_1.PlayMode.CatchTheBeat;
            checker.option.allow_convert = true;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!catch (converts allowed)');
            checker.option.allow_convert = false;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!catch (converts disallowed)');
            checker.option.gamemode = Modes_1.PlayMode.OsuMania;
            checker.option.allow_convert = true;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!mania (converts allowed)');
            checker.option.allow_convert = false;
            chai_1.assert.equal(checker.getRegulationDescription(), 'mode: osu!mania (converts disallowed)');
            checker.option.gamemode = Modes_1.PlayMode.Osu;
            checker.option.star_max = 1;
            chai_1.assert.equal(checker.getRegulationDescription(), 'difficulty <= 1.00, mode: osu!');
            checker.option.star_max = 0;
            checker.option.star_min = 1;
            chai_1.assert.equal(checker.getRegulationDescription(), '1.00 <= difficulty, mode: osu!');
            checker.option.star_max = 2;
            checker.option.star_min = 1;
            chai_1.assert.equal(checker.getRegulationDescription(), '1.00 <= difficulty <= 2.00, mode: osu!');
            checker.option.star_max = 0;
            checker.option.star_min = 0;
            checker.option.length_max = 60;
            chai_1.assert.equal(checker.getRegulationDescription(), 'length <= 1:00, mode: osu!');
            checker.option.length_max = 0;
            checker.option.length_min = 90;
            chai_1.assert.equal(checker.getRegulationDescription(), '1:30 <= length, mode: osu!');
            checker.option.length_max = 120;
            checker.option.length_min = 30;
            chai_1.assert.equal(checker.getRegulationDescription(), '0:30 <= length <= 2:00, mode: osu!');
            checker.option.star_max = 2;
            checker.option.star_min = 1;
            checker.option.length_max = 120;
            checker.option.length_min = 30;
            chai_1.assert.equal(checker.getRegulationDescription(), '1.00 <= difficulty <= 2.00, 0:30 <= length <= 2:00, mode: osu!');
            checker.option.enabled = false;
            chai_1.assert.equal(checker.getRegulationDescription(), 'Disabled (1.00 <= difficulty <= 2.00, 0:30 <= length <= 2:00, mode: osu!)');
        });
    });
    describe('regulation check tests', () => {
        const originalFetcher = BeatmapRepository_1.BeatmapRepository.fetcher;
        const fakeFetcher = new FakeBeatmapFetcher_1.FakeBeatmapFetcher();
        before(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = fakeFetcher;
        });
        after(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = originalFetcher;
        });
        it('default settings test', async () => {
            const { checker, lobby, ircClient } = await setup({
                enabled: true
            });
            const mapid = 100;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, mapid);
            chai_1.assert.equal(checker.lastMapId, mapid);
        });
        it('star accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 5,
                star_min: 2,
                length_max: 0,
                length_min: 0,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
        });
        it('star no limit accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 2,
                length_max: 0,
                length_min: 0,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 100, 10);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
        });
        it('star reject test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 5,
                star_min: 2,
                length_max: 0,
                length_min: 0,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5.01);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 100, 1.99);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 0);
        });
        it('length accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 100,
                length_min: 10,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 10, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
        });
        it('length no limit accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 10,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 10, 10);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
        });
        it('length reject test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 5,
                star_min: 2,
                length_max: 100,
                length_min: 10,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 101, 5.);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 9, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 0);
        });
        it('gamemode accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            checker.option.gamemode = Modes_1.PlayMode.Taiko;
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Taiko, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
            checker.option.gamemode = Modes_1.PlayMode.CatchTheBeat;
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.CatchTheBeat, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 102);
            checker.option.gamemode = Modes_1.PlayMode.OsuMania;
            fakeFetcher.setBeatmapProperties(103, 'test', Modes_1.PlayMode.OsuMania, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 103);
            chai_1.assert.equal(checker.lastMapId, 103);
        });
        it('gamemode allow convert accept test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: true,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            checker.option.gamemode = Modes_1.PlayMode.Taiko;
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 101);
            checker.option.gamemode = Modes_1.PlayMode.CatchTheBeat;
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 102);
            checker.option.gamemode = Modes_1.PlayMode.OsuMania;
            fakeFetcher.setBeatmapProperties(103, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 103);
            chai_1.assert.equal(checker.lastMapId, 103);
        });
        it('gamemode disallow convert reject test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 100);
            checker.option.gamemode = Modes_1.PlayMode.Taiko;
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 100);
            checker.option.gamemode = Modes_1.PlayMode.CatchTheBeat;
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 100);
            checker.option.gamemode = Modes_1.PlayMode.OsuMania;
            fakeFetcher.setBeatmapProperties(103, 'test', Modes_1.PlayMode.Osu, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 103);
            chai_1.assert.equal(checker.lastMapId, 100);
        });
        it('gamemode ous reject test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Taiko, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.CatchTheBeat, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.OsuMania, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 0);
        });
        it('gamemode ous reject test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 0,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: true
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Taiko, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.CatchTheBeat, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 0);
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.OsuMania, 100, 2);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 0);
        });
        it('disalbed test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 3,
                star_min: 2,
                length_max: 100,
                length_min: 20,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: false
            });
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Taiko, 100, 15);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 0);
            fakeFetcher.setBeatmapProperties(101, 'test', Modes_1.PlayMode.CatchTheBeat, 1000, 1);
            await ircClient.emulateChangeMapAsync(0, 101);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 0);
            fakeFetcher.setBeatmapProperties(102, 'test', Modes_1.PlayMode.OsuMania, 100, 5);
            await ircClient.emulateChangeMapAsync(0, 102);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 0);
        });
    });
    describe('skip host tests', () => {
        const originalFetcher = BeatmapRepository_1.BeatmapRepository.fetcher;
        const fakeFetcher = new FakeBeatmapFetcher_1.FakeBeatmapFetcher();
        before(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = fakeFetcher;
        });
        after(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = originalFetcher;
        });
        it('num violation test', async () => {
            const { checker, lobby, ircClient } = await setup({
                star_max: 5,
                star_min: 0,
                length_max: 0,
                length_min: 0,
                gamemode: Modes_1.PlayMode.Osu,
                allow_convert: false,
                enabled: true
            });
            await ircClient.emulateChangeHost('p1');
            chai_1.assert.equal(checker.numViolations, 0);
            fakeFetcher.setBeatmapProperties(100, 'test', Modes_1.PlayMode.Osu, 100, 6.55);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 1);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 2);
            await ircClient.emulateChangeMapAsync(0, 100);
            chai_1.assert.equal(checker.lastMapId, 0);
            chai_1.assert.equal(checker.numViolations, 3);
            await ircClient.emulateChangeHost('p2');
            chai_1.assert.equal(checker.numViolations, 0);
        });
    });
});
//# sourceMappingURL=MapCheckerTest.js.map
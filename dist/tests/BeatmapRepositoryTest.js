"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const FakeBeatmapFetcher_1 = require("../dummies/FakeBeatmapFetcher");
const Modes_1 = require("../Modes");
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const WebApiClient_1 = require("../webapi/WebApiClient");
const TestUtils_1 = __importDefault(require("./TestUtils"));
const promises_1 = __importDefault(require("fs/promises"));
describe('BeatmapRepository Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    afterEach(function () {
        BeatmapRepository_1.BeatmapRepository.maps.clear();
    });
    describe.skip('fetch beatmap form osu.ppy.sh tests', () => {
        before(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = BeatmapRepository_1.BeatmapRepository.websiteFetcher;
        });
        it('parse website test', async () => {
            const bufSrc = await promises_1.default.readFile('./src/tests/cases/3182198.html');
            const src = bufSrc.toString();
            const reg = /<script id="json-beatmapset" type="application\/json">\s*(.+?)\s*<\/script>/ms;
            const match = reg.exec(src);
            if (match) {
                console.log(match[1]);
                const json = JSON.parse(match[1]);
                console.log(json);
            }
            else {
                chai_1.assert.fail();
            }
        });
        it('fetch osu map', async () => {
            const mapid = 3182198;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(b.mode, 'osu');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'aquamarine');
        });
        it('fetch invalid map id', async () => {
            const mapid = 737157;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.NotFound);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fetch taiko map', async () => {
            const mapid = 2938202;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'The Old Blood');
        });
        it('fetch fruits map', async () => {
            const mapid = 3175483;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.CatchTheBeat);
            chai_1.assert.equal(b.mode, 'fruits');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'Otter Pop (feat. Hollis)');
        });
        it('fetch mania map', async () => {
            const mapid = 3259543;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.OsuMania);
            chai_1.assert.equal(b.mode, 'mania');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'Hanshoku-ki (Cut Ver.)');
        });
        it('fetch converted taiko map', async () => {
            const mapid = 3182198;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, true);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'aquamarine');
        });
        it('fail to fetch taiko map', async () => {
            const mapid = 3182198;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, false);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fail to fetch osu map', async () => {
            const mapid = 2938202;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Osu);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('cache test', async () => {
            const mapid = 3182198;
            BeatmapRepository_1.BeatmapRepository.maps.clear();
            const b1 = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(BeatmapRepository_1.BeatmapRepository.maps.get(BeatmapRepository_1.BeatmapRepository.genKey(mapid, Modes_1.PlayMode.Osu)), b1);
            const b2 = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(b1, b2);
        });
    });
    describe.skip('fetch beatmap form api tests', () => {
        before(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = WebApiClient_1.WebApiClient;
        });
        after(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = BeatmapRepository_1.BeatmapRepository.websiteFetcher;
        });
        it('fetch osu map', async () => {
            const mapid = 3182198;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(b.mode, 'osu');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'aquamarine');
        });
        it('fetch invalid map id', async () => {
            const mapid = 737157;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.NotFound);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fetch taiko map', async () => {
            const mapid = 2938202;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'The Old Blood');
        });
        it('fetch fruits map', async () => {
            const mapid = 3175483;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.CatchTheBeat);
            chai_1.assert.equal(b.mode, 'fruits');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'Otter Pop (feat. Hollis)');
        });
        it('fetch mania map', async () => {
            const mapid = 3259543;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.OsuMania);
            chai_1.assert.equal(b.mode, 'mania');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'Hanshoku-ki (Cut Ver.)');
        });
        it('fetch converted taiko map', async () => {
            const mapid = 3182198;
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, true);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
            chai_1.assert.equal(b.beatmapset?.title, 'aquamarine');
        });
        it('fail to fetch taiko map', async () => {
            const mapid = 3182198;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, false);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fail to fetch osu map', async () => {
            const mapid = 2938202;
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Osu);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('cache test', async () => {
            const mapid = 3182198;
            BeatmapRepository_1.BeatmapRepository.maps.clear();
            const b1 = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(BeatmapRepository_1.BeatmapRepository.maps.get(BeatmapRepository_1.BeatmapRepository.genKey(mapid, Modes_1.PlayMode.Osu)), b1);
            const b2 = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(b1, b2);
        });
    });
    describe('fetch beatmap form fakes tests', () => {
        const originalFetcher = BeatmapRepository_1.BeatmapRepository.fetcher;
        const fakeFetcher = new FakeBeatmapFetcher_1.FakeBeatmapFetcher();
        before(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = fakeFetcher;
        });
        after(function () {
            BeatmapRepository_1.BeatmapRepository.fetcher = originalFetcher;
        });
        it('fetch osu map', async () => {
            const mapid = 3182198;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Osu, 100, 5);
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid);
            chai_1.assert.equal(b.mode, 'osu');
            chai_1.assert.equal(b.id, mapid);
        });
        it('fetch invalid map id', async () => {
            const mapid = 1000;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Osu, 100, 5);
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(500, Modes_1.PlayMode.Taiko);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.NotFound);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fetch taiko map', async () => {
            const mapid = 2938202;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Taiko, 100, 5);
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, false);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
        });
        it('fetch fruits map', async () => {
            const mapid = 3175483;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.CatchTheBeat, 100, 5);
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.CatchTheBeat, false);
            chai_1.assert.equal(b.mode, 'fruits');
            chai_1.assert.equal(b.id, mapid);
        });
        it('fetch mania map', async () => {
            const mapid = 3259543;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.OsuMania, 100, 5);
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.OsuMania, false);
            chai_1.assert.equal(b.mode, 'mania');
            chai_1.assert.equal(b.id, mapid);
        });
        it('fetch converted taiko map', async () => {
            const mapid = 3182198;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Osu, 100, 5);
            const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, true);
            chai_1.assert.equal(b.mode, 'taiko');
            chai_1.assert.equal(b.id, mapid);
        });
        it('fail to fetch taiko map', async () => {
            const mapid = 3182198;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Osu, 100, 5);
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Taiko, false);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
        it('fail to fetch osu map', async () => {
            const mapid = 2938202;
            fakeFetcher.setBeatmapProperties(mapid, 'test', Modes_1.PlayMode.Taiko, 100, 5);
            try {
                const b = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapid, Modes_1.PlayMode.Osu);
                chai_1.assert.fail();
            }
            catch (e) {
                if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                    chai_1.assert.equal(e.reason, BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched);
                }
                else {
                    chai_1.assert.fail();
                }
            }
        });
    });
});
//# sourceMappingURL=BeatmapRepositoryTest.js.map
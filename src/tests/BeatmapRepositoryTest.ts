import { assert } from 'chai';
import { FakeBeatmapFetcher } from '../dummies/FakeBeatmapFetcher';
import { PlayMode } from '../Modes';
import { BeatmapRepository, FetchBeatmapError, FetchBeatmapErrorReason } from '../webapi/BeatmapRepository';
import { WebApiClient } from '../webapi/WebApiClient';
import tu from './TestUtils';

import fs from 'fs/promises';

describe('BeatmapRepository Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  afterEach(function () {
    BeatmapRepository.maps.clear();
  });

  describe.skip('fetch beatmap form osu.ppy.sh tests', () => {
    before(function () {
      BeatmapRepository.fetcher = BeatmapRepository.websiteFetcher;
    });

    it('parse website test', async () => {
      const bufSrc = await fs.readFile('./src/tests/cases/3182198.html');
      const src = bufSrc.toString();
      const reg = /<script id="json-beatmapset" type="application\/json">\s*(.+?)\s*<\/script>/ms;
      const match = reg.exec(src);
      if (match) {
        console.log(match[1]);
        const json = JSON.parse(match[1]);
        console.log(json);
      } else {
        assert.fail();
      }

    });

    it('fetch osu map', async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b.mode, 'osu');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'aquamarine');
    });

    it('fetch invalid map id', async () => {
      const mapid = 737157;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.NotFound);
        } else {
          assert.fail();
        }
      }
    });

    it('fetch taiko map', async () => {
      const mapid = 2938202;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'The Old Blood');
    });

    it('fetch fruits map', async () => {
      const mapid = 3175483;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.CatchTheBeat);
      assert.equal(b.mode, 'fruits');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'Otter Pop (feat. Hollis)');
    });

    it('fetch mania map', async () => {
      const mapid = 3259543;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.OsuMania);
      assert.equal(b.mode, 'mania');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'Hanshoku-ki (Cut Ver.)');
    });

    it('fetch converted taiko map', async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, true);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'aquamarine');
    });

    it('fail to fetch taiko map', async () => {
      const mapid = 3182198;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, false);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it('fail to fetch osu map', async () => {
      const mapid = 2938202;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Osu);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it('cache test', async () => {
      const mapid = 3182198;
      BeatmapRepository.maps.clear();
      const b1 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(BeatmapRepository.maps.get(BeatmapRepository.genKey(mapid, PlayMode.Osu)), b1);
      const b2 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b1, b2);
    });
  });

  describe.skip('fetch beatmap form api tests', () => {
    before(function () {
      BeatmapRepository.fetcher = WebApiClient;
    });
    after(function () {
      BeatmapRepository.fetcher = BeatmapRepository.websiteFetcher;
    });

    it('fetch osu map', async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b.mode, 'osu');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'aquamarine');
    });

    it('fetch invalid map id', async () => {
      const mapid = 737157;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.NotFound);
        } else {
          assert.fail();
        }
      }
    });

    it('fetch taiko map', async () => {
      const mapid = 2938202;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'The Old Blood');
    });

    it('fetch fruits map', async () => {
      const mapid = 3175483;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.CatchTheBeat);
      assert.equal(b.mode, 'fruits');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'Otter Pop (feat. Hollis)');
    });

    it('fetch mania map', async () => {
      const mapid = 3259543;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.OsuMania);
      assert.equal(b.mode, 'mania');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'Hanshoku-ki (Cut Ver.)');
    });

    it('fetch converted taiko map', async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, true);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
      assert.equal(b.beatmapset?.title, 'aquamarine');
    });

    it('fail to fetch taiko map', async () => {
      const mapid = 3182198;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, false);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it('fail to fetch osu map', async () => {
      const mapid = 2938202;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Osu);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it('cache test', async () => {
      const mapid = 3182198;
      BeatmapRepository.maps.clear();
      const b1 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(BeatmapRepository.maps.get(BeatmapRepository.genKey(mapid, PlayMode.Osu)), b1);
      const b2 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b1, b2);
    });
  });

  describe('fetch beatmap form fakes tests', () => {
    const originalFetcher = BeatmapRepository.fetcher;
    const fakeFetcher = new FakeBeatmapFetcher();
    before(function () {
      BeatmapRepository.fetcher = fakeFetcher;
    });
    after(function () {
      BeatmapRepository.fetcher = originalFetcher;
    });

    it('fetch osu map', async () => {
      const mapid = 3182198;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Osu, 100, 5);
      const b = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b.mode, 'osu');
      assert.equal(b.id, mapid);
    });

    it('fetch invalid map id', async () => {
      const mapid = 1000;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Osu, 100, 5);
      try {
        const b = await BeatmapRepository.getBeatmap(500, PlayMode.Taiko);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.NotFound);
        } else {
          assert.fail();
        }
      }
    });

    it('fetch taiko map', async () => {
      const mapid = 2938202;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Taiko, 100, 5);
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, false);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
    });

    it('fetch fruits map', async () => {
      const mapid = 3175483;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.CatchTheBeat, 100, 5);
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.CatchTheBeat, false);
      assert.equal(b.mode, 'fruits');
      assert.equal(b.id, mapid);
    });

    it('fetch mania map', async () => {
      const mapid = 3259543;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.OsuMania, 100, 5);
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.OsuMania, false);
      assert.equal(b.mode, 'mania');
      assert.equal(b.id, mapid);
    });

    it('fetch converted taiko map', async () => {
      const mapid = 3182198;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Osu, 100, 5);
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, true);
      assert.equal(b.mode, 'taiko');
      assert.equal(b.id, mapid);
    });

    it('fail to fetch taiko map', async () => {
      const mapid = 3182198;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Osu, 100, 5);
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, false);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it('fail to fetch osu map', async () => {
      const mapid = 2938202;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Taiko, 100, 5);
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Osu);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

  });
});

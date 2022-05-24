import axios from 'axios';
import { PlayMode } from '../Modes';
import { Beatmap, Beatmapset as Beatmapset } from './Beatmapsets';
import { WebApiClient } from './WebApiClient';

export type BeatmapCache = Beatmap & { fetchedAt: number };

class BeatmapRepositoryClass {
  maps: Map<string, BeatmapCache>;
  cacheExpiredMs: number;
  fetcher: IBeatmapFetcher;

  websiteFetcher: IBeatmapFetcher;

  constructor() {
    this.maps = new Map();
    this.cacheExpiredMs = 24 * 3600 * 1000;
    this.websiteFetcher = new WebsiteBeatmapFecher();
    if (WebApiClient.available) {
      this.fetcher = WebApiClient;
    } else {
      this.fetcher = this.websiteFetcher;
    }
  }

  /**
     *
     * @param mapId
     * @param mode
     * @param allowConvert
     * @returns
     * @throws FetchBeatmapError
     */
  async getBeatmap(mapId: number, mode: PlayMode = PlayMode.Osu, allowConvert: boolean = true): Promise<BeatmapCache> {
    if (this.fetcher === WebApiClient) {
      if (!WebApiClient.available) {
        this.fetcher = this.websiteFetcher;
      }
    }

    let cache = this.tryGetCache(mapId, mode, allowConvert);
    if (cache) return cache;

    const set = await this.fetcher.getBeatmapset(mapId);
    if (set.availability.download_disabled || set.availability.more_information) {
      throw new FetchBeatmapError(FetchBeatmapErrorReason.NotAvailable);
    }
    this.cacheMaps(set);

    cache = this.tryGetCache(mapId, mode, allowConvert);
    if (cache) return cache;

    throw new FetchBeatmapError(FetchBeatmapErrorReason.PlayModeMismatched);
  }

  tryGetCache(mapId: number, mode: PlayMode = PlayMode.Osu, allowConvert: boolean = true): BeatmapCache | undefined {
    const mapKey = this.genKey(mapId, mode);
    const cache = this.maps.get(mapKey);

    if (cache) {
      if (Date.now() < cache.fetchedAt + this.cacheExpiredMs) {
        if (mode === PlayMode.Osu || allowConvert || !cache.convert) {
          return cache;
        }
      } else {
        this.maps.delete(mapKey);
      }
    }
  }

  cacheMaps(set: Beatmapset) {
    const now = Date.now();
    set.recent_favourites = [];
    for (const map of [...set.beatmaps ?? [], ...set.converts ?? []] as BeatmapCache[]) {
      const key = this.genKey(map.id, map.mode);
      map.fetchedAt = now;
      map.beatmapset = set;
      map.failtimes = { exit: [], fail: [] };
      this.maps.set(key, map);
    }
  }

  discardExpiredCache(expiredMs: number = this.cacheExpiredMs) {
    const now = Date.now();
    for (const [key, cache] of this.maps.entries()) {
      if (now > cache.fetchedAt + expiredMs) {
        this.maps.delete(key);
      }
    }
  }

  genKey(mapid: number, mode: string | PlayMode) {
    if (typeof mode === 'string') {
      mode = PlayMode.from(mode);
    }
    return `${mode.id}.${mapid}`;
  }
}

export enum FetchBeatmapErrorReason {
    NotFound,
    FormatError,
    PlayModeMismatched,
    Unknown,
    NotAvailable
}

export function isFetchBeatmapError(err: any): err is FetchBeatmapError {
  return 'isFetchBeatmapError' in err;
}

export class FetchBeatmapError extends Error {
  isFetchBeatmapError: true = true;
  reason: FetchBeatmapErrorReason;
  constructor(reason: FetchBeatmapErrorReason, message?: string) {
    super(message ?? FetchBeatmapErrorReason[reason]);
    this.reason = reason;
    this.name = 'FetchBeatmapError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchBeatmapError);
    }
  }
}

export interface IBeatmapFetcher {
    getBeatmapset(mapId: number): Promise<Beatmapset>;
}

export class WebsiteBeatmapFecher implements IBeatmapFetcher {

  getBeatmapsets(id: number): Promise<Beatmapset | undefined> {
    return this.fetchBeatmapFromWebsite(id);
  }

  /**
     *
     * @param id
     * @param mode
     * @param allowConvert
     * @returns
     * @throws FetchBeatmapError
     */
  async getBeatmap(id: number, mode: PlayMode = PlayMode.Osu, allowConvert: boolean = false): Promise<Beatmap> {
    const set = await this.fetchBeatmapFromWebsite(id);
    let map = set.beatmaps?.find(v => v.id === id && v.mode_int.toString() === mode.value);
    if (map === undefined && allowConvert) {
      map = set.converts?.find(v => v.id === id && v.mode_int.toString() === mode.value);
    }

    if (!map) {
      throw new FetchBeatmapError(FetchBeatmapErrorReason.PlayModeMismatched);
    }

    map.beatmapset = set;
    set.beatmaps = undefined;
    return map;
  }

  getBeatmapset(mapId: number): Promise<Beatmapset> {
    return this.fetchBeatmapFromWebsite(mapId);
  }

  webpreg = /<script id="json-beatmapset" type="application\/json">\s*(.+?)\s*<\/script>/ms;
  async fetchBeatmapFromWebsite(id: number): Promise<Beatmapset> {
    try {
      const target = `https://osu.ppy.sh/b/${id}`;
      const res = await axios.get(target);
      const match = this.webpreg.exec(res.data);
      if (match) {
        const json = JSON.parse(match[1]);
        return json as Beatmapset;
      }
      throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError);
    } catch (e: any) {
      if (isFetchBeatmapError(e)) {
        throw e;
      }
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 404) {
          throw new FetchBeatmapError(FetchBeatmapErrorReason.NotFound);
        }
        throw new FetchBeatmapError(FetchBeatmapErrorReason.Unknown, e.message);
      }
      throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError, e.message);
    }
  }
}

export const BeatmapRepository = new BeatmapRepositoryClass();

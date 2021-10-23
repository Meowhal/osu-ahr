import axios from "axios";
import cheerio from "cheerio";
import { PlayMode } from "../Modes";
import { Beatmap, Beatmapsets } from "./Beatmapsets";

export type BeatmapCache = Beatmap & { fetchedAt: number, title?: string, title_unicode?: string };

class BeatmapRepositoryClass implements IBeatmapFetcher {
    maps: Map<string, BeatmapCache>;
    cacheExpiredMs: number;
    fetcher: IBeatmapFetcher;

    constructor() {
        this.maps = new Map();
        this.cacheExpiredMs = 24 * 3600 * 1000;
        this.fetcher = new WebsiteBeatmapFecher();
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
        const mapKey = `${mode.name}-${mapId}`;
        const cache = this.maps.get(mapKey);

        if (cache !== undefined) {
            if (Date.now() < cache.fetchedAt + this.cacheExpiredMs) {
                return cache;
            } else {
                this.maps.delete(mapKey);
            }
        }

        let map = await this.fetcher.getBeatmap(mapId, mode, allowConvert);
        let v = {
            ...map,
            fetchedAt: Date.now(),
            title: map.beatmapset?.title,
            title_unicode: map.beatmapset?.title_unicode
        };

        // remove unused datas
        v.beatmapset = undefined;

        this.maps.set(mapKey, v);
        return v;
    }

    discardExpiredCache() {
        const now = Date.now();
        for (const [key, cache] of this.maps.entries()) {
            if (now > cache.fetchedAt + this.cacheExpiredMs) {
                this.maps.delete(key);
            }
        }
    }
}

export enum FetchBeatmapErrorReason {
    NotFound,
    FormatError,
    PlayModeMismatched,
    Unknown,
}

export function isFetchBeatmapError(err: any): err is FetchBeatmapError {
    return "isFetchBeatmapError" in err;
}
export class FetchBeatmapError extends Error {
    isFetchBeatmapError: true = true;
    reason: FetchBeatmapErrorReason;
    constructor(reason: FetchBeatmapErrorReason, message?: string) {
        super(message ?? FetchBeatmapErrorReason[reason]);
        this.reason = reason;
        this.name = "FetchBeatmapError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FetchBeatmapError);
        }
    }
}


export interface IBeatmapFetcher {
    getBeatmap(mapId: number, mode: PlayMode, allowConvert: boolean): Promise<Beatmap>;
}

export class WebsiteBeatmapFecher implements IBeatmapFetcher {

    getBeatmapsets(id: number): Promise<Beatmapsets | undefined> {
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
        let map = set.beatmaps?.find(v => v.id == id && v.mode_int.toString() == mode.value);
        if (map === undefined && allowConvert) {
            map = set.converts?.find(v => v.id == id && v.mode_int.toString() == mode.value);
        }

        if (!map) {
            throw new FetchBeatmapError(FetchBeatmapErrorReason.PlayModeMismatched);
        }

        map.beatmapset = set;
        set.beatmaps = undefined;
        return map;
    }

    async fetchBeatmapFromWebsite(id: number): Promise<Beatmapsets> {
        try {
            const target = "https://osu.ppy.sh/b/" + id;
            const res = await axios.get(target);
            const $ = cheerio.load((res).data);
            const jsonTag = $('#json-beatmapset');
            if (jsonTag.length) {
                const n: any = $('#json-beatmapset')[0].children[0];
                const src = n.data;
                if (src) {
                    const json = JSON.parse(src);
                    return json as Beatmapsets;
                }
            }
            throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError);
        } catch (e: any) {
            if (isFetchBeatmapError(e)) {
                throw e;
            }
            if (axios.isAxiosError(e)) {
                if (e.response?.status == 404) {
                    throw new FetchBeatmapError(FetchBeatmapErrorReason.NotFound);
                }
                throw new FetchBeatmapError(FetchBeatmapErrorReason.Unknown, e.message);
            }
            throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError, e.message);
        }
    }
}



export const BeatmapRepository = new BeatmapRepositoryClass();
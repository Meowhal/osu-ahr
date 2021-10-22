import { PlayMode } from "../Modes";
import { Beatmap, fetchBeatmap } from "./Beatmapsets";

export type BeatmapCache = Beatmap & { fetchedAt: number, title?: string, title_unicode?: string };

class BeatmapRepositoryClass {
    maps: Map<string, BeatmapCache>;
    cacheExpiredMs: number;

    constructor() {
        this.maps = new Map();
        this.cacheExpiredMs = 24 * 3600 * 1000;
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

        let map = await fetchBeatmap(mapId, mode, allowConvert);
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

export const BeatmapRepository = new BeatmapRepositoryClass();
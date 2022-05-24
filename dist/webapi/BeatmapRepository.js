"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeatmapRepository = exports.WebsiteBeatmapFecher = exports.FetchBeatmapError = exports.isFetchBeatmapError = exports.FetchBeatmapErrorReason = void 0;
const axios_1 = __importDefault(require("axios"));
const Modes_1 = require("../Modes");
const WebApiClient_1 = require("./WebApiClient");
class BeatmapRepositoryClass {
    constructor() {
        this.maps = new Map();
        this.cacheExpiredMs = 24 * 3600 * 1000;
        this.websiteFetcher = new WebsiteBeatmapFecher();
        if (WebApiClient_1.WebApiClient.available) {
            this.fetcher = WebApiClient_1.WebApiClient;
        }
        else {
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
    async getBeatmap(mapId, mode = Modes_1.PlayMode.Osu, allowConvert = true) {
        if (this.fetcher === WebApiClient_1.WebApiClient) {
            if (!WebApiClient_1.WebApiClient.available) {
                this.fetcher = this.websiteFetcher;
            }
        }
        let cache = this.tryGetCache(mapId, mode, allowConvert);
        if (cache)
            return cache;
        const set = await this.fetcher.getBeatmapset(mapId);
        if (set.availability.download_disabled || set.availability.more_information) {
            throw new FetchBeatmapError(FetchBeatmapErrorReason.NotAvailable);
        }
        this.cacheMaps(set);
        cache = this.tryGetCache(mapId, mode, allowConvert);
        if (cache)
            return cache;
        throw new FetchBeatmapError(FetchBeatmapErrorReason.PlayModeMismatched);
    }
    tryGetCache(mapId, mode = Modes_1.PlayMode.Osu, allowConvert = true) {
        const mapKey = this.genKey(mapId, mode);
        const cache = this.maps.get(mapKey);
        if (cache) {
            if (Date.now() < cache.fetchedAt + this.cacheExpiredMs) {
                if (mode === Modes_1.PlayMode.Osu || allowConvert || !cache.convert) {
                    return cache;
                }
            }
            else {
                this.maps.delete(mapKey);
            }
        }
    }
    cacheMaps(set) {
        const now = Date.now();
        set.recent_favourites = [];
        for (const map of [...set.beatmaps ?? [], ...set.converts ?? []]) {
            const key = this.genKey(map.id, map.mode);
            map.fetchedAt = now;
            map.beatmapset = set;
            map.failtimes = { exit: [], fail: [] };
            this.maps.set(key, map);
        }
    }
    discardExpiredCache(expiredMs = this.cacheExpiredMs) {
        const now = Date.now();
        for (const [key, cache] of this.maps.entries()) {
            if (now > cache.fetchedAt + expiredMs) {
                this.maps.delete(key);
            }
        }
    }
    genKey(mapid, mode) {
        if (typeof mode === 'string') {
            mode = Modes_1.PlayMode.from(mode);
        }
        return `${mode.id}.${mapid}`;
    }
}
var FetchBeatmapErrorReason;
(function (FetchBeatmapErrorReason) {
    FetchBeatmapErrorReason[FetchBeatmapErrorReason["NotFound"] = 0] = "NotFound";
    FetchBeatmapErrorReason[FetchBeatmapErrorReason["FormatError"] = 1] = "FormatError";
    FetchBeatmapErrorReason[FetchBeatmapErrorReason["PlayModeMismatched"] = 2] = "PlayModeMismatched";
    FetchBeatmapErrorReason[FetchBeatmapErrorReason["Unknown"] = 3] = "Unknown";
    FetchBeatmapErrorReason[FetchBeatmapErrorReason["NotAvailable"] = 4] = "NotAvailable";
})(FetchBeatmapErrorReason = exports.FetchBeatmapErrorReason || (exports.FetchBeatmapErrorReason = {}));
function isFetchBeatmapError(err) {
    return 'isFetchBeatmapError' in err;
}
exports.isFetchBeatmapError = isFetchBeatmapError;
class FetchBeatmapError extends Error {
    constructor(reason, message) {
        super(message ?? FetchBeatmapErrorReason[reason]);
        this.isFetchBeatmapError = true;
        this.reason = reason;
        this.name = 'FetchBeatmapError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FetchBeatmapError);
        }
    }
}
exports.FetchBeatmapError = FetchBeatmapError;
class WebsiteBeatmapFecher {
    constructor() {
        this.webpreg = /<script id="json-beatmapset" type="application\/json">\s*(.+?)\s*<\/script>/ms;
    }
    getBeatmapsets(id) {
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
    async getBeatmap(id, mode = Modes_1.PlayMode.Osu, allowConvert = false) {
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
    getBeatmapset(mapId) {
        return this.fetchBeatmapFromWebsite(mapId);
    }
    async fetchBeatmapFromWebsite(id) {
        try {
            const target = `https://osu.ppy.sh/b/${id}`;
            const res = await axios_1.default.get(target);
            const match = this.webpreg.exec(res.data);
            if (match) {
                const json = JSON.parse(match[1]);
                return json;
            }
            throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError);
        }
        catch (e) {
            if (isFetchBeatmapError(e)) {
                throw e;
            }
            if (axios_1.default.isAxiosError(e)) {
                if (e.response?.status === 404) {
                    throw new FetchBeatmapError(FetchBeatmapErrorReason.NotFound);
                }
                throw new FetchBeatmapError(FetchBeatmapErrorReason.Unknown, e.message);
            }
            throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError, e.message);
        }
    }
}
exports.WebsiteBeatmapFecher = WebsiteBeatmapFecher;
exports.BeatmapRepository = new BeatmapRepositoryClass();
//# sourceMappingURL=BeatmapRepository.js.map
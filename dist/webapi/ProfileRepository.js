"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileRepository = exports.WebsiteProfileFetcher = exports.FetchProfileError = exports.isFetchProfileError = exports.FetchProfileErrorReason = void 0;
const axios_1 = __importDefault(require("axios"));
class ProfileRepositoryClass {
    constructor() {
        this.profiles = new Map();
        //Expired in 10 minutes
        this.cacheExpiredMs = 10 * 1000;
        this.fetcher = new WebsiteProfileFetcher();
    }
    /**
       *
       * @param userID
       * @param mode
       * @returns
       * @throws FetchProfileError
       */
    async getProfile(userID, mode) {
        let cache = this.tryGetCache(userID, mode);
        if (cache)
            return cache;
        const profile = await this.fetcher.getPlayer(userID, mode);
        this.cacheProfile(profile);
        cache = this.tryGetCache(userID, mode);
        if (cache)
            return cache;
        throw new FetchProfileError(FetchProfileErrorReason.NotFound);
    }
    tryGetCache(userID, mode) {
        const profileKey = this.genKey(userID, mode);
        const cache = this.profiles.get(profileKey);
        if (cache) {
            if (Date.now() < cache.fetchedAt + this.cacheExpiredMs) {
                return cache;
            }
            else {
                this.profiles.delete(profileKey);
            }
        }
    }
    cacheProfile(profile) {
        const now = Date.now();
        const cacheProfile = profile;
        const key = this.genKey(profile.id, profile.playmode);
        cacheProfile.fetchedAt = now;
        this.profiles.set(key, cacheProfile);
    }
    discardExpiredCache(expiredMs = this.cacheExpiredMs) {
        const now = Date.now();
        for (const [key, cache] of this.profiles.entries()) {
            if (now > cache.fetchedAt + expiredMs) {
                this.profiles.delete(key);
            }
        }
    }
    genKey(userID, mode) {
        return `${mode}.${userID}`;
    }
}
var FetchProfileErrorReason;
(function (FetchProfileErrorReason) {
    FetchProfileErrorReason[FetchProfileErrorReason["NotFound"] = 0] = "NotFound";
    FetchProfileErrorReason[FetchProfileErrorReason["FormatError"] = 1] = "FormatError";
    FetchProfileErrorReason[FetchProfileErrorReason["Unknown"] = 2] = "Unknown";
})(FetchProfileErrorReason = exports.FetchProfileErrorReason || (exports.FetchProfileErrorReason = {}));
function isFetchProfileError(err) {
    return 'isFetchProfileError' in err;
}
exports.isFetchProfileError = isFetchProfileError;
class FetchProfileError extends Error {
    constructor(reason, message) {
        super(message ?? FetchProfileErrorReason[reason]);
        this.isFetchProfileError = true;
        this.reason = reason;
        this.name = 'FetchProfileError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FetchProfileError);
        }
    }
}
exports.FetchProfileError = FetchProfileError;
class WebsiteProfileFetcher {
    constructor() {
        this.webpreg = /<script id="json-user" type="application\/json">\s*(.+?)\s*<\/script>/ms;
        this.modepreg = /<script id="json-currentMode" type="application\/json">\s*(.+?)\s*<\/script>/ms;
    }
    /**
       *
       * @param userID
       * @param mode
       * @returns
       * @throws FetchProfileError
       */
    async getPlayer(userID, mode) {
        const pro = await this.fetchProfileFromWebsite(userID, mode);
        if (!pro) {
            throw new FetchProfileError(FetchProfileErrorReason.NotFound);
        }
        return pro;
    }
    async fetchProfileFromWebsite(userID, mode) {
        try {
            const target = `https://osu.ppy.sh/users/${userID}/${mode}`;
            const res = await axios_1.default.get(target);
            const match = this.webpreg.exec(res.data);
            if (match) {
                const json = JSON.parse(match[1]);
                const mode = this.modepreg.exec(res.data);
                const rxes = json;
                if (mode) {
                    const regex = /"/ig;
                    rxes.playmode = mode[1].trim().replace(regex, '');
                }
                return rxes;
            }
            throw new FetchProfileError(FetchProfileErrorReason.FormatError);
        }
        catch (e) {
            if (isFetchProfileError(e)) {
                throw e;
            }
            if (axios_1.default.isAxiosError(e)) {
                if (e.response?.status === 404) {
                    throw new FetchProfileError(FetchProfileErrorReason.NotFound);
                }
                throw new FetchProfileError(FetchProfileErrorReason.Unknown, e.message);
            }
            throw new FetchProfileError(FetchProfileErrorReason.FormatError, e.message);
        }
    }
}
exports.WebsiteProfileFetcher = WebsiteProfileFetcher;
exports.ProfileRepository = new ProfileRepositoryClass();
//# sourceMappingURL=ProfileRepository.js.map
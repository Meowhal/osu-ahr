import axios from 'axios';
import { UserProfile } from './UserProfile';

export type ProfileCache = UserProfile & { fetchedAt: number };

class ProfileRepositoryClass {
  profiles: Map<string, ProfileCache>;
  cacheExpiredMs: number;
  fetcher: IProfileFetcher;

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
  async getProfile(userID: number, mode: string): Promise<ProfileCache> {

    let cache = this.tryGetCache(userID, mode);
    if (cache) return cache;

    const profile = await this.fetcher.getPlayer(userID, mode);
    this.cacheProfile(profile);

    cache = this.tryGetCache(userID, mode);
    if (cache) return cache;
    throw new FetchProfileError(FetchProfileErrorReason.NotFound);
  }

  tryGetCache(userID: number, mode: string): ProfileCache | undefined {
    const profileKey = this.genKey(userID, mode);
    const cache = this.profiles.get(profileKey);

    if (cache) {
      if (Date.now() < cache.fetchedAt + this.cacheExpiredMs) {
        return cache;
      } else {
        this.profiles.delete(profileKey);
      }
    }
  }
  cacheProfile(profile: UserProfile) {
    const now = Date.now();
    const cacheProfile = profile as ProfileCache;
    const key = this.genKey(profile.id, profile.playmode);
    cacheProfile.fetchedAt = now;
    this.profiles.set(key, cacheProfile);
  }

  discardExpiredCache(expiredMs: number = this.cacheExpiredMs) {
    const now = Date.now();
    for (const [key, cache] of this.profiles.entries()) {
      if (now > cache.fetchedAt + expiredMs) {
        this.profiles.delete(key);
      }
    }
  }

  genKey(userID: number, mode: string) {
    return `${mode}.${userID}`;
  }
}

export enum FetchProfileErrorReason {
    NotFound,
    FormatError,
    Unknown,
}

export function isFetchProfileError(err: any): err is FetchProfileError {
  return 'isFetchProfileError' in err;
}

export class FetchProfileError extends Error {

  isFetchProfileError: true = true;
  reason: FetchProfileErrorReason;
  constructor(reason: FetchProfileErrorReason, message?: string) {
    super(message ?? FetchProfileErrorReason[reason]);
    this.reason = reason;
    this.name = 'FetchProfileError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchProfileError);
    }
  }
}

export interface IProfileFetcher {
    getPlayer(userID: number, mode: string): Promise<UserProfile>;
}

export class WebsiteProfileFetcher implements IProfileFetcher {

  /**
     *
     * @param userID
     * @param mode
     * @returns
     * @throws FetchProfileError
     */
  async getPlayer(userID: number, mode: string): Promise<UserProfile> {
    const pro = await this.fetchProfileFromWebsite(userID, mode);

    if (!pro) {
      throw new FetchProfileError(FetchProfileErrorReason.NotFound);
    }

    return pro;
  }

  webpreg = /<script id="json-user" type="application\/json">\s*(.+?)\s*<\/script>/ms;
  modepreg = /<script id="json-currentMode" type="application\/json">\s*(.+?)\s*<\/script>/ms;

  async fetchProfileFromWebsite(userID: number, mode: string): Promise<UserProfile> {
    try {
      const target = `https://osu.ppy.sh/users/${userID}/${mode}`;
      const res = await axios.get(target);
      const match = this.webpreg.exec(res.data);
      if (match) {
        const json = JSON.parse(match[1]);
        const mode = this.modepreg.exec(res.data);
        const rxes = json as UserProfile;
        if(mode){
          const regex = /"/ig;
          rxes.playmode = mode[1].trim().replace(regex,'');
        }
        return rxes;
      }
      throw new FetchProfileError(FetchProfileErrorReason.FormatError);
    } catch (e: any) {
      if (isFetchProfileError(e)) {
        throw e;
      }
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 404) {
          throw new FetchProfileError(FetchProfileErrorReason.NotFound);
        }
        throw new FetchProfileError(FetchProfileErrorReason.Unknown, e.message);
      }
      throw new FetchProfileError(FetchProfileErrorReason.FormatError, e.message);
    }
  }
}

export const ProfileRepository = new ProfileRepositoryClass();

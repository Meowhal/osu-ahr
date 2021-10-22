import axios from 'axios';
import cheerio from "cheerio";
import { PlayMode } from '../Modes';

export function fetchBeatmapsets(id: number): Promise<Beatmapsets | undefined> {
  return fetchFromBeatmapPage(id);
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

/**
 * 
 * @param id 
 * @param mode 
 * @param allowConvert 
 * @returns 
 * @throws FetchBeatmapError 
 */
export async function fetchBeatmap(id: number, mode: PlayMode = PlayMode.Osu, allowConvert: boolean = false): Promise<Beatmap> {
  const set = await fetchFromBeatmapPage(id);
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

async function fetchFromSearch(id: number): Promise<any> {
  // needs account info
  const target = "https://osu.ppy.sh/beatmapsets/search?s=any&q=" + id;
  const res = await axios.get(target);
  return res.data;
}

async function fetchFromBeatmapPage(id: number): Promise<Beatmapsets> {
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

export type Beatmapsets = {
  "artist": string,
  "artist_unicode": string,
  "covers": Covers,
  "creator": string,
  "favourite_count": number,
  "id": number,
  "play_count": number,
  "preview_url": string,
  "source": string,
  "status": string,
  "title": string,
  "title_unicode": string,
  "user_id": number,
  "video": boolean,
  "availability": {
    "download_disabled": boolean,
    "more_information": any
  },
  "bpm": number,
  "can_be_hyped": boolean,
  "discussion_enabled": boolean,
  "discussion_locked": boolean,
  "hype": {
    "current": number,
    "required": number
  },
  "is_scoreable": boolean,
  "last_updated": string,
  "legacy_thread_url": string,
  "nominations": {
    "current": number,
    "required": number
  },
  "ranked": number,
  "ranked_date": string,
  "storyboard": boolean,
  "submitted_date": string,
  "tags": string,
  "has_favourited"?: boolean,
  "beatmaps"?: Beatmap[],
  "converts"?: Beatmap[],
  "current_user_attributes"?: {
    "can_delete": false,
    "can_edit_metadata": false,
    "can_hype": true,
    "can_hype_reason": null,
    "can_love": false,
    "is_watching": false,
    "new_hype_time": null,
    "remaining_hype": 10
  },
  "description"?: {
    "description": string
  },
  "genre"?: {
    "id": number,
    "name": string
  },
  "language"?: {
    "id": number,
    "name": string
  },
  "ratings": number[],
  "recent_favourites"?: any[],
}

export type Covers = {
  "cover": string,
  "cover@2x": string,
  "card": string,
  "card@2x": string,
  "list": string,
  "list@2x": string,
  "slimcover": string,
  "slimcover@2x": string
}

export type Beatmap = {
  "difficulty_rating": number,
  "id": number,
  "mode": string,
  "version": string,
  "accuracy": number,
  "ar": number,
  "beatmapset_id": number,
  "bpm": number,
  "convert": boolean,
  "count_circles": number,
  "count_sliders": number,
  "count_spinners": number,
  "cs": number,
  "deleted_at": any,
  "drain": number,
  "hit_length": number,
  "is_scoreable": boolean,
  "last_updated": string,
  "mode_int": number,
  "passcount": number,
  "playcount": number,
  "ranked": number,
  "status": string,
  "total_length": number,
  "url": string,
  "failtimes": {
    "fail": number[],
    "exit": number[]
  },
  "max_combo": number,
  "beatmapset"?: Beatmapsets
}
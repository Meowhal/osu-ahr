import { PlayMode } from '../Modes';
import { FetchBeatmapError, FetchBeatmapErrorReason, IBeatmapFetcher } from '../webapi/BeatmapRepository';
import { Beatmap, Beatmapset } from '../webapi/Beatmapsets';

const MODES = ['osu', 'taiko', 'fruits', 'mania'];

export class FakeBeatmapFetcher implements IBeatmapFetcher {
  beatmapTemplate: Beatmap = {
    beatmapset_id: 100,
    difficulty_rating: 5.00,
    id: 100,
    mode: 'osu',
    status: 'ranked',
    total_length: 300,
    version: 'Insane',
    accuracy: 5,
    ar: 9,
    bpm: 175,
    convert: false,
    count_circles: 161,
    count_sliders: 420,
    count_spinners: 0,
    cs: 4,
    deleted_at: null,
    drain: 5,
    hit_length: 216,
    is_scoreable: true,
    last_updated: '2021-06-30T00:00:00+00:00',
    mode_int: 0,
    passcount: 100,
    playcount: 100,
    ranked: 1,
    url: 'https://osu.ppy.sh/beatmaps/100',
    failtimes: {
      fail: [0, 0],
      exit: [0, 0]
    },
    max_combo: 1100,
  };

  beatmapsetTemplate: Beatmapset = {
    'artist': 'art',
    'artist_unicode': 'art',
    'covers': {
      'cover': 'https://assets.ppy.sh/beatmaps/1000/covers/cover.jpg?1000',
      'cover@2x': 'https://assets.ppy.sh/beatmaps/1000/covers/cover@2x.jpg?1000',
      'card': 'https://assets.ppy.sh/beatmaps/1000/covers/card.jpg?1000',
      'card@2x': 'https://assets.ppy.sh/beatmaps/1000/covers/card@2x.jpg?1000',
      'list': 'https://assets.ppy.sh/beatmaps/1000/covers/list.jpg?1000',
      'list@2x': 'https://assets.ppy.sh/beatmaps/1000/covers/list@2x.jpg?1000',
      'slimcover': 'https://assets.ppy.sh/beatmaps/1000/covers/slimcover.jpg?1000',
      'slimcover@2x': 'https://assets.ppy.sh/beatmaps/1000/covers/slimcover@2x.jpg?1000'
    },
    'creator': 'theramdans',
    'favourite_count': 100,
    'hype': null,
    'id': 100,
    'nsfw': false,
    'play_count': 100,
    'preview_url': '//b.ppy.sh/preview/100.mp3',
    'source': '',
    'status': 'ranked',
    'title': 'title',
    'title_unicode': 'title',
    'track_id': 100,
    'user_id': 100,
    'video': false,
    'availability': {
      'download_disabled': false,
      'more_information': null
    },
    'bpm': 175,
    'can_be_hyped': false,
    'discussion_enabled': true,
    'discussion_locked': false,
    'is_scoreable': true,
    'last_updated': '2021-06-30T17:39:11+00:00',
    'legacy_thread_url': 'https://osu.ppy.sh/community/forums/topics/100',
    'nominations_summary': {
      'current': 2,
      'required': 2
    },
    'ranked': 1,
    'ranked_date': '2021-07-08T19:43:54+00:00',
    'storyboard': true,
    'submitted_date': '2020-12-14T10:48:15+00:00',
    'tags': '',
    'has_favourited': false,
    'beatmaps': [],
    'converts': [],
    'description': {
      'description': ''
    },
    'genre': {
      'id': 5,
      'name': 'Pop'
    },
    'language': {
      'id': 3,
      'name': 'Japanese'
    },
    'ratings': [],
    'recent_favourites': []
  };

  beatmapset: Beatmapset;
  id: number;

  constructor() {
    this.id = 100;
    this.beatmapset = this.setBeatmapProperties(this.id, 'test', PlayMode.Osu, 100, 4);
  }

  setBeatmapProperties(id: number, title: string, mode: PlayMode, total_length: number, difficulty_rating: number): Beatmapset {
    const set = { ...this.beatmapsetTemplate };
    set.title = title;
    set.title_unicode = title;

    const map = {
      ...this.beatmapTemplate,
      id: id,
      url: `https://osu.ppy.sh/beatmaps/${id}`,
      mode: MODES[mode.id],
      mode_int: mode.id,
      convert: false,
      total_length: total_length,
      difficulty_rating: difficulty_rating,
    };

    set.beatmaps = [map];
    set.converts = [];

    if (mode === PlayMode.Osu) {
      set.converts.push({ ...map, mode: MODES[1], mode_int: 1, convert: true });
      set.converts.push({ ...map, mode: MODES[2], mode_int: 2, convert: true });
      set.converts.push({ ...map, mode: MODES[3], mode_int: 3, convert: true });
    }

    this.id = id;
    this.beatmapset = set;
    return set;
  }

  async getBeatmapset(id: number): Promise<Beatmapset> {

    if (this.id !== id) {
      throw new FetchBeatmapError(FetchBeatmapErrorReason.NotFound);
    }

    if (id < 0) {
      throw new FetchBeatmapError(FetchBeatmapErrorReason.FormatError);
    }

    return this.beatmapset;
  }
}

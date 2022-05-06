
export type Beatmapset = {
  'artist': string,
  'artist_unicode': string,
  'covers': Covers,
  'creator': string,
  'favourite_count': number,
  'id': number,
  'nsfw': boolean,
  'play_count': number,
  'preview_url': string,
  'source': string,
  'status': string,
  'title': string,
  'title_unicode': string,
  'track_id': number,
  'user_id': number,
  'video': boolean,
  'availability': {
    'download_disabled': boolean,
    'more_information': any
  },
  'bpm': number,
  'can_be_hyped': boolean,
  'discussion_enabled': boolean,
  'discussion_locked': boolean,
  'hype': {
    'current': number,
    'required': number
  } | null,
  'is_scoreable': boolean,
  'last_updated': string,
  'legacy_thread_url': string,
  'nominations_summary': {
    'current': number,
    'required': number
  } | null,
  'ranked': number,
  'ranked_date': string,
  'storyboard': boolean,
  'submitted_date': string,
  'tags': string,
  'has_favourited'?: boolean,
  'beatmaps'?: Beatmap[],
  'converts'?: Beatmap[],
  'current_user_attributes'?: {
    'can_delete': false,
    'can_edit_metadata': false,
    'can_hype': true,
    'can_hype_reason': null,
    'can_love': false,
    'is_watching': false,
    'new_hype_time': null,
    'remaining_hype': 10
  },
  'description'?: {
    'description': string
  },
  'genre'?: {
    'id': number,
    'name': string
  },
  'language'?: {
    'id': number,
    'name': string
  },
  'ratings': number[],
  'recent_favourites'?: any[],
}

export type Covers = {
  'cover': string,
  'cover@2x': string,
  'card': string,
  'card@2x': string,
  'list': string,
  'list@2x': string,
  'slimcover': string,
  'slimcover@2x': string
}

export type Beatmap = {
  'difficulty_rating': number,
  'id': number,
  'mode': string,
  'version': string,
  'accuracy': number,
  'ar': number,
  'beatmapset_id': number,
  'bpm': number,
  'convert': boolean,
  'count_circles': number,
  'count_sliders': number,
  'count_spinners': number,
  'cs': number,
  'deleted_at': any,
  'drain': number,
  'hit_length': number,
  'is_scoreable': boolean,
  'last_updated': string,
  'mode_int': number,
  'passcount': number,
  'playcount': number,
  'ranked': number,
  'status': string,
  'total_length': number,
  'url': string,
  'failtimes': {
    'fail': number[],
    'exit': number[]
  },
  'max_combo': number,
  'beatmapset'?: Beatmapset
}
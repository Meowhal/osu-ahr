export type History = {
  'match': Match,
  'events': Event[],
  'users': User[],
  'latest_event_id': number,
  'current_game_id': number | null
}

export type Match = {
  'id': number,
  'start_time': string,
  'end_time': string | null,
  'name': string
}

export type Event = {
  'id': number,
  'detail': {
    'type': EventType,
    'text'?: string
  },
  'game'?: Game,
  'timestamp': string,
  'user_id': number | null
}

export type EventType = 'match-created' | 'match-disbanded' |
  'host-changed' | 'player-joined' | 'player-left' | 'player-kicked' |
  'other';

export type User = {
  'avatar_url': string | null,
  'country_code': string,
  'default_group': string,
  'id': number,
  'is_active': boolean,
  'is_bot': boolean,
  'is_online': boolean,
  'is_supporter': boolean,
  'last_visit': string,
  'pm_friends_only': boolean,
  'profile_colour': string | null,
  'username': string,
  'country': {
    'code': string,
    'name': string
  }
}

export type Game = {
  'id': number
  'start_time': string,
  'end_time': string | null,
  'mode': 'osu' | 'taiko' | 'fruits' | 'mania' | string,
  /**
   * 0 = osu, 1 = taiko, 2 = fruits, 3 = mania
   */
  'mode_int': number,
  'scoring_type': 'score' | 'accuracy' | 'combo' | 'scorev2' | string,
  'team_type': 'head-to-head' | 'tag-coop' | 'team-vs' | 'tag-team-vs' | string,
  'mods': string[],
  'beatmap': any,
  'scores': Score[]
}

export type Score = {
  'id': null,
  'user_id': number,
  'accuracy': number,
  'mods': string[],
  'score': number,
  'max_combo': number,
  'perfect': number,
  'statistics': {
    'count_50': number,
    'count_100': number,
    'count_300': number,
    'count_geki': number,
    'count_katu': number,
    'count_miss': number
  },
  'rank': null,
  'created_at': null,
  'best_id': null,
  'pp': number | null,
  'match': {
    'slot': number,
    'team': 'none' | 'red' | 'blue',
    'pass': number
  }
}
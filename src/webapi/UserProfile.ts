export interface UserProfile {
  get_time: number;
  avatar_url: string,
  country_code: string,
  default_group: string,
  id: number,
  is_active: boolean,
  is_bot: boolean,
  is_online: boolean,
  is_supporter: boolean,
  last_visit: string,
  pm_friends_only: boolean,
  username: string,
  has_supported: boolean,
  join_date: string,
  country: { code: string, name: string },
  previous_usernames: string[],

  statistics: {
    level: { current: number, progress: number },
    pp: number,
    pp_rank: number,
    ranked_score: number,
    hit_accuracy: number,
    play_count: number,
    play_time: number,
    total_score: number,
    total_hits: number,
    maximum_combo: number,
    replays_watched_by_others: number,
    is_ranked: boolean,
    grade_counts: { ss: number, ssh: number, s: number, sh: number, a: number },
    rank: { global: number, country: number }
  },
  support_level: number
}

/**
 * データ容量節約のため、余計なデータを取り除く
 */
export function trimProfile(data: UserProfile): UserProfile {
  return {
    avatar_url: data.avatar_url,
    country_code: data.country_code,
    default_group: data.default_group,
    id: data.id,
    is_active: data.is_active,
    is_bot: data.is_bot,
    is_online: data.is_online,
    is_supporter: data.is_supporter,
    last_visit: data.last_visit,
    pm_friends_only: data.pm_friends_only,
    username: data.username,
    join_date: data.join_date,
    country: { code: data.country.code, name: data.country.name },
    previous_usernames: data.previous_usernames,
    statistics: data.statistics,
    support_level: data.support_level,
    get_time: data.get_time
  } as UserProfile;
}
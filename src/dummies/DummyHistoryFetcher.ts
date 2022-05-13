import { History, Match, User, Event, EventType, Score, Game } from '../webapi/HistoryTypes';
import { IHistoryFetcher } from '../webapi/HistoryFetcher';

export class DummyHistoryFecher implements IHistoryFetcher {
  match: Match;
  events: Event[];
  users: User[];
  limit: number = 100;
  timestamp: number = Date.now();

  constructor(creatorId: number) {
    this.match = {
      end_time: null,
      id: 0,
      name: 'dummy match',
      start_time: (new Date(this.timestamp)).toUTCString()
    };
    this.events = [];
    this.users = [];

    this.addEvent('match-created', creatorId);
    this.addEvent('host-changed', creatorId);
  }

  fetchHistory(limit: number, before: number | null, after: number | null, matchId: number = 0): Promise<History> {
    const events = [];

    limit = Math.max(1, Math.min(this.limit, limit));
    if (after) {
      after = Math.max(after, -1);
      const end = Math.min(after + limit + 1, this.events.length);
      for (let i = after + 1; i < end; i++) {
        events.push(this.events[i]);
      }
    } else {
      before = Math.min(before ?? this.events.length, this.events.length);
      const start = Math.max(0, before - limit);
      for (let i = start; i < before; i++) {
        events.push(this.events[i]);
      }
    }

    return Promise.resolve({
      match: this.match,
      events,
      users: this.users,
      current_game_id: null,
      latest_event_id: this.events.length - 1,
    });
  }

  addEvent(type: EventType, user_id: number) {
    this.timestamp += 1000;
    this.events.push({
      id: this.events.length,
      detail: {
        type: type,
      },
      timestamp: (new Date(this.timestamp)).toUTCString(),
      user_id
    });
    this.createDummyUserIfNotExist(user_id);
  }

  addGameEvent(member: number[], title?: string) {
    this.timestamp += 1000;
    if (member.length === 0) return;
    const scores = this.createDummyScores(member);
    const game = this.createDummyGame(1, true);
    game.scores = scores;
    title = title ?? this.match.name;

    this.events.push({
      id: this.events.length,
      detail: {
        type: 'other',
        text: title
      },
      timestamp: (new Date(this.timestamp)).toUTCString(),
      user_id: null,
      game
    });

    member.forEach(m => {
      if (!this.existsUser(m)) {
        throw new Error('unknown member joined game');
      }
    });
  }

  createDummyGame(id: number, ended: boolean): Game {
    const n = (new Date()).toISOString();
    return {
      beatmap: {},
      end_time: ended ? n : null,
      id: id,
      mode: 'osu',
      mode_int: 0,
      mods: [],
      scores: [],
      scoring_type: 'score',
      start_time: n,
      team_type: 'head-to-head'
    };
  }

  createDummyScores(nums: number[]): Score[] {
    return nums.map<Score>(v => ({
      id: null,
      user_id: v,
      accuracy: 0.95,
      mods: [],
      best_id: null,
      created_at: null,
      match: {
        slot: v,
        team: 'none',
        pass: 1
      },
      max_combo: 100,
      perfect: 0,
      pp: null,
      rank: null,
      score: 1000000,
      statistics: {
        count_100: 10,
        count_300: 1000,
        count_50: 1,
        count_geki: 1,
        count_katu: 1,
        count_miss: 1
      }
    }));
  }

  createDummyUserIfNotExist(userId: number | null): void {
    if (userId && !this.existsUser(userId)) {
      this.users.push({
        avatar_url: null,
        country_code: 'AA',
        default_group: 'default',
        id: userId,
        is_active: true,
        is_bot: false,
        is_online: true,
        is_supporter: true,
        last_visit: this.match.start_time,
        pm_friends_only: false,
        profile_colour: null,
        username: `user${userId}`,
        country: {
          code: 'AA',
          name: 'AA'
        }
      });
    }
  }

  existsUser(userId: number): boolean {
    return this.users.find(v => v.id === userId) !== undefined;
  }
}

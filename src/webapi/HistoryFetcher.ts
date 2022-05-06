import axios from 'axios';
import { History } from './HistoryTypes';

export interface IHistoryFetcher {
  /**
   * パラメータに沿ったヒストリーを取得する
   * 通信エラーの場合は例外が発生する
   * @param limit
   * @param before
   * @param after
   * @param matchId
   */
  fetchHistory(limit: number, before: number | null, after: number | null, matchId: number): Promise<History>;
}

export class HistoryFecher implements IHistoryFetcher {
  async fetchHistory(limit: number, before: number | null, after: number | null, matchId: number): Promise<History> {
    const url = `https://osu.ppy.sh/community/matches/${matchId}`;
    const params: any = {
      'limit': limit,
    };
    if (before) {
      params.before = before;
    }

    if (after) {
      params.after = after;
    }

    return (await axios.get(url, { params })).data;
  }
}

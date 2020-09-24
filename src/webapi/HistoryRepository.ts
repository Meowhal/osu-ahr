import axios, { AxiosResponse } from 'axios';
import log4js from "log4js";
import { Event, History, Match, User } from './HistoryInterfaces';
import { TypedEvent } from '../libs';

interface FetchResult {
  /**
   * 最後のイベントまで到達したか
   */
  filled: boolean;
  /**
   * 今回読み込んだイベントの数
   */
  count: number;
  /**
   * 巻き戻しか
   */
  isRewind: boolean;
}

export interface IHistoryFecher {
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

class HistoryFecher implements IHistoryFecher {
  async fetchHistory(limit: number, before: number | null, after: number | null, matchId: number): Promise<History> {
    const url = `https://osu.ppy.sh/community/matches/${matchId}/history`;
    const params: any = {
      'limit': limit,
    }
    if (before) {
      params.before = before;
    }

    if (after) {
      params.after = after;
    }

    return (await axios.get(url, { params })).data;
  }
}

export class HistoryRepository {
  matchId: number;
  matchInfo: Match | null = null;
  latestEventId: number = 0;
  oldestEventId: number = Number.MAX_VALUE;
  logger: log4js.Logger;
  users: { [id: number]: User };
  events: Event[];
  gotUserProfile = new TypedEvent<{ user: User }>();
  changedLobbyName = new TypedEvent<{ newName: string, oldName: string }>();
  hasError: boolean = false;
  fetcher: IHistoryFecher;

  constructor(matchId: number) {
    this.matchId = matchId;
    this.logger = log4js.getLogger("history");
    this.users = {};
    this.events = [];
    this.fetcher = new HistoryFecher();
  }

  /**
   * 現在の最新イベントからサーバー上の最新イベントまで更新する。
   * 初回実行時は100このイベントが取得される。
   */
  async updateToLatest(): Promise<void> {
    if (this.hasError) return;

    try {
      while (!(await this.fetch(false)).filled) {
      }
    } catch {
      this.hasError = true;
    }

  }


  async fetch(isRewind: boolean = false): Promise<FetchResult> {
    let limit = 100;
    let after = null;
    let before = null;

    if (this.events.length != 0) {
      if (isRewind) {
        before = this.oldestEventId;
      } else {
        after = this.latestEventId;
      }
    } else {
      isRewind = false;
    }

    let data: History | null = null;
    try {
      data = await this.fetcher.fetchHistory(limit, before, after, this.matchId);
    } catch (e) {
      if (e.isAxiosError) {
        this.logger.error(e.message);
      }
      throw e;
    }

    return this.loadHistory(data, isRewind);
  }

  /**
   * ヒストリーデータを取り込む
   * まだ読み込む余地がある場合trueを返す
   * 前提条件：取得するイベント範囲は現在取り込まれている範囲と重複しないこと
   * 新しいユーザープロフィールが読み込まれた場合 gotUserProfile を発生させる
   * ロビー名が変更されていた場合 changedLobbyName を発生させる
   * @param data ヒストリーデータ
   * @param isRewind 取り込み済みより前のデータを取り込むかどうか
   */
  loadHistory(data: History, isRewind: boolean): FetchResult {
    if (!data || !data.events || !data.events.length) return { count: 0, filled: true, isRewind };

    if (this.events.length == 0) {
      this.events = data.events;
      this.oldestEventId = data.events[0].id;
      this.latestEventId = data.events[data.events.length - 1].id;
    } else if (isRewind) {
      this.oldestEventId = data.events[0].id;
      this.events = data.events.concat(this.events);
    } else {
      data.events.forEach(e => {
        this.events.push(e);
      });
      this.latestEventId = data.events[data.events.length - 1].id;
    }

    data.users.forEach(u => {
      const isNewComer = !(u.id in this.users);
      this.users[u.id] = u; // データは毎回必ず更新する
      if (isNewComer) {
        this.gotUserProfile.emit({ user: u });
      }
    });

    if (!this.matchInfo) {
      this.matchInfo = data.match;
    } else {
      if (this.matchInfo.name != data.match.name) {
        const oldName = this.matchInfo.name;
        this.matchInfo = data.match;
        this.changedLobbyName.emit({ oldName, newName: this.matchInfo.name });
      }
    }

    // 巻き戻しなら部屋作成イベントでfalse,
    // 前進なら最新イベントと一致でfalse
    return {
      isRewind,
      count: data.events.length,
      filled: isRewind
        ? this.events[0].detail.type == "match-created"
        : this.latestEventId == data.latest_event_id
    };
  }

  /**
   * 
   */
  async calcCurrentOrderAsName(): Promise<string[]> {
    return (await this.calcCurrentOrderAsID()).filter(id => id in this.users).map(id => this.users[id].username);
  }

  /**
   * プレイヤーのホスト順を計算し、結果をIDで出力する。
   * 
   */
  async calcCurrentOrderAsID(): Promise<number[]> {
    await this.updateToLatest();
    const map: { [id: number]: boolean } = {};
    const result: { age: number, id: number }[] = [];

    if (this.events.length == 0) return [];

    let i = this.events.length;
    let eaCount = 0; // ゲーム参加者が全員発見済みのプレイヤーだった回数
    let exCount = 0; // 現在プレイ中のプレイヤー発見数
    let loopCount = 0;
    const LOOP_LIMIT = 10000; // 検索イベント数の上限
    const ESC_CRITERIA = 2; // 全員発見と見做す試合回数
    while (true) {
      i--;
      loopCount++;
      if (i < 0) {
        // 巻き戻し
        let r = await this.fetch(true);
        if (r.count == 0) break; // 結果が空なら終わり
        i = r.count - 1;
      }
      let ev = this.events[i];
      if (ev.user_id == null) continue;
      switch (ev.detail.type) {
        case "match-created":
        case "host-changed":
        case "player-joined":
          if (!(ev.user_id in map)) {
            map[ev.user_id] = false;
            result.push({ age: ev.id, id: ev.user_id });
            exCount++;
          }
          break;
        case "player-left":
        case "player-kicked":
          if (!(ev.user_id in map)) {
            map[ev.user_id] = true;
          }
          break;
        case "other":
          if (ev.game && this.isAllPlayerJoinedGame(map, ev.game)) {
            // 現在見つかったすべてのプレイヤーが試合に参加している
            // 未発見のプレイヤーがマップ未所持で開始した場合でもtrueになるためこの結果により全員発見とすることはできない
            eaCount++;
          } else {
            eaCount = 0;
          }
          break;
        default:
          this.logger.warn("unknown event type! " + JSON.stringify(ev));
          break;
      }

      // 次の条件で全員発見したこととする
      //  参加人数が16人になった
      //  発見済みプレイヤー全員参加試合が{ESC_CRITERIA}回以上続いた
      //  ロビー作成イベントまで到達
      // ループリミットを超過
      if (16 <= exCount) {
        this.logger.info(`found ${exCount} players in ${loopCount} events. full lobby`);
        break;
      }
      if (ESC_CRITERIA <= eaCount) {
        this.logger.info(`found ${exCount} players in ${loopCount} events. estimated`);
        break;
      }
      if (ev.detail.type == "match-created") {
        this.logger.info(`found ${exCount} players in ${loopCount} events. reached begin of events`);
        break;
      }
      if (LOOP_LIMIT < loopCount) {
        this.logger.warn("loop limit exceeded! " + LOOP_LIMIT);
        break;
      }
    }

    result.sort((a, b) => a.age - b.age);
    return result.map(a => a.id);
  }

  /**
   * ゲームに現在確認されたプレイヤーが全員参加しているか確認する
   * @param map 現在までに存在が確認されたプレイヤーの一覧
   */
  private isAllPlayerJoinedGame(map: { [id: number]: boolean }, game: any): boolean {
    if (!game || !game.scores || !game.scores.length) return false;
    for (let s of game.scores) {
      if (!(s.user_id in map)) return false;
    }
    return true;
  }
}



import log4js from "log4js";
import { Event, History, Match, User } from './HistoryTypes';
import { TypedEvent } from '../libs';
import { HistoryFecher as HistoryFetcher, IHistoryFetcher as IHistoryFetcher } from "./HistoryFetcher";

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

export class HistoryRepository {
  matchId: number;
  matchInfo: Match | null = null;
  lobbyName: string = "";
  latestEventId: number = 0;
  oldestEventId: number = Number.MAX_VALUE;
  logger: log4js.Logger;
  users: { [id: number]: User };
  events: Event[];
  gotUserProfile = new TypedEvent<{ user: User }>();
  changedLobbyName = new TypedEvent<{ newName: string, oldName: string }>();
  hasError: boolean = false;
  fetcher: IHistoryFetcher;
  static ESC_CRITERIA: number = 2; // プレイヤー存在確認に利用する試合数
  static LOOP_LIMIT: number = 10000; // 検索イベント数の上限

  constructor(matchId: number, fetcher: IHistoryFetcher | null = null) {
    this.matchId = matchId;
    this.logger = log4js.getLogger("history");
    this.users = {};
    this.events = [];
    this.fetcher = fetcher ?? new HistoryFetcher();
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
  private loadHistory(data: History, isRewind: boolean): FetchResult {
    if (!data || !data.events || !data.events.length) return { count: 0, filled: true, isRewind };

    if (!this.matchInfo) {
      this.matchInfo = data.match;
      this.lobbyName = data.match.name;
    }

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

    for (let i = data.events.length - 1; 0 <= i; i--) {
      let ev = data.events[i];
      if (ev.detail.type == "other" && ev.detail.text != null && ev.detail.text != this.lobbyName) {
        const newName = ev.detail.text;
        const oldName = this.lobbyName;
        this.lobbyName = newName;
        this.changedLobbyName.emit({ oldName, newName });
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
   * プレイヤーのホスト順を計算し、結果を名前で出力する。
   */
  async calcCurrentOrderAsName(): Promise<string[]> {
    return (await this.calcCurrentOrderAsID()).filter(id => id in this.users).map(id => this.users[id].username);
  }

  /**
   * プレイヤーのホスト順を計算し、結果をIDで出力する。
   */
  async calcCurrentOrderAsID(): Promise<number[]> {
    await this.updateToLatest();
    const map: { [id: number]: boolean } = {}; // 確認されたプレイヤー一覧、ロビー離席済みはtrue
    const result: { age: number, id: number }[] = [];

    if (this.events.length == 0) return [];

    let i = this.events.length;
    let exCount = 0; // 現在プレイ中のプレイヤー発見数
    let loopCount = 0;
    let hostAge = -1;  // 現在のホスト
    let gameCount = 0; // 現在までの試合数
    let unresolvedPlayers = new Set<number>(); // 試合に参加したがまだ順番が確定していないプレイヤー

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

      if (ev.user_id != null) {
        switch (ev.detail.type) {
          case "host-changed":
            if (!(ev.user_id in map)) {
              map[ev.user_id] = false;
              result.push({ age: hostAge, id: ev.user_id }); // 一番最初のホストは age -1になる
              exCount++;
            }
            hostAge = ev.id;
            unresolvedPlayers.delete(ev.user_id);
            break;
          case "match-created":
          case "player-joined":
            if (!(ev.user_id in map)) {
              map[ev.user_id] = false;
              result.push({ age: ev.id, id: ev.user_id });
              exCount++;
              unresolvedPlayers.delete(ev.user_id);
            }
            break;
          case "player-left":
          case "player-kicked":
            if (!(ev.user_id in map)) {
              map[ev.user_id] = true;
              unresolvedPlayers.delete(ev.user_id);
            }
            break;
          default:
            this.logger.warn("unknown event type! " + JSON.stringify(ev));
            break;
        }
      } else if (ev.detail.type == "other" && ev.game && ev.game.scores && gameCount < HistoryRepository.ESC_CRITERIA) {
        gameCount++;
        for (let s of ev.game.scores) {
          if (!(s.user_id in map)) {
            unresolvedPlayers.add(s.user_id);
          }
        }
      }

      // 次の条件で全員発見したこととする
      //  参加人数が16人になった
      //  直近{ESC_CRITERIA}回の試合参加メンバーすべての存在が確認された
      //  ロビー作成イベントまで到達
      // ループリミットを超過
      if (16 <= exCount) {
        this.logger.info(`found ${exCount} players in ${loopCount} events. full lobby`);
        break;
      }
      if (HistoryRepository.ESC_CRITERIA <= gameCount && unresolvedPlayers.size === 0) {
        this.logger.info(`found ${exCount} players in ${loopCount} events. estimated`);
        break;
      }
      if (ev.detail.type == "match-created") {
        this.logger.info(`found ${exCount} players in ${loopCount} events. reached begin of events`);
        break;
      }
      if (HistoryRepository.LOOP_LIMIT < loopCount) {
        this.logger.warn("loop limit exceeded! " + HistoryRepository.LOOP_LIMIT);
        break;
      }
    }

    result.sort((a, b) => a.age - b.age);
    return result.map(a => a.id);
  }
}


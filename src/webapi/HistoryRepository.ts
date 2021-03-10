
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

  // Events
  gotUserProfile = new TypedEvent<{ sender: HistoryRepository, user: User }>();
  changedLobbyName = new TypedEvent<{ sender: HistoryRepository, newName: string, oldName: string }>();
  kickedUser = new TypedEvent<{ sender: HistoryRepository, kickedUser: User }>();

  hasError: boolean = false;
  errorCount: number = 0;
  ERR_COUNT_LIMIT = 10;
  fetcher: IHistoryFetcher;
  static ESC_CRITERIA: number = 16; // プレイヤー存在確認に利用する試合数
  static LOOP_LIMIT: number = 10000; // 検索イベント数の上限

  constructor(matchId: number, fetcher: IHistoryFetcher | null = null) {
    this.matchId = matchId;
    this.logger = log4js.getLogger("history");
    this.logger.addContext("channel", "lobby");
    this.users = {};
    this.events = [];
    this.fetcher = fetcher ?? new HistoryFetcher();
  }

  /**
   * 現在の最新イベントからサーバー上の最新イベントまで更新する。
   * 初回実行時は100個のイベントが取得される。
   */
  async updateToLatest(): Promise<void> {
    if (this.hasError) return;

    try {
      while (!(await this.fetch(false)).filled) {
      }
    } catch (e) {
      this.logger.error(e.message);
      this.hasError = true;
      if (this.errorCount++ < this.ERR_COUNT_LIMIT) {
        setTimeout(() =>{
          this.hasError = false;
          this.logger.info(`restart fetch count:${this.errorCount}`);
        }, 30 * 1000);
      }      
    }
  }

  async fetch(isRewind: boolean = false): Promise<FetchResult> {
    if (this.matchId == 0) return { count: 0, filled: true, isRewind };

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
        this.gotUserProfile.emit({ sender: this, user: u });
      }
    });

    for (let i = data.events.length - 1; 0 <= i; i--) {
      let ev = data.events[i];
      switch (ev.detail.type) {
        case "other":
          this.checkLobbyName(ev);
          break;
        case "player-kicked":
          this.raiseKickedEvent(ev);
          break;
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

  checkLobbyName(ev: Event) {
    if (ev.detail.text != null && ev.detail.text != this.lobbyName) {
      const newName = ev.detail.text;
      const oldName = this.lobbyName;
      this.lobbyName = newName;
      this.changedLobbyName.emit({ sender: this, oldName, newName });
    }
  }

  raiseKickedEvent(ev: Event) {
    if (ev.user_id) {
      const kickedUser = this.users[ev.user_id];
      if (kickedUser) {
        this.kickedUser.emit({ sender: this, kickedUser });
      }
    }
  }

  /**
   * プレイヤーのホスト順を計算し、結果を名前で出力する。
   */
  async calcCurrentOrderAsName(): Promise<string[]> {
    return (await this.calcCurrentOrderAsID()).filter(id => id in this.users).map(id => this.users[id].username);
  }

  /**
   * プレイヤーのホスト順を計算し、結果をIDで出力する。
   * ヒストリーの新しい方から順番に解析していく。
   * プレイヤーは参加時のイベントIDか自分がホストのときの試合開始時のイベントIDをageとして記録する
   * ageが若いプレイヤーほど早くホスト順が回ってくる。
   * 最初のhostchangeイベントを検知したとき、試合中なら試合開始イベントIDがageになり、試合外ならageは-1になる。
   * 2回目以降のhostchangeイベントでは一つ前のhostchangeイベントIDか、一つ前の試合開始イベントのIDがageになる。
   */
  async calcCurrentOrderAsID(): Promise<number[]> {
    this.hasError = false;
    await this.updateToLatest();
    const map: { [id: number]: boolean } = {}; // 確認されたプレイヤー一覧、ロビー離席済みはtrue
    const result: { age: number, id: number }[] = [];

    if (this.events.length == 0) return [];

    let i = this.events.length;
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
              // -1、直前の試合開始ID、直前のhostchangeIDのいずれか
              //this.logger.trace(`changed ${this.users[ev.user_id].username} ${hostAge}`);
              result.push({ age: hostAge, id: ev.user_id });
            }
            hostAge = Date.parse(ev.timestamp);
            unresolvedPlayers.delete(ev.user_id);
            break;
          case "match-created":
          case "player-joined":
            if (!(ev.user_id in map)) {
              const la = Date.parse(ev.timestamp);
              map[ev.user_id] = false;
              //this.logger.trace(`joined ${this.users[ev.user_id].username} ${la}`);
              result.push({ age: la, id: ev.user_id });
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
      } else if (ev.detail.type == "other" && ev.game) {
        hostAge = Date.parse(ev.game.start_time);
        //this.logger.trace(`set host age ${hostAge} bc game start`);
        if (ev.game.scores && gameCount < HistoryRepository.ESC_CRITERIA) {
          gameCount++;
          for (let s of ev.game.scores) {
            if (!(s.user_id in map)) {
              unresolvedPlayers.add(s.user_id);
            }
          }
        }
      }

      // 次の条件で全員発見したこととする
      //  参加人数が16人になった
      //  直近{ESC_CRITERIA}回の試合参加メンバーすべての存在が確認された
      //  ロビー作成イベントまで到達
      // ループリミットを超過
      if (16 <= result.length) {
        this.logger.info(`found ${result.length} players in ${loopCount} events. full lobby`);
        break;
      }
      if (HistoryRepository.ESC_CRITERIA <= gameCount && unresolvedPlayers.size === 0) {
        this.logger.info(`found ${result.length} players in ${loopCount} events. estimated`);
        break;
      }
      if (ev.detail.type == "match-created") {
        this.logger.info(`found ${result.length} players in ${loopCount} events. reached begin of events`);
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


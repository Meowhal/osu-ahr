import { ILobby } from "../ILobby";
import { LobbyPlugin } from "./LobbyPlugin";
import config from "config";
import log4js from "log4js";
const logger = log4js.getLogger("wordCounter");

export interface WordCounterOption {
  periods: {
    symbol: string,
    duration_ms: number
  }[];
  log_interval_ms: number;
}

const DefaultOption = config.get<WordCounterOption>("WordCounter");

interface Sample {
  time: number;
  length: number;
}

export interface WordCounterPeriod {
  symbol: string,
  durationMs: number,
  chatsPerPeriod: number,
  wordsPerPeriod: number,
  chatsPerPeriodMax: number,
  wordsPerPeriodMax: number,
  index: number
}
/**
 * チャットの文字数を数えて記録する
 */
export class WordCounter extends LobbyPlugin {
  option: WordCounterOption;
  samples: Sample[] = [];
  periods: WordCounterPeriod[];
  lastLogTime: number = 0;

  constructor(lobby: ILobby, option: any | null = null) {
    super(lobby);
    this.option = { ...DefaultOption, ...option } as WordCounterOption;
    this.periods = this.option.periods.map(a => {
      return {
        symbol: a.symbol,
        durationMs: a.duration_ms,
        chatsPerPeriod: 0,
        wordsPerPeriod: 0,
        chatsPerPeriodMax: 0,
        wordsPerPeriodMax: 0,
        index: 0
      }
    });
    this.registerEvents();
  }

  private registerEvents(): void {
    this.lobby.SentMessage.on(a => this.onSendMessage(a));
  }

  private onSendMessage(message: string): void {
    const now = Date.now();
    const f = this.update(message, now);
    if (f || this.lastLogTime + this.option.log_interval_ms < now) {
      this.lastLogTime = now;
      this.log(message, f);
    }
  }

  public update(message: string, now: number): boolean {
    if (this.periods.length == 0) return false;

    const ns = { time: now, length: message.length };
    let changedMax = false;

    for (let p of this.periods) {
      p.chatsPerPeriod++;
      p.wordsPerPeriod += ns.length;
      while (p.index < this.samples.length && this.samples[p.index].time + p.durationMs < now) {
        p.chatsPerPeriod--;
        p.wordsPerPeriod -= this.samples[p.index].length;
        p.index++;
      }
      if (p.chatsPerPeriodMax < p.chatsPerPeriod) {
        p.chatsPerPeriodMax = p.chatsPerPeriod;
        changedMax = true;
      }
      if (p.wordsPerPeriodMax < p.wordsPerPeriod) {
        p.wordsPerPeriodMax = p.wordsPerPeriod;
        changedMax = true;
      }
    }

    this.samples.push(ns);
    const topIndex = this.periods.reduce((p, a) => a.index < p ? a.index : p, 1000000);
    // 時間切れのサンプルが溜まってきたら捨てる
    if (this.samples.length / 2 < topIndex) {
      logger.trace(`gc start len:${this.samples.length}, idx:${topIndex}`);
      this.samples = this.samples.slice(topIndex);
      for (let p of this.periods) {
        p.index -= topIndex;
      }
    }
    return changedMax;
  }

  private log(msg: string, important: boolean) {
    let f = (important ? logger.info : logger.debug).bind(logger);
    f("msg:%s", msg);
    for (let p of this.periods) {
      f("  %s(%dsec) cpp:%d, wpp:%d", p.symbol, (p.durationMs / 1000).toFixed(2), p.chatsPerPeriod, p.wordsPerPeriod);
    }
  }

  getPluginStatus(): string {
    let m = "-- Word Counter --";
    for (let p of this.periods) {
      m +=
        `\n  ${p.symbol}(${(p.durationMs / 1000).toFixed(2)}sec) cpp:${p.chatsPerPeriod}, cppmax:${p.chatsPerPeriodMax} wpp:${p.wordsPerPeriod}, wppmax:${p.wordsPerPeriodMax} `;
    }
    return m;
  }
}
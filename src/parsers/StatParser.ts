export interface StatResult {
  name: string;
  id: number;
  status: StatStatuses;
  score: number;
  rank: number;
  plays: number;
  level: number;
  accuracy: number;
}

export enum StatStatuses {
  None = 0,
  Idle,
  Playing,
  Watching,
  Editing,
  Testing,
  Submitting,
  Modding,
  Multiplayer,
  Multiplaying,
  Afk,
  Unknown,
}

export class StatParser {
  result: StatResult | null = null;
  isParsing: boolean = false;
  get isParsed(): boolean {
    return !this.isParsing && this.result != null;
  }
  constructor() { }

  feedLine(message: string): boolean {
    const line1 = message.match(/Stats for \((.+)\)\[https:\/\/osu\.ppy\.sh\/u\/(\d+)\]( is (.+))?:/);
    if (line1) {
      this.result = {
        name: line1[1],
        id: parseInt(line1[2]),
        status: StatStatuses.None,
        score: 0,
        rank: 0,
        plays: 0,
        level: 0,
        accuracy: 0
      }
      const statStr = line1[4];
      for (let i = 0; i in StatStatuses; i++) {
        const st = i as StatStatuses;
        if (statStr == StatStatuses[st]) {
          this.result.status = st;
          break;
        }
      }
      this.isParsing = true;
      return true;
    }
    if (this.result == null) return false;

    const line2 = message.match(/Score:\s+([\d,]+)\s+\(#(\d+)\)/);
    if (line2) {
      this.result.score = parseInt(line2[1].replace(/,/g, ""));
      this.result.rank = parseInt(line2[2]);
      return true;
    }

    const line3 = message.match(/Plays:\s+(\d+)\s+\(lv(\d+)\)/);
    if (line3) {
      this.result.plays = parseInt(line3[1]);
      this.result.level = parseInt(line3[2]);
      return true;
    }

    const line4 = message.match(/Accuracy: ([\d.]+)%/);
    if (line4) {
      this.result.accuracy = parseFloat(line4[1]);
      this.isParsing = false;
      return true;
    }

    return false;
  }
}

export function IsStatResponse(message: string) {
  return message.match(/^Stats for \(|Score:|Plays:|Accuracy:/);
}
export class StatResult {
  name: string;
  id: number;
  status: StatStatuses;
  score: number;
  rank: number;
  plays: number;
  level: number;
  accuracy: number;
  date: number;
  constructor(name: string, id: number, status: StatStatuses, score: number = 0, rank: number = 0, plays: number = 0, level: number = 0, accuracy: number = 0, date: number = 0) {
    this.name = name;
    this.id = id;
    this.status = status;
    this.score = score;
    this.rank = rank;
    this.plays = plays;
    this.level = level;
    this.accuracy = accuracy;
    this.date = date;
  }
  toString(): string {
    return `Stats for (${this.name})[https://osu.ppy.sh/u/${this.id}]${this.status === StatStatuses.None ? '' : ` is ${StatStatuses[this.status]}`}:
Score:    ${this.score} (#${this.rank})
Plays:    ${this.plays} (lv${this.level})
Accuracy: ${this.accuracy}%`;
  }
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
    return !this.isParsing && this.result !== null;
  }

  feedLine(message: string): boolean {
    const line1 = message.match(/Stats for \((.+)\)\[https:\/\/osu\.ppy\.sh\/u\/(\d+)\]( is (.+))?:/);
    if (line1) {
      this.result = new StatResult(line1[1], parseInt(line1[2]), StatStatuses.None);
      const statStr = line1[4];
      for (let i = 0; i in StatStatuses; i++) {
        const st = i as StatStatuses;
        if (statStr === StatStatuses[st]) {
          this.result.status = st;
          break;
        }
      }
      this.isParsing = true;
      return true;
    }
    if (this.result === null) return false;

    const line2 = message.match(/Score:\s+([\d,]+)\s+\(#(\d+)\)/);
    if (line2) {
      this.result.score = parseInt(line2[1].replace(/,/g, ''));
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
      this.result.date = Date.now();
      this.isParsing = false;
      return true;
    }

    return false;
  }
}

export function IsStatResponse(message: string) {
  return message.match(/^Stats for \(|Score:|Plays:|Accuracy:/);
}

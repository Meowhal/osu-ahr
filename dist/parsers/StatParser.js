"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsStatResponse = exports.StatParser = exports.StatStatuses = exports.StatResult = void 0;
class StatResult {
    constructor(name, id, status, score = 0, rank = 0, plays = 0, level = 0, accuracy = 0, date = 0) {
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
    toString() {
        return `Stats for (${this.name})[https://osu.ppy.sh/u/${this.id}]${this.status === StatStatuses.None ? '' : ` is ${StatStatuses[this.status]}`}:
Score:    ${this.score} (#${this.rank})
Plays:    ${this.plays} (lv${this.level})
Accuracy: ${this.accuracy}%`;
    }
}
exports.StatResult = StatResult;
var StatStatuses;
(function (StatStatuses) {
    StatStatuses[StatStatuses["None"] = 0] = "None";
    StatStatuses[StatStatuses["Idle"] = 1] = "Idle";
    StatStatuses[StatStatuses["Playing"] = 2] = "Playing";
    StatStatuses[StatStatuses["Watching"] = 3] = "Watching";
    StatStatuses[StatStatuses["Editing"] = 4] = "Editing";
    StatStatuses[StatStatuses["Testing"] = 5] = "Testing";
    StatStatuses[StatStatuses["Submitting"] = 6] = "Submitting";
    StatStatuses[StatStatuses["Modding"] = 7] = "Modding";
    StatStatuses[StatStatuses["Multiplayer"] = 8] = "Multiplayer";
    StatStatuses[StatStatuses["Multiplaying"] = 9] = "Multiplaying";
    StatStatuses[StatStatuses["Afk"] = 10] = "Afk";
    StatStatuses[StatStatuses["Unknown"] = 11] = "Unknown";
})(StatStatuses = exports.StatStatuses || (exports.StatStatuses = {}));
class StatParser {
    constructor() {
        this.result = null;
        this.isParsing = false;
    }
    get isParsed() {
        return !this.isParsing && this.result !== null;
    }
    feedLine(message) {
        const line1 = message.match(/Stats for \((.+)\)\[https:\/\/osu\.ppy\.sh\/u\/(\d+)\]( is (.+))?:/);
        if (line1) {
            this.result = new StatResult(line1[1], parseInt(line1[2]), StatStatuses.None);
            const statStr = line1[4];
            for (let i = 0; i in StatStatuses; i++) {
                const st = i;
                if (statStr === StatStatuses[st]) {
                    this.result.status = st;
                    break;
                }
            }
            this.isParsing = true;
            return true;
        }
        if (this.result === null)
            return false;
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
exports.StatParser = StatParser;
function IsStatResponse(message) {
    return message.match(/^Stats for \(|Score:|Plays:|Accuracy:/);
}
exports.IsStatResponse = IsStatResponse;
//# sourceMappingURL=StatParser.js.map
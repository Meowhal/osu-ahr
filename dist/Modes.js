"use strict";
/**
 * ScoreMode や TeamMode などを定義する
 * 変換用メソッドの提供方法などの利便性を考え、enumやunionではなくクラスとして提供する
 * !mp set, !mp settings, ヒストリー、webapiの譜面情報での利用を想定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mod = exports.Team = exports.PlayMode = exports.TeamMode = exports.ScoreMode = void 0;
class Mode {
    constructor(value, name, aliases = []) {
        this.type = '';
        this.value = value;
        this.name = name;
        this.aliases = new Set(aliases.concat(value, name).map(v => Mode.normalize(v)));
    }
    /**
       * value,name,aliases と一致するか比較する
       * @param normalizedValue 検査対象文字列、 前提：標準化済みの文字列を使用すること
       * @returns
       */
    _match(normalizedValue) {
        return this.aliases.has(normalizedValue);
    }
    match(value) {
        return this.aliases.has(Mode.normalize(value));
    }
    /**
       * 比較しやすい表現に変換する
       * スペースとハイフンを取り除き、小文字にする
       * @param v
       * @returns
       */
    static normalize(v) {
        return v.replace(/[ -]/g, '').toLowerCase();
    }
    static _from(value, values, defaultMode, throwsIfFailed, tag) {
        const nv = Mode.normalize(value);
        for (const m of values) {
            if (m._match(nv)) {
                return m;
            }
        }
        if (throwsIfFailed) {
            throw new Error(`Failed to parse ${value}`);
        }
        else {
            return defaultMode;
        }
    }
    toString() {
        return this.name;
    }
}
class ScoreMode extends Mode {
    constructor(value, name, aliases = []) {
        super(value.toString(), name, aliases);
        this.type = 'ScoreMode';
        ScoreMode.Values.push(this);
    }
    static from(value, throwsIfFailed = false) {
        return Mode._from(value, ScoreMode.Values, ScoreMode.Score, throwsIfFailed, 'ScoreMode');
    }
}
exports.ScoreMode = ScoreMode;
ScoreMode.Values = [];
ScoreMode.Score = new ScoreMode(0, 'Score');
ScoreMode.Accuracy = new ScoreMode(1, 'Accuracy');
ScoreMode.Combo = new ScoreMode(2, 'Combo');
ScoreMode.ScoreV2 = new ScoreMode(3, 'ScoreV2');
class TeamMode extends Mode {
    constructor(value, name, aliases = []) {
        super(value.toString(), name, aliases);
        this.type = 'TeamMode';
        TeamMode.Values.push(this);
    }
    static from(value, throwsIfFailed = false) {
        return Mode._from(value, TeamMode.Values, TeamMode.HeadToHead, throwsIfFailed, 'TeamMode');
    }
    isTeamMatch() {
        return this === TeamMode.TeamVs || this === TeamMode.TagTeamVs;
    }
}
exports.TeamMode = TeamMode;
TeamMode.Values = [];
TeamMode.HeadToHead = new TeamMode(0, 'HeadToHead'); // historyのhead-to-headはnormalizeで対応済み
TeamMode.TagCoop = new TeamMode(1, 'TagCoop');
TeamMode.TeamVs = new TeamMode(2, 'TeamVs');
TeamMode.TagTeamVs = new TeamMode(3, 'TagTeamVs');
class PlayMode extends Mode {
    constructor(value, name, officialName, aliases = []) {
        super(value.toString(), name, aliases);
        this.type = 'PlayMode';
        this.id = typeof value === 'number' ? value : parseInt(value);
        this.officialName = officialName;
        PlayMode.Values.push(this);
    }
    static from(value, throwsIfFailed = false) {
        return Mode._from(value, PlayMode.Values, PlayMode.Osu, throwsIfFailed, 'PlayMode');
    }
}
exports.PlayMode = PlayMode;
PlayMode.Values = [];
PlayMode.Osu = new PlayMode(0, 'Osu', 'osu!');
PlayMode.Taiko = new PlayMode(1, 'Taiko', 'osu!taiko');
PlayMode.CatchTheBeat = new PlayMode(2, 'CatchTheBeat', 'osu!catch', ['fruits', 'catch', 'fruit']);
PlayMode.OsuMania = new PlayMode(3, 'OsuMania', 'osu!mania', ['mania']);
class Team extends Mode {
    constructor(value, name, aliases = []) {
        super(value.toString(), name, aliases);
        this.type = 'Team';
        Team.Values.push(this);
    }
    static from(value, throwsIfFailed = false) {
        return Mode._from(value, Team.Values, Team.Red, throwsIfFailed, 'Team');
    }
}
exports.Team = Team;
Team.Values = [];
Team.None = new Team('none', 'None');
Team.Red = new Team('red', 'Red');
Team.Blue = new Team('blue', 'Blue');
class Mod extends Mode {
    constructor(value, name, isGlobalMod, aliases = []) {
        super(value.toString(), name, aliases);
        this.type = 'Mod';
        Mod.Values.push(this);
        this.isGlobalMod = isGlobalMod;
    }
    static from(value, throwsIfFailed = false) {
        return Mode._from(value, Mod.Values, Mod.None, throwsIfFailed, 'Mod');
    }
    static parseMods(str) {
        // アルファベット, 数字, ハイフン（co-op用）のまとまりに分解する
        const arrMods = str.match(/[a-zA-Z0-9-]+/g)?.map(v => Mod.from(v));
        if (arrMods) {
            const setMods = new Set(arrMods);
            return Mod.removeInvalidCombinations(setMods);
        }
        else {
            return [];
        }
    }
    static removeInvalidCombinations(mods) {
        const set = mods instanceof Set ? mods : new Set(mods);
        if (set.has(Mod.Freemod)) {
            for (const m of set) {
                if (!m.isGlobalMod) {
                    set.delete(m);
                }
            }
        }
        if (set.has(Mod.Easy)) {
            set.delete(Mod.HardRock);
        }
        if (set.has(Mod.NoFail)) {
            set.delete(Mod.SuddenDeath);
            set.delete(Mod.Relax);
            set.delete(Mod.Relax2);
        }
        if (set.has(Mod.HalfTime)) {
            set.delete(Mod.DoubleTime);
            set.delete(Mod.Nightcore);
        }
        if (set.has(Mod.SuddenDeath)) {
            set.delete(Mod.Relax);
            set.delete(Mod.Relax2);
        }
        if (set.has(Mod.Nightcore)) {
            set.add(Mod.DoubleTime);
        }
        if (set.has(Mod.Relax)) {
            set.delete(Mod.Relax2);
        }
        set.delete(Mod.None);
        return [...set];
    }
}
exports.Mod = Mod;
Mod.Values = [];
Mod.None = new Mod('none', 'None', true);
Mod.Freemod = new Mod('Freemod', 'Freemod', true);
Mod.NoFail = new Mod('nf', 'NoFail', false);
Mod.Easy = new Mod('ez', 'Easy', false);
Mod.Hidden = new Mod('hd', 'Hidden', false);
Mod.HardRock = new Mod('hr', 'HardRock', false);
Mod.SuddenDeath = new Mod('sd', 'SuddenDeath', false);
Mod.DoubleTime = new Mod('dt', 'DoubleTime', true, ['double']);
Mod.Nightcore = new Mod('nc', 'Nightcore', true);
Mod.Relax = new Mod('relax', 'Relax', false, ['RX']);
Mod.HalfTime = new Mod('ht', 'HalfTime', true);
Mod.Flashlight = new Mod('fl', 'Flashlight', false);
Mod.SpunOut = new Mod('so', 'SpunOut', false);
Mod.Relax2 = new Mod('ap', 'Relax2', false, ['auto pilot']);
Mod.FadeIn = new Mod('fi', 'FadeIn', false);
Mod.Random = new Mod('rd', 'Random', true);
Mod.KeyCoop = new Mod('co-op', 'KeyCoop', false);
Mod.Mirror = new Mod('mr', 'Mirror', false);
Mod.Key1 = new Mod('1k', 'Key1', false);
Mod.Key2 = new Mod('2k', 'Key2', false);
Mod.Key3 = new Mod('3k', 'Key3', false);
Mod.Key4 = new Mod('4k', 'Key4', false);
Mod.Key5 = new Mod('5k', 'Key5', false);
Mod.Key6 = new Mod('6k', 'Key6', false);
Mod.Key7 = new Mod('7k', 'Key7', false);
Mod.Key8 = new Mod('8k', 'Key8', false);
Mod.Key9 = new Mod('9k', 'Key9', false);
/* memo
  !mp settings mod と !mp mods のMOD表記
  none なにもない場合は項目自体なし
  [!mp mods のパラメータ] = [レスポンスでの表記](追記)
  Freemod = Freemod
  nf = NoFail
  ez = Easy
  hd = Hidden
  hr = HardRock
  sd = SuddenDeath
  dt = DoubleTime
  nc = DoubleTime, Nightcore
  relax(rx in history) = Relax
  ht = HalfTime
  fl = Flashlight
  so = SpunOut
  ap = Relax2 (autopilot)

  mania
  1k = Key1
  2k, 3k ...
  9k = Key9
  fi = FadeIn
  rd = Random // historyでは無視される
  co-op = KeyCoop // historyでは無視される
  mr = Mirror

  historyでは省略形が使用される
  historyでは freemod と noneの区別がつかない。doubleでもfreemodありなしがわからない

*/ 
//# sourceMappingURL=Modes.js.map
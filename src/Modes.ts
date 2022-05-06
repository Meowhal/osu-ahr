/**
 * ScoreMode や TeamMode などを定義する
 * 変換用メソッドの提供方法などの利便性を考え、enumやunionではなくクラスとして提供する
 * !mp set, !mp settings, ヒストリー、webapiの譜面情報での利用を想定
 */

class Mode {
  readonly value: string; // !mp set などで利用する数値/文字列
  readonly name: string; // わかりやすい文字列表現
  readonly aliases: Set<string>; // osu内での表記ゆれに対応する
  readonly type: string = '';

  protected constructor(value: string, name: string, aliases: string[] = []) {
    this.value = value;
    this.name = name;
    this.aliases = new Set<string>(aliases.concat(value, name).map(v => Mode.normalize(v)));
  }

  /**
     * value,name,aliases と一致するか比較する
     * @param normalizedValue 検査対象文字列、 前提：標準化済みの文字列を使用すること
     * @returns
     */
  protected _match(normalizedValue: string): boolean {
    return this.aliases.has(normalizedValue);
  }

  match(value: string): boolean {
    return this.aliases.has(Mode.normalize(value));
  }

  /**
     * 比較しやすい表現に変換する
     * スペースとハイフンを取り除き、小文字にする
     * @param v
     * @returns
     */
  protected static normalize(v: string): string {
    return v.replace(/[ -]/g, '').toLowerCase();
  }

  protected static _from<T extends Mode>(value: string, values: T[], defaultMode: T, throwsIfFailed: boolean, tag: string): T {
    const nv = Mode.normalize(value);
    for (const m of values) {
      if (m._match(nv)) {
        return m;
      }
    }
    if (throwsIfFailed) {
      throw new Error(`Failed to parse ${value}`);
    } else {
      return defaultMode;
    }

  }

  toString() {
    return this.name;
  }
}

export class ScoreMode extends Mode {
  static readonly Values: ScoreMode[] = [];

  static readonly Score = new ScoreMode(0, 'Score');
  static readonly Accuracy = new ScoreMode(1, 'Accuracy');
  static readonly Combo = new ScoreMode(2, 'Combo');
  static readonly ScoreV2 = new ScoreMode(3, 'ScoreV2');

  readonly type: 'ScoreMode' = 'ScoreMode';

  protected constructor(value: string | number, name: string, aliases: string[] = []) {
    super(value.toString(), name, aliases);
    ScoreMode.Values.push(this);
  }

  static from(value: string, throwsIfFailed: boolean = false) {
    return Mode._from(value, ScoreMode.Values, ScoreMode.Score, throwsIfFailed, 'ScoreMode');
  }
}

export class TeamMode extends Mode {
  static readonly Values: TeamMode[] = [];

  static readonly HeadToHead = new TeamMode(0, 'HeadToHead'); // historyのhead-to-headはnormalizeで対応済み
  static readonly TagCoop = new TeamMode(1, 'TagCoop');
  static readonly TeamVs = new TeamMode(2, 'TeamVs');
  static readonly TagTeamVs = new TeamMode(3, 'TagTeamVs');

  readonly type: 'TeamMode' = 'TeamMode';

  protected constructor(value: string | number, name: string, aliases: string[] = []) {
    super(value.toString(), name, aliases);
    TeamMode.Values.push(this);
  }

  static from(value: string, throwsIfFailed: boolean = false) {
    return Mode._from(value, TeamMode.Values, TeamMode.HeadToHead, throwsIfFailed, 'TeamMode');
  }

  isTeamMatch(): boolean {
    return this === TeamMode.TeamVs || this === TeamMode.TagTeamVs;
  }
}

export class PlayMode extends Mode {
  static readonly Values: PlayMode[] = [];

  static readonly Osu = new PlayMode(0, 'Osu', 'osu!');
  static readonly Taiko = new PlayMode(1, 'Taiko', 'osu!taiko');
  static readonly CatchTheBeat = new PlayMode(2, 'CatchTheBeat', 'osu!catch', ['fruits', 'catch', 'fruit']);
  static readonly OsuMania = new PlayMode(3, 'OsuMania', 'osu!mania', ['mania']);

  readonly type: 'PlayMode' = 'PlayMode';
  readonly id: number;
  readonly officialName: string;

  protected constructor(value: string | number, name: string, officialName: string, aliases: string[] = []) {
    super(value.toString(), name, aliases);
    this.id = typeof value === 'number' ? value : parseInt(value);
    this.officialName = officialName;
    PlayMode.Values.push(this);
  }

  static from(value: string, throwsIfFailed: boolean = false) {
    return Mode._from(value, PlayMode.Values, PlayMode.Osu, throwsIfFailed, 'PlayMode');
  }
}

export class Team extends Mode {
  static readonly Values: Team[] = [];

  static readonly None = new Team('none', 'None');
  static readonly Red = new Team('red', 'Red');
  static readonly Blue = new Team('blue', 'Blue');

  readonly type: 'Team' = 'Team';

  protected constructor(value: string | number, name: string, aliases: string[] = []) {
    super(value.toString(), name, aliases);
    Team.Values.push(this);
  }

  static from(value: string, throwsIfFailed: boolean = false) {
    return Mode._from(value, Team.Values, Team.Red, throwsIfFailed, 'Team');
  }
}

export class Mod extends Mode {
  static readonly Values: Mod[] = [];

  static readonly None = new Mod('none', 'None', true);
  static readonly Freemod = new Mod('Freemod', 'Freemod', true);
  static readonly NoFail = new Mod('nf', 'NoFail', false);
  static readonly Easy = new Mod('ez', 'Easy', false);
  static readonly Hidden = new Mod('hd', 'Hidden', false);
  static readonly HardRock = new Mod('hr', 'HardRock', false);
  static readonly SuddenDeath = new Mod('sd', 'SuddenDeath', false);
  static readonly DoubleTime = new Mod('dt', 'DoubleTime', true, ['double']);
  static readonly Nightcore = new Mod('nc', 'Nightcore', true);
  static readonly Relax = new Mod('relax', 'Relax', false, ['RX']);
  static readonly HalfTime = new Mod('ht', 'HalfTime', true);
  static readonly Flashlight = new Mod('fl', 'Flashlight', false);
  static readonly SpunOut = new Mod('so', 'SpunOut', false);
  static readonly Relax2 = new Mod('ap', 'Relax2', false, ['auto pilot']);
  static readonly FadeIn = new Mod('fi', 'FadeIn', false);
  static readonly Random = new Mod('rd', 'Random', true);
  static readonly KeyCoop = new Mod('co-op', 'KeyCoop', false);
  static readonly Mirror = new Mod('mr', 'Mirror', false);
  static readonly Key1 = new Mod('1k', 'Key1', false);
  static readonly Key2 = new Mod('2k', 'Key2', false);
  static readonly Key3 = new Mod('3k', 'Key3', false);
  static readonly Key4 = new Mod('4k', 'Key4', false);
  static readonly Key5 = new Mod('5k', 'Key5', false);
  static readonly Key6 = new Mod('6k', 'Key6', false);
  static readonly Key7 = new Mod('7k', 'Key7', false);
  static readonly Key8 = new Mod('8k', 'Key8', false);
  static readonly Key9 = new Mod('9k', 'Key9', false);

  readonly isGlobalMod: boolean;
  readonly type: 'Mod' = 'Mod';

  protected constructor(value: string | number, name: string, isGlobalMod: boolean, aliases: string[] = []) {
    super(value.toString(), name, aliases);
    Mod.Values.push(this);
    this.isGlobalMod = isGlobalMod;
  }

  static from(value: string, throwsIfFailed: boolean = false) {
    return Mode._from(value, Mod.Values, Mod.None, throwsIfFailed, 'Mod');
  }

  static parseMods(str: string): Mod[] {
    // アルファベット, 数字, ハイフン（co-op用）のまとまりに分解する
    const arrMods = str.match(/[a-zA-Z0-9-]+/g)?.map(v => Mod.from(v));
    if (arrMods) {
      const setMods = new Set(arrMods);
      return Mod.removeInvalidCombinations(setMods);
    } else {
      return [];
    }
  }

  static removeInvalidCombinations(mods: Mod[] | Set<Mod>): Mod[] {
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
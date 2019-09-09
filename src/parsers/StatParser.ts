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
  None,
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
  parsed: boolean = false;
}

export function IsStatResponse(message:string) {
  return message.match(/^Stats for \(|Score:|Plays:|Accuracy:/);
}
/*
Stats for (Jason)[https://osu.ppy.sh/u/7342098] is Multiplaying:
Score:    18,163,888,782 (#1631)
Plays:    78245 (lv100)
Accuracy: 97.36%
Stats for (horcrux18)[https://osu.ppy.sh/u/8778911] is Afk:
Score:    584,565,786 (#260177)
Plays:    5695 (lv64)
Accuracy: 86.94%
Stats for (Blaisou)[https://osu.ppy.sh/u/11905055] is Multiplaying:
Score:    891,897,785 (#227793)
Plays:    7570 (lv76)
Accuracy: 91.12%
Stats for (Syncro)[https://osu.ppy.sh/u/6565563] is Afk:
Score:    5,172,775,696 (#104595)
Plays:    18912 (lv99)
Accuracy: 96.95%
Stats for (Shxdez)[https://osu.ppy.sh/u/12908647] is Multiplayer:
Score:    671,579,513 (#275114)
Plays:    4659 (lv67)
Accuracy: 94.09%
Stats for (Shmetzo)[https://osu.ppy.sh/u/9379960] is Multiplayer:
Score:    1,910,531,522 (#71393)
Plays:    17823 (lv97)
Accuracy: 98.24%
Stats for (MrRayeku)[https://osu.ppy.sh/u/4698952] is Multiplaying:
Score:    8,098,217,307 (#20927)
Plays:    16330 (lv100)
Accuracy: 98.64%
Stats for (bigsk8man)[https://osu.ppy.sh/u/6316337] is Afk:
Score:    2,175,535,579 (#63250)
Plays:    18485 (lv96)
Accuracy: 97.18%
Stats for (gviz)[https://osu.ppy.sh/u/15145414] is Multiplayer:
Score:    00 (#0)
Plays:    7 (lv2)
Accuracy: 0%
Stats for (Arkanipro)[https://osu.ppy.sh/u/8797004] is Multiplaying:
Score:    37,208,770,812 (#16631)
Plays:    36172 (lv100)
Accuracy: 99.08%
Stats for (tonix123)[https://osu.ppy.sh/u/13635881] is Afk:
Score:    1,726,962,234 (#45274)
Plays:    11763 (lv94)
Accuracy: 94.17%
Stats for (RaxPepper)[https://osu.ppy.sh/u/13306836] is Multiplayer:
Score:    11,662,345 (#1197847)
Plays:    207 (lv16)
Accuracy: 83.21%
Stats for (Waterty)[https://osu.ppy.sh/u/6965563] is Multiplayer:
Score:    3,807,679,292 (#119188)
Plays:    23601 (lv99)
Accuracy: 91.51%
Stats for (ErickXDO)[https://osu.ppy.sh/u/11936696] is Multiplayer:
Score:    7,853,683,502 (#48511)
Plays:    18133 (lv100)
Accuracy: 98.53%
Stats for (FrozenWaterr)[https://osu.ppy.sh/u/14107836] is Multiplayer:
Score:    6,526,182,420 (#86671)
Plays:    9201 (lv99)
Accuracy: 97.67%
Stats for (KeIIIa)[https://osu.ppy.sh/u/11341955] is Multiplaying:
Score:    1,893,913,322 (#158867)
Plays:    7415 (lv94)
Accuracy: 97.92%
Stats for (Slickjam)[https://osu.ppy.sh/u/8523058] is Multiplayer:
Score:    6,743,588,545 (#12551)
Plays:    21836 (lv100)
Accuracy: 96.99%
Stats for (MaxxBurn)[https://osu.ppy.sh/u/4513159] is Multiplayer:
Score:    3,668,850,265 (#83989)
Plays:    9666 (lv97)
Accuracy: 96.64%
Stats for (Angel Arrow)[https://osu.ppy.sh/u/1970239] is Testing:
Score:    59,315,895,109 (#1006)
Plays:    104962 (lv102)
Accuracy: 98.16%
Stats for (d_am_n)[https://osu.ppy.sh/u/8296214]:
Score:    4,701,502,892 (#0)
Plays:    6517 (lv96)
Accuracy: 94.24%
Stats for (Foreskin)[https://osu.ppy.sh/u/3760263]:
Score:    00 (#0)
Plays:    1 (lv1)
Accuracy: 0.00%
*/
import { assert } from 'chai';
import { Teams } from '..';
import { MpSettingsParser } from "../parsers";
import log4js from "log4js";

describe("MpSettingsParserTest", function () {
  before(function () {
    log4js.configure("config/log_mocha_silent.json");
  });
  it("mp settings parse test", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: 5* (´・ω・`) host rotate, History: https://osu.ppy.sh/mp/53084403");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/853167 Silent Siren - Hachigatsu no Yoru [August]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 5");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gnsksz          [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  Not Ready https://osu.ppy.sh/u/10351992 Discuzz         [Hidden, DoubleTime]");
    assert.isFalse(b);
    b = p.feedLine("Slot 3  Not Ready https://osu.ppy.sh/u/13745792 Seidosam        ");
    assert.isFalse(b);
    b = p.feedLine("Slot 4  Not Ready https://osu.ppy.sh/u/7354213 Suitaksas       ");
    assert.isFalse(b);
    b = p.feedLine("Slot 5  Not Ready https://osu.ppy.sh/u/13585495 -Kasell         ");
    assert.isTrue(b);

    assert.equal(p.name, "5* (´・ω・`) host rotate");
    assert.equal(p.history, "https://osu.ppy.sh/mp/53084403");
    assert.equal(p.beatmapUrl, "https://osu.ppy.sh/b/853167");
    assert.equal(p.beatmapTitle, "Silent Siren - Hachigatsu no Yoru [August]");
    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "Freemod");
    assert.equal(p.players.length, 5);
    assert.equal(p.players[0].id, "gnsksz");
    assert.equal(p.players[1].id, "Discuzz");
    assert.equal(p.players[2].id, "Seidosam");
    assert.equal(p.players[3].id, "Suitaksas");
    assert.equal(p.players[4].id, "-Kasell");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, false);

    assert.equal(p.players[0].team, Teams.None);
    assert.equal(p.players[1].team, Teams.None);
    assert.equal(p.players[2].team, Teams.None);
    assert.equal(p.players[3].team, Teams.None);
    assert.equal(p.players[4].team, Teams.None);
    assert.equal(p.players[0].options, "Host");
    assert.equal(p.players[1].options, "Hidden, DoubleTime");
    assert.equal(p.players[2].options, "");
    assert.equal(p.players[3].options, "");
    assert.equal(p.players[4].options, "");
  });

  it("mp settings parse with space test", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: 5* (´・ω・`) host rotate, History: https://osu.ppy.sh/mp/53084403");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/853167 Silent Siren - Hachigatsu no Yoru [August]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 5");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gns ksz         [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  Not Ready https://osu.ppy.sh/u/10351992 Discuzz         [Hidden, DoubleTime]");
    assert.isFalse(b);
    b = p.feedLine("Slot 3  Not Ready https://osu.ppy.sh/u/13745792 Seido sam       ");
    assert.isFalse(b);
    b = p.feedLine("Slot 4  Not Ready https://osu.ppy.sh/u/7354213 Suitaksas       ");
    assert.isFalse(b);
    b = p.feedLine("Slot 5  Not Ready https://osu.ppy.sh/u/13585495 -Kasell         ");
    assert.isTrue(b);

    assert.equal(p.name, "5* (´・ω・`) host rotate");
    assert.equal(p.history, "https://osu.ppy.sh/mp/53084403");
    assert.equal(p.beatmapUrl, "https://osu.ppy.sh/b/853167");
    assert.equal(p.beatmapTitle, "Silent Siren - Hachigatsu no Yoru [August]");
    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "Freemod");
    assert.equal(p.players.length, 5);
    assert.equal(p.players[0].id, "gns ksz");
    assert.equal(p.players[1].id, "Discuzz");
    assert.equal(p.players[2].id, "Seido sam");
    assert.equal(p.players[3].id, "Suitaksas");
    assert.equal(p.players[4].id, "-Kasell");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, false);
    assert.equal(p.players[0].options, "Host");
    assert.equal(p.players[0].team, Teams.None);

    assert.equal(p.players[1].options, "Hidden, DoubleTime");
  });

  it("mp settings parse with blackets test", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: 5* (´・ω・`) host rotate, History: https://osu.ppy.sh/mp/53084403");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/853167 Silent Siren - Hachigatsu no Yoru [August]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 5");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gnsksz[aueie]   [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  Not Ready https://osu.ppy.sh/u/10351992 Discuzz [as]v   [Hidden, DoubleTime]");
    assert.isFalse(b);
    b = p.feedLine("Slot 3  Not Ready https://osu.ppy.sh/u/13745792 Sedo sam [quit] ");
    assert.isFalse(b);
    b = p.feedLine("Slot 4  Not Ready https://osu.ppy.sh/u/7354213 Suit[__]aksas   ");
    assert.isFalse(b);
    b = p.feedLine("Slot 5  Not Ready https://osu.ppy.sh/u/13585495 -K][][a sell    ");
    assert.isTrue(b);

    assert.equal(p.name, "5* (´・ω・`) host rotate");
    assert.equal(p.history, "https://osu.ppy.sh/mp/53084403");
    assert.equal(p.beatmapUrl, "https://osu.ppy.sh/b/853167");
    assert.equal(p.beatmapTitle, "Silent Siren - Hachigatsu no Yoru [August]");
    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "Freemod");
    assert.equal(p.players.length, 5);
    assert.equal(p.players[0].id, "gnsksz[aueie]");
    assert.equal(p.players[1].id, "Discuzz [as]v");
    assert.equal(p.players[2].id, "Sedo sam [quit]");
    assert.equal(p.players[3].id, "Suit[__]aksas");
    assert.equal(p.players[4].id, "-K][][a sell");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, false);
    assert.equal(p.players[0].options, "Host");
    assert.equal(p.players[1].options, "Hidden, DoubleTime");
  });


  it("mp settings none orderd slot test", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: 5* (´・ω・`) host rotate, History: https://osu.ppy.sh/mp/53084403");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/853167 Silent Siren - Hachigatsu no Yoru [August]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 5");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gnsksz          [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  Not Ready https://osu.ppy.sh/u/10351992 Discuzz         [Hidden, DoubleTime]");
    assert.isFalse(b);
    b = p.feedLine("Slot 6  Not Ready https://osu.ppy.sh/u/13745792 Seidosam        ");
    assert.isFalse(b);
    b = p.feedLine("Slot 9  Not Ready https://osu.ppy.sh/u/7354213 Suitaksas       ");
    assert.isFalse(b);
    b = p.feedLine("Slot 12  Not Ready https://osu.ppy.sh/u/13585495 -Kasell         ");
    assert.isTrue(b);

    assert.equal(p.name, "5* (´・ω・`) host rotate");
    assert.equal(p.history, "https://osu.ppy.sh/mp/53084403");
    assert.equal(p.beatmapUrl, "https://osu.ppy.sh/b/853167");
    assert.equal(p.beatmapTitle, "Silent Siren - Hachigatsu no Yoru [August]");
    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "Freemod");
    assert.equal(p.players.length, 5);
    assert.equal(p.players[0].id, "gnsksz");
    assert.equal(p.players[1].id, "Discuzz");
    assert.equal(p.players[2].id, "Seidosam");
    assert.equal(p.players[3].id, "Suitaksas");
    assert.equal(p.players[4].id, "-Kasell");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, false);
    assert.equal(p.players[0].options, "Host");
    assert.equal(p.players[1].options, "Hidden, DoubleTime");
  });

  it("mp settings long name (15 characters)", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: 4-5* auto host rotaion, History: https://osu.ppy.sh/mp/54581109");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/1418503 tofubeats - CANDYYYLAND feat LIZ - Pa's Lam System Remix [Nathan's Extra]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 8");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/x 0123456789abcde ");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  No Map    https://osu.ppy.sh/u/x ZhiZhaChn [acv] [Hidden]");
    assert.isFalse(b);
    b = p.feedLine("Slot 3  Not Ready https://osu.ppy.sh/u/1 Hot Cocoa       ");
    assert.isFalse(b);
    b = p.feedLine("Slot 4  Not Ready https://osu.ppy.sh/u/2 POv2II          ");
    assert.isFalse(b);
    b = p.feedLine("Slot 6  Not Ready https://osu.ppy.sh/u/3 MONTBLANC_heart [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 8  No Map    https://osu.ppy.sh/u/4 NewRecruit_Jack ");
    assert.isFalse(b);
    b = p.feedLine("Slot 9  No Map    https://osu.ppy.sh/u/5 ya nunta        ");
    assert.isFalse(b);
    b = p.feedLine("Slot 16 Not Ready https://osu.ppy.sh/u/6 Jow             [Hidden]");
    assert.isTrue(b);

    assert.equal(p.name, "4-5* auto host rotaion");
    assert.equal(p.history, "https://osu.ppy.sh/mp/54581109");
    assert.equal(p.beatmapUrl, "https://osu.ppy.sh/b/1418503");
    assert.equal(p.beatmapTitle, "tofubeats - CANDYYYLAND feat LIZ - Pa's Lam System Remix [Nathan's Extra]");
    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "Freemod");
    assert.equal(p.players.length, 8);
    assert.equal(p.players[0].id, "0123456789abcde");
    assert.equal(p.players[1].id, "ZhiZhaChn [acv]");
    assert.equal(p.players[2].id, "Hot Cocoa");
    assert.equal(p.players[3].id, "POv2II");
    assert.equal(p.players[4].id, "MONTBLANC_heart");
    assert.equal(p.players[0].isHost, false);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, true);

    assert.equal(p.players[1].options, "Hidden");
    assert.equal(p.players[4].options, "Host");
    assert.equal(p.players[7].options, "Hidden");
  });

  it("mp settings host and mods", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: ahr test, History: https://osu.ppy.sh/mp/54598622");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/86920 SID - Ranbu no Melody (TV Size) [Happy's Insane]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: HeadToHead, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: DoubleTime, Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 1");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gnsksz          [Host / Hidden, HardRock]");
    assert.isTrue(b);

    assert.equal(p.teamMode, "HeadToHead");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "DoubleTime, Freemod");
    assert.equal(p.players.length, 1);
    assert.equal(p.players[0].id, "gnsksz");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[0].options, "Host / Hidden, HardRock");
  });

  it("mp settings team", () => {
    const p = new MpSettingsParser();
    let b: boolean = false;

    b = p.feedLine("Room name: ahr test, History: https://osu.ppy.sh/mp/54598622");
    assert.isFalse(b);
    b = p.feedLine("Beatmap: https://osu.ppy.sh/b/86920 SID - Ranbu no Melody (TV Size) [Happy's Insane]");
    assert.isFalse(b);
    b = p.feedLine("Team mode: TeamVs, Win condition: Score");
    assert.isFalse(b);
    b = p.feedLine("Active mods: DoubleTime, Freemod");
    assert.isFalse(b);
    b = p.feedLine("Players: 1");
    assert.isFalse(b);
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gnsksz          [Host / Team Blue / Hidden, HardRock]");
    assert.isTrue(b);

    assert.equal(p.teamMode, "TeamVs");
    assert.equal(p.winCondition, "Score");
    assert.equal(p.activeMods, "DoubleTime, Freemod");
    assert.equal(p.players.length, 1);
    assert.equal(p.players[0].id, "gnsksz");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[0].options, "Host / Team Blue / Hidden, HardRock");
    assert.equal(p.players[0].team, Teams.Blue);
  });
});

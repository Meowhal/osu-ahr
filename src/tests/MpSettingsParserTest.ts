import { assert } from 'chai';
import { MpSettingsParser } from "../models";
export function MpSettingsParserTest() {
  it("mp settings parse test", () => {
    const p = new MpSettingsParser();
    let b : boolean = false;
    
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
    assert.equal(p.players[0].options.length, 1);
    assert.equal(p.players[0].options[0], "Host");

    assert.equal(p.players[1].options.length, 2);
    assert.equal(p.players[1].options[0], "Hidden");
    assert.equal(p.players[1].options[1], "DoubleTime");
  });

  it("mp settings parse with space test", () => {
    const p = new MpSettingsParser();
    let b : boolean = false;
    
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
    b = p.feedLine("Slot 1  Not Ready https://osu.ppy.sh/u/8286882 gns ksz          [Host]");
    assert.isFalse(b);
    b = p.feedLine("Slot 2  Not Ready https://osu.ppy.sh/u/10351992 Discuzz         [Hidden, DoubleTime]");
    assert.isFalse(b);
    b = p.feedLine("Slot 3  Not Ready https://osu.ppy.sh/u/13745792 Seido  sam        ");
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
    assert.equal(p.players[2].id, "Seido  sam");
    assert.equal(p.players[3].id, "Suitaksas");
    assert.equal(p.players[4].id, "-Kasell");
    assert.equal(p.players[0].isHost, true);
    assert.equal(p.players[1].isHost, false);
    assert.equal(p.players[2].isHost, false);
    assert.equal(p.players[3].isHost, false);
    assert.equal(p.players[4].isHost, false);
    assert.equal(p.players[0].options.length, 1);
    assert.equal(p.players[0].options[0], "Host");

    assert.equal(p.players[1].options.length, 2);
    assert.equal(p.players[1].options[0], "Hidden");
    assert.equal(p.players[1].options[1], "DoubleTime");
  });

  it("mp settings none orderd slot test", () => {
    const p = new MpSettingsParser();
    let b : boolean = false;
    
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
    assert.equal(p.players[0].options.length, 1);
    assert.equal(p.players[0].options[0], "Host");

    assert.equal(p.players[1].options.length, 2);
    assert.equal(p.players[1].options[0], "Hidden");
    assert.equal(p.players[1].options[1], "DoubleTime");
  });
}

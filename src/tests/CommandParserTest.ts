import { assert } from 'chai';
import { CommandParser, BanchoResponseType } from "../models";

export function CommandParserTest() {
  it("make lobby message parse test", () => {
    const parser = new CommandParser();

    let message = "Created the tournament match https://osu.ppy.sh/mp/52612489 irctestroom";
    let v = parser.ParseMpMakeResponse("BanchoBot", message);
    if (v == null) {
      assert.fail();
    } else {
      assert.equal(v.id, "52612489");
      assert.equal(v.title, "irctestroom");
    }

    message = "Created the tournament match https://osu.ppy.sh/mp/52849259 irctest_room^^";
    v = parser.ParseMpMakeResponse("BanchoBot", message);
    if (v == null) {
      assert.fail();
    } else {
      assert.equal(v.id, "52849259");
      assert.equal(v.title, "irctest_room^^");
    }

    message = "Created the tournament match https://osu.ppy.sh/mp/52849326 irc test room 1";
    v = parser.ParseMpMakeResponse("BanchoBot", message);
    if (v == null) {
      assert.fail();
    } else {
      assert.equal(v.id, "52849326");
      assert.equal(v.title, "irc test room 1");
    }
  });

  it("ParseMPCommandTest", () => {
    const parser = new CommandParser();
    let message = "!mp host xxx";
    let v = parser.ParseMPCommand(message);
    if (v == null) {
      assert.fail();
    } else {
      assert.equal(v.command, "host");
      assert.equal(v.args[0], "xxx");
    }

    message = "!mp make xxx";
    v = parser.ParseMPCommand(message);
    if (v == null) {
      assert.fail();
    } else {
      assert.equal(v.command, "make");
      assert.equal(v.args[0], "xxx");
    }

    message = "xx!mp make xxx";
    v = parser.ParseMPCommand(message);
    if (v != null) {
      assert.fail();
    }
  });

  it("player joined parse test", () => {
    const parser = new CommandParser();
    let message = "Swgciai joined in slot 4.";
    let v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerJoined) {
      assert.equal(v.id, "Swgciai");
      assert.equal(v.slot, 4);
    } else {
      assert.fail();
    }

    message = "Foet_Mnagyo joined in slot 1.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerJoined) {
      assert.equal(v.id, "Foet_Mnagyo");
      assert.equal(v.slot, 1);
    } else {
      assert.fail();
    }

    message = "- Cylcl joined in slot 5.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerJoined) {
      assert.equal(v.id, "- Cylcl");
      assert.equal(v.slot, 5);
    } else {
      assert.fail();
    }
  });

  it("player left parse test", () => {
    const parser = new CommandParser();
    let message = "Swgciai left the game.";
    let v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerLeft) {
      assert.equal(v.id, "Swgciai");
    } else {
      assert.fail();
    }

    message = "Foet_Mnagyo left the game.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerLeft) {
      assert.equal(v.id, "Foet_Mnagyo");
    } else {
      assert.fail();
    }

    message = "- Cylcl left the game.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerLeft) {
      assert.equal(v.id, "- Cylcl");
    } else {
      assert.fail();
    }
  });

  it("map changing test", () => {
    const parser = new CommandParser();
    let message = "Host is changing map...";
    let v = parser.ParseBanchoResponse(message);
    assert.equal(v.type, BanchoResponseType.BeatmapChanging);
  });

  it("map changed test", () => {
    const parser = new CommandParser();
    let message = "Beatmap changed to: Noah - Celestial stinger [apl's EXHAUST] (https://osu.ppy.sh/b/1454083)";
    let v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.BeatmapChanged) {
      assert.equal(v.id, "1454083");
    } else {
      assert.fail();
    }

    message = "Beatmap changed to: Paul Bazooka - DrunkenSteiN [bor's Insane] (https://osu.ppy.sh/b/1913126)";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.BeatmapChanged) {
      assert.equal(v.id, "1913126");
    } else {
      assert.fail();
    }

    message = "Beatmap changed to: supercell - Hoshi ga Matataku Konna Yoru ni [Sharlo's Insane] (https://osu.ppy.sh/b/670743)";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.BeatmapChanged) {
      assert.equal(v.id, "670743");
    } else {
      assert.fail();
    }
  });

  it("host change test", () => {
    const parser = new CommandParser();
    let message = "Swgciai became the host.";
    let v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.HostChanged) {
      assert.equal(v.id, "Swgciai");
    } else {
      assert.fail();
    }

    message = "Foet_Mnagyo became the host.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.HostChanged) {
      assert.equal(v.id, "Foet_Mnagyo");
    } else {
      assert.fail();
    }

    message = "- Cylcl became the host.";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.HostChanged) {
      assert.equal(v.id, "- Cylcl");
    } else {
      assert.fail();
    }
  });

  it("match test", () => {
    const parser = new CommandParser();
    let v = parser.ParseBanchoResponse("The match has started!");
    assert.equal(v.type, BanchoResponseType.MatchStarted);

    let message = "Swgciai finished playing (Score: 18048202, PASSED).";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerFinished) {
      assert.equal(v.id, "Swgciai");
      assert.equal(v.score, 18048202);
      assert.equal(v.isPassed, true);
    } else {
      assert.fail();
    }

    message = "Foet_Mnagyo finished playing (Score: 290043, FAILED).";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerFinished) {
      assert.equal(v.id, "Foet_Mnagyo");
      assert.equal(v.score, 290043);
      assert.equal(v.isPassed, false);
    } else {
      assert.fail();
    }

    message = "- Cylcl finished playing (Score: 2095838, PASSED).";
    v = parser.ParseBanchoResponse(message);
    if (v.type == BanchoResponseType.PlayerFinished) {
      assert.equal(v.id, "- Cylcl");
      assert.equal(v.score, 2095838);
      assert.equal(v.isPassed, true);
    } else {
      assert.fail();
    }

    v = parser.ParseBanchoResponse("The match has finished!");
    assert.equal(v.type, BanchoResponseType.MatchFinished);
  });
}

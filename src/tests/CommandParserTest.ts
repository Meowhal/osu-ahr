import { assert } from 'chai';
import { Teams } from '../Player';
import { parser, BanchoResponseType } from '../parsers/CommandParser';
import tu from './TestUtils';

describe('CommandParserTest', function () {
  before(function () {
    tu.configMochaAsSilent();
  });
  it('make lobby message parse test', () => {
    let message = 'Created the tournament match https://osu.ppy.sh/mp/52612489 irctestroom';
    let v = parser.ParseMpMakeResponse('BanchoBot', message);
    assert.isNotNull(v);
    if (v === null) {
      assert.fail();
    } else {
      assert.equal(v.id, '52612489');
      assert.equal(v.title, 'irctestroom');
    }

    message = 'Created the tournament match https://osu.ppy.sh/mp/52849259 irctest_room^^';
    v = parser.ParseMpMakeResponse('BanchoBot', message);
    if (v === null) {
      assert.fail();
    } else {
      assert.equal(v.id, '52849259');
      assert.equal(v.title, 'irctest_room^^');
    }

    message = 'Created the tournament match https://osu.ppy.sh/mp/52849326 irc test room 1';
    v = parser.ParseMpMakeResponse('BanchoBot', message);
    if (v === null) {
      assert.fail();
    } else {
      assert.equal(v.id, '52849326');
      assert.equal(v.title, 'irc test room 1');
    }
  });

  it('ParseMPCommandTest', () => {
    let message = '!mp host xxx';
    let v = parser.ParseMPCommand(message);
    if (v === null) {
      assert.fail();
    } else {
      assert.equal(v.command, 'host');
      assert.equal(v.arg, 'xxx');
    }

    message = '!mp make xxx';
    v = parser.ParseMPCommand(message);
    if (v === null) {
      assert.fail();
    } else {
      assert.equal(v.command, 'make');
      assert.equal(v.arg, 'xxx');
    }

    message = 'xx!mp make xxx';
    v = parser.ParseMPCommand(message);
    if (v !== null) {
      assert.fail();
    }
  });

  describe('ParseBanchoResponse tests', () => {
    it('player joined parse test', () => {
      let message = 'Swgciai joined in slot 4.';
      let v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], 'Swgciai');
      assert.equal(v.params[1], 4);
      assert.equal(v.params[2], Teams.None);

      message = 'Foet_Mnagyo joined in slot 1.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], 'Foet_Mnagyo');
      assert.equal(v.params[1], 1);
      assert.equal(v.params[2], Teams.None);

      message = '- Cylcl joined in slot 5.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], '- Cylcl');
      assert.equal(v.params[1], 5);
      assert.equal(v.params[2], Teams.None);
    });

    it('player joined team mode test', () => {
      let v = parser.ParseBanchoResponse('Cartist joined in slot 7 for team blue.');
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], 'Cartist');
      assert.equal(v.params[1], 7);
      assert.equal(v.params[2], Teams.Blue);

      v = parser.ParseBanchoResponse('hmelevsky joined in slot 8 for team red.');
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], 'hmelevsky');
      assert.equal(v.params[1], 8);
      assert.equal(v.params[2], Teams.Red);

      v = parser.ParseBanchoResponse('Xiux joined in slot 2 for team red.');
      assert.equal(v.type, BanchoResponseType.PlayerJoined);
      assert.equal(v.params[0], 'Xiux');
      assert.equal(v.params[1], 2);
      assert.equal(v.params[2], Teams.Red);
    });

    it('player left parse test', () => {
      let message = 'Swgciai left the game.';
      let v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerLeft);
      assert.equal(v.params[0], 'Swgciai');

      message = 'Foet_Mnagyo left the game.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerLeft);
      assert.equal(v.params[0], 'Foet_Mnagyo');

      message = '- Cylcl left the game.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerLeft);
      assert.equal(v.params[0], '- Cylcl');

    });

    it('map changing test', () => {
      const message = 'Host is changing map...';
      const v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.BeatmapChanging);
    });

    it('map changed test', () => {
      let message = 'Beatmap changed to: Noah - Celestial stinger [apl\'s EXHAUST] (https://osu.ppy.sh/b/1454083)';
      let v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.BeatmapChanged);
      assert.equal(v.params[0], '1454083');

      message = 'Beatmap changed to: Paul Bazooka - DrunkenSteiN [bor\'s Insane] (https://osu.ppy.sh/b/1913126)';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.BeatmapChanged);
      assert.equal(v.params[0], '1913126');

      message = 'Beatmap changed to: supercell - Hoshi ga Matataku Konna Yoru ni [Sharlo\'s Insane] (https://osu.ppy.sh/b/670743)';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.BeatmapChanged);
      assert.equal(v.params[0], '670743');

      message = 'Beatmap changed to: Lil Boom - "Already Dead " instrumental (Omae Wa Mou) (https://osu.ppy.sh/b/2122318)';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.BeatmapChanged);
      assert.equal(v.params[0], '2122318');
    });

    it('mp map changed test', () => {
      const message = 'Changed beatmap to https://osu.ppy.sh/b/2145701 Camellia feat. Nanahira - NANI THE FUCK!!';
      const v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.MpBeatmapChanged);
      assert.equal(v.params[0], '2145701');
    });

    it('mpInvalidMapId test', () => {
      const message = 'Invalid map ID provided';
      const v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.MpInvalidMapId);
    });

    it('host change test', () => {
      let message = 'Swgciai became the host.';
      let v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.HostChanged);
      assert.equal(v.params[0], 'Swgciai');

      message = 'Foet_Mnagyo became the host.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.HostChanged);
      assert.equal(v.params[0], 'Foet_Mnagyo');

      message = '- Cylcl became the host.';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.HostChanged);
      assert.equal(v.params[0], '- Cylcl');
    });

    it('match test', () => {
      let v = parser.ParseBanchoResponse('The match has started!');
      assert.equal(v.type, BanchoResponseType.MatchStarted);

      let message = 'Swgciai finished playing (Score: 18048202, PASSED).';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerFinished);
      assert.equal(v.params[0], 'Swgciai');
      assert.equal(v.params[1], 18048202);
      assert.equal(v.params[2], true);

      message = 'Foet_Mnagyo finished playing (Score: 290043, FAILED).';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerFinished);
      assert.equal(v.params[0], 'Foet_Mnagyo');
      assert.equal(v.params[1], 290043);
      assert.equal(v.params[2], false);

      message = '- Cylcl finished playing (Score: 2095838, PASSED).';
      v = parser.ParseBanchoResponse(message);
      assert.equal(v.type, BanchoResponseType.PlayerFinished);
      assert.equal(v.params[0], '- Cylcl');
      assert.equal(v.params[1], 2095838);
      assert.equal(v.params[2], true);

      v = parser.ParseBanchoResponse('The match has finished!');
      assert.equal(v.type, BanchoResponseType.MatchFinished);

      v = parser.ParseBanchoResponse('Closed the match');
      assert.equal(v.type, BanchoResponseType.ClosedMatch);
    });

    it('match abort test', () => {
      let v = parser.ParseBanchoResponse('Aborted the match');
      assert.equal(v.type, BanchoResponseType.AbortedMatch);

      v = parser.ParseBanchoResponse('The match is not in progress');
      assert.equal(v.type, BanchoResponseType.AbortMatchFailed);
    });

    it('PlayerMovedSlot test', () => {
      const v = parser.ParseBanchoResponse('azi03 moved to slot 6');
      assert.equal(v.type, BanchoResponseType.PlayerMovedSlot);
      assert.equal(v.params[0], 'azi03');
      assert.equal(v.params[1], 6);
    });

    it('MpHostChanged test', () => {
      const v = parser.ParseBanchoResponse('Changed match host to Brena_Pia');
      assert.equal(v.type, BanchoResponseType.MpHostChanged);
      assert.equal(v.params[0], 'Brena_Pia');
    });

    it('MpMatchStarted test', () => {
      const v = parser.ParseBanchoResponse('Started the match');
      assert.equal(v.type, BanchoResponseType.MpMatchStarted);
    });

    it('MpMatchAlreadyStarted test', () => {
      const v = parser.ParseBanchoResponse('The match has already been started');
      assert.equal(v.type, BanchoResponseType.MpMatchAlreadyStarted);
    });

    it('PasswordChanged test', () => {
      const v = parser.ParseBanchoResponse('Changed the match password');
      assert.equal(v.type, BanchoResponseType.PasswordChanged);
    });

    it('PasswordRemoved test', () => {
      const v = parser.ParseBanchoResponse('Removed the match password');
      assert.equal(v.type, BanchoResponseType.PasswordRemoved);
    });

    it('AddedReferee test', () => {
      const v = parser.ParseBanchoResponse('Added damn to the match referees');
      assert.equal(v.type, BanchoResponseType.AddedReferee);
      assert.equal(v.params[0], 'damn');

    });
    it('RemovedReferee test', () => {
      const v = parser.ParseBanchoResponse('Removed damn from the match referees');
      assert.equal(v.type, BanchoResponseType.RemovedReferee);
      assert.equal(v.params[0], 'damn');
    });
    it('kick player test', () => {
      const v = parser.ParseBanchoResponse('Kicked damn from the match');
      assert.equal(v.type, BanchoResponseType.KickedPlayer);
      assert.equal(v.params[0], 'damn');
    });
    it('CountedTimer test', () => {
      let v = parser.ParseBanchoResponse('Match starts in 10 seconds');
      assert.equal(v.type, BanchoResponseType.CounteddownTimer);
      assert.equal(v.params[0], 10);

      v = parser.ParseBanchoResponse('Match starts in 2 minutes and 40 seconds');
      assert.equal(v.type, BanchoResponseType.CounteddownTimer);
      assert.equal(v.params[0], 160);

      v = parser.ParseBanchoResponse('Match starts in 2 minutes');
      assert.equal(v.type, BanchoResponseType.CounteddownTimer);
      assert.equal(v.params[0], 120);

      v = parser.ParseBanchoResponse('Match starts in 1 minute and 1 second');
      assert.equal(v.type, BanchoResponseType.CounteddownTimer);
      assert.equal(v.params[0], 61);
    });
    it('BeganStartTimer test', () => {
      let v = parser.ParseBanchoResponse('Queued the match to start in 30 seconds');
      assert.equal(v.type, BanchoResponseType.BeganStartTimer);
      assert.equal(v.params[0], 30);

      v = parser.ParseBanchoResponse('Queued the match to start in 1 second');
      assert.equal(v.type, BanchoResponseType.BeganStartTimer);
      assert.equal(v.params[0], 1);

      v = parser.ParseBanchoResponse('Queued the match to start in 5 minutes and 40 seconds');
      assert.equal(v.type, BanchoResponseType.BeganStartTimer);
      assert.equal(v.params[0], 340);
    });
    it('FinishStartTimer test', () => {
      const v = parser.ParseBanchoResponse('Good luck, have fun!');
      assert.equal(v.type, BanchoResponseType.FinishStartTimer);
    });
    it('AbortedStartTimer test', () => {
      const v = parser.ParseBanchoResponse('Countdown aborted');
      assert.equal(v.type, BanchoResponseType.AbortedStartTimer);
    });
    it('mp settings test', () => {
      let v = parser.ParseBanchoResponse('Room name: 4* auto host rotation test, History: https://osu.ppy.sh/mp/xxxxxxx');
      assert.equal(v.type, BanchoResponseType.Settings);
      v = parser.ParseBanchoResponse('Beatmap: https://osu.ppy.sh/b/xxxxxx DJ Genericname - Dear You [Dear Rue]');
      assert.equal(v.type, BanchoResponseType.Settings);
      v = parser.ParseBanchoResponse('Team mode: HeadToHead, Win condition: Score');
      assert.equal(v.type, BanchoResponseType.Settings);
      v = parser.ParseBanchoResponse('Active mods: Freemod');
      assert.equal(v.type, BanchoResponseType.Settings);
      v = parser.ParseBanchoResponse('Players: 2');
      assert.equal(v.type, BanchoResponseType.Settings);
      v = parser.ParseBanchoResponse('Slot 1  Not Ready https://osu.ppy.sh/u/xxxxxxxx xxxx          [Host]');
      assert.equal(v.type, BanchoResponseType.Settings);
    });
    it('roll test', () => {
      let v = parser.ParseBanchoResponse('Natu rolls 13 point(s)');
      assert.equal(v.type, BanchoResponseType.Rolled);
      assert.equal(v.params[0], 'Natu');
      assert.equal(v.params[1], 13);

      v = parser.ParseBanchoResponse('gurdil203 rolls 1 point(s)');
      assert.equal(v.type, BanchoResponseType.Rolled);
      assert.equal(v.params[0], 'gurdil203');
      assert.equal(v.params[1], 1);

      v = parser.ParseBanchoResponse('DAE rolls rolls 46 point(s)');
      assert.equal(v.type, BanchoResponseType.Rolled);
      assert.equal(v.params[0], 'DAE rolls');
      assert.equal(v.params[1], 46);
    });
    it('stats test', () => {
      let v = parser.ParseBanchoResponse('Stats for (DAEVOTAKU)[https://osu.ppy.sh/u/10933699] is Multiplayer:');
      assert.equal(v.type, BanchoResponseType.Stats);
      v = parser.ParseBanchoResponse('Score:    906,297,690 (#203086)');
      assert.equal(v.type, BanchoResponseType.Stats);
      v = parser.ParseBanchoResponse('Plays:    3874 (lv76)');
      assert.equal(v.type, BanchoResponseType.Stats);
      v = parser.ParseBanchoResponse('Accuracy: 90.06%');
      assert.equal(v.type, BanchoResponseType.Stats);
    });
    it('team change test', () => {
      let v = parser.ParseBanchoResponse('a6387534 changed to Red');
      assert.equal(v.type, BanchoResponseType.TeamChanged);
      assert.equal(v.params[0], 'a6387534');
      assert.equal(v.params[1], Teams.Red);

      v = parser.ParseBanchoResponse('milisaurus changed to Blue');
      assert.equal(v.type, BanchoResponseType.TeamChanged);
      assert.equal(v.params[0], 'milisaurus');
      assert.equal(v.params[1], Teams.Blue);
    });
    it('lobby size changed test', () => {
      let v = parser.ParseBanchoResponse('Changed match to size 8');
      assert.equal(v.type, BanchoResponseType.LobbySizeChanged);
      assert.equal(v.params[0], 8);

      v = parser.ParseBanchoResponse('Changed match to size 16');
      assert.equal(v.type, BanchoResponseType.LobbySizeChanged);
      assert.equal(v.params[0], 16);
    });
  });

  it('ensure channel test', () => {
    let v = parser.EnsureMpChannelId('123');
    assert.equal(v, '#mp_123');

    v = parser.EnsureMpChannelId('#mp_123');
    assert.equal(v, '#mp_123');

    v = parser.EnsureMpChannelId('https://osu.ppy.sh/mp/123');
    assert.equal(v, '#mp_123');
  });

  it('SplitCliCommand test', () => {
    let v = parser.SplitCliCommand('a abcdefg');
    assert.equal(v.command, 'a');
    assert.equal(v.arg, 'abcdefg');

    v = parser.SplitCliCommand('a b c');
    assert.equal(v.command, 'a');
    assert.equal(v.arg, 'b c');

    v = parser.SplitCliCommand('a');
    assert.equal(v.command, 'a');
    assert.equal(v.arg, '');
  });

  describe('parse chat command tests', function () {
    it('IsChatCommand?', () => {
      const valids = ['!aioie', '!a', '!123', '!a ', '!v x', '!vv x y[v]', '*abc'];
      const invalids = ['!', '*', '  !asa', '!!ss', '*!v', 'abc', 'abc !abc'];
      const used = ['!help', '!Help', '!info', '!skip', '!SKIP', '!queue', '!q', '*skip', '*stipto'];
      const reservedInvalid = ['!mp', '!roll', '!roll 100', '!where abc', '!faq', '!report', '!request', '!stat', '!stats'];
      const mpredirect = ['!mp x', '!mp start', '!mp start 20'];
      valids.forEach(c => assert.isTrue(parser.IsChatCommand(c), c));
      invalids.forEach(c => assert.isFalse(parser.IsChatCommand(c), c));
      used.forEach(c => assert.isTrue(parser.IsChatCommand(c), c));
      reservedInvalid.forEach(c => assert.isFalse(parser.IsChatCommand(c), c));
      mpredirect.forEach(c => assert.isTrue(parser.IsChatCommand(c), c));
    });
    it('ParseChatCommand', () => {
      let v = parser.ParseChatCommand('!abc');
      assert.equal(v.command, '!abc');
      assert.equal(v.param, '');

      v = parser.ParseChatCommand('!a a');
      assert.equal(v.command, '!a');
      assert.equal(v.param, 'a');

      v = parser.ParseChatCommand('!a  a ');
      assert.equal(v.command, '!a');
      assert.equal(v.param, 'a');

      v = parser.ParseChatCommand('!a a b');
      assert.equal(v.command, '!a');
      assert.equal(v.param, 'a b');

      v = parser.ParseChatCommand('!a   a    b  ');
      assert.equal(v.command, '!a');
      assert.equal(v.param, 'a    b');
    });
    it('Case insensitive check', () => {
      assert.isTrue(parser.IsChatCommand('!abc'));
      let v = parser.ParseChatCommand('!abc');
      assert.equal(v.command, '!abc');
      assert.equal(v.param, '');

      assert.isTrue(parser.IsChatCommand('!Abc'));
      v = parser.ParseChatCommand('!Abc');
      assert.equal(v.command, '!abc');
      assert.equal(v.param, '');

      assert.isTrue(parser.IsChatCommand('!ABC'));
      v = parser.ParseChatCommand('!ABC');
      assert.equal(v.command, '!abc');
      assert.equal(v.param, '');

      assert.isTrue(parser.IsChatCommand('!AbC aiueo AIUEO'));
      v = parser.ParseChatCommand('!AbC aiueo AIUEO');
      assert.equal(v.command, '!abc');
      assert.equal(v.param, 'aiueo AIUEO');
    });
    it('!mp redirect', () => {
      assert.isFalse(parser.IsChatCommand('!mp'));
      assert.isFalse(parser.IsChatCommand('!mp '));
      assert.isTrue(parser.IsChatCommand('!mp start'));
      let v = parser.ParseChatCommand('!mp start');
      assert.equal(v.command, '!start');
      assert.equal(v.param, '');

      assert.isTrue(parser.IsChatCommand('!mp start 30'));
      v = parser.ParseChatCommand('!mp start 30');
      assert.equal(v.command, '!start');
      assert.equal(v.param, '30');

      assert.isTrue(parser.IsChatCommand('!mp start 30 xx '));
      v = parser.ParseChatCommand('!mp start 30 xx ');
      assert.equal(v.command, '!start');
      assert.equal(v.param, '30 xx');
    });
  });
});

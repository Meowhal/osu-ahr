"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const CommandParser_1 = require("../parsers/CommandParser");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('CommandParserTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    it('make lobby message parse test', () => {
        let message = 'Created the tournament match https://osu.ppy.sh/mp/52612489 irctestroom';
        let v = CommandParser_1.parser.ParseMpMakeResponse('BanchoBot', message);
        chai_1.assert.isNotNull(v);
        if (v === null) {
            chai_1.assert.fail();
        }
        else {
            chai_1.assert.equal(v.id, '52612489');
            chai_1.assert.equal(v.title, 'irctestroom');
        }
        message = 'Created the tournament match https://osu.ppy.sh/mp/52849259 irctest_room^^';
        v = CommandParser_1.parser.ParseMpMakeResponse('BanchoBot', message);
        if (v === null) {
            chai_1.assert.fail();
        }
        else {
            chai_1.assert.equal(v.id, '52849259');
            chai_1.assert.equal(v.title, 'irctest_room^^');
        }
        message = 'Created the tournament match https://osu.ppy.sh/mp/52849326 irc test room 1';
        v = CommandParser_1.parser.ParseMpMakeResponse('BanchoBot', message);
        if (v === null) {
            chai_1.assert.fail();
        }
        else {
            chai_1.assert.equal(v.id, '52849326');
            chai_1.assert.equal(v.title, 'irc test room 1');
        }
    });
    it('ParseMPCommandTest', () => {
        let message = '!mp host xxx';
        let v = CommandParser_1.parser.ParseMPCommand(message);
        if (v === null) {
            chai_1.assert.fail();
        }
        else {
            chai_1.assert.equal(v.command, 'host');
            chai_1.assert.equal(v.arg, 'xxx');
        }
        message = '!mp make xxx';
        v = CommandParser_1.parser.ParseMPCommand(message);
        if (v === null) {
            chai_1.assert.fail();
        }
        else {
            chai_1.assert.equal(v.command, 'make');
            chai_1.assert.equal(v.arg, 'xxx');
        }
        message = 'xx!mp make xxx';
        v = CommandParser_1.parser.ParseMPCommand(message);
        if (v !== null) {
            chai_1.assert.fail();
        }
    });
    describe('ParseBanchoResponse tests', () => {
        it('player joined parse test', () => {
            let message = 'Swgciai joined in slot 4.';
            let v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], 'Swgciai');
            chai_1.assert.equal(v.params[1], 4);
            chai_1.assert.equal(v.params[2], Player_1.Teams.None);
            message = 'Foet_Mnagyo joined in slot 1.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], 'Foet_Mnagyo');
            chai_1.assert.equal(v.params[1], 1);
            chai_1.assert.equal(v.params[2], Player_1.Teams.None);
            message = '- Cylcl joined in slot 5.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], '- Cylcl');
            chai_1.assert.equal(v.params[1], 5);
            chai_1.assert.equal(v.params[2], Player_1.Teams.None);
        });
        it('player joined team mode test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Cartist joined in slot 7 for team blue.');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], 'Cartist');
            chai_1.assert.equal(v.params[1], 7);
            chai_1.assert.equal(v.params[2], Player_1.Teams.Blue);
            v = CommandParser_1.parser.ParseBanchoResponse('hmelevsky joined in slot 8 for team red.');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], 'hmelevsky');
            chai_1.assert.equal(v.params[1], 8);
            chai_1.assert.equal(v.params[2], Player_1.Teams.Red);
            v = CommandParser_1.parser.ParseBanchoResponse('Xiux joined in slot 2 for team red.');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerJoined);
            chai_1.assert.equal(v.params[0], 'Xiux');
            chai_1.assert.equal(v.params[1], 2);
            chai_1.assert.equal(v.params[2], Player_1.Teams.Red);
        });
        it('player left parse test', () => {
            let message = 'Swgciai left the game.';
            let v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerLeft);
            chai_1.assert.equal(v.params[0], 'Swgciai');
            message = 'Foet_Mnagyo left the game.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerLeft);
            chai_1.assert.equal(v.params[0], 'Foet_Mnagyo');
            message = '- Cylcl left the game.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerLeft);
            chai_1.assert.equal(v.params[0], '- Cylcl');
        });
        it('map changing test', () => {
            const message = 'Host is changing map...';
            const v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeatmapChanging);
        });
        it('map changed test', () => {
            let message = 'Beatmap changed to: Noah - Celestial stinger [apl\'s EXHAUST] (https://osu.ppy.sh/b/1454083)';
            let v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeatmapChanged);
            chai_1.assert.equal(v.params[0], '1454083');
            message = 'Beatmap changed to: Paul Bazooka - DrunkenSteiN [bor\'s Insane] (https://osu.ppy.sh/b/1913126)';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeatmapChanged);
            chai_1.assert.equal(v.params[0], '1913126');
            message = 'Beatmap changed to: supercell - Hoshi ga Matataku Konna Yoru ni [Sharlo\'s Insane] (https://osu.ppy.sh/b/670743)';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeatmapChanged);
            chai_1.assert.equal(v.params[0], '670743');
            message = 'Beatmap changed to: Lil Boom - "Already Dead " instrumental (Omae Wa Mou) (https://osu.ppy.sh/b/2122318)';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeatmapChanged);
            chai_1.assert.equal(v.params[0], '2122318');
        });
        it('mp map changed test', () => {
            const message = 'Changed beatmap to https://osu.ppy.sh/b/2145701 Camellia feat. Nanahira - NANI THE FUCK!!';
            const v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MpBeatmapChanged);
            chai_1.assert.equal(v.params[0], '2145701');
        });
        it('mpInvalidMapId test', () => {
            const message = 'Invalid map ID provided';
            const v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MpInvalidMapId);
        });
        it('host change test', () => {
            let message = 'Swgciai became the host.';
            let v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.HostChanged);
            chai_1.assert.equal(v.params[0], 'Swgciai');
            message = 'Foet_Mnagyo became the host.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.HostChanged);
            chai_1.assert.equal(v.params[0], 'Foet_Mnagyo');
            message = '- Cylcl became the host.';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.HostChanged);
            chai_1.assert.equal(v.params[0], '- Cylcl');
        });
        it('match test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('The match has started!');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MatchStarted);
            let message = 'Swgciai finished playing (Score: 18048202, PASSED).';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerFinished);
            chai_1.assert.equal(v.params[0], 'Swgciai');
            chai_1.assert.equal(v.params[1], 18048202);
            chai_1.assert.equal(v.params[2], true);
            message = 'Foet_Mnagyo finished playing (Score: 290043, FAILED).';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerFinished);
            chai_1.assert.equal(v.params[0], 'Foet_Mnagyo');
            chai_1.assert.equal(v.params[1], 290043);
            chai_1.assert.equal(v.params[2], false);
            message = '- Cylcl finished playing (Score: 2095838, PASSED).';
            v = CommandParser_1.parser.ParseBanchoResponse(message);
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerFinished);
            chai_1.assert.equal(v.params[0], '- Cylcl');
            chai_1.assert.equal(v.params[1], 2095838);
            chai_1.assert.equal(v.params[2], true);
            v = CommandParser_1.parser.ParseBanchoResponse('The match has finished!');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MatchFinished);
            v = CommandParser_1.parser.ParseBanchoResponse('Closed the match');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.ClosedMatch);
        });
        it('match abort test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Aborted the match');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.AbortedMatch);
            v = CommandParser_1.parser.ParseBanchoResponse('The match is not in progress');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.AbortMatchFailed);
        });
        it('PlayerMovedSlot test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('azi03 moved to slot 6');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PlayerMovedSlot);
            chai_1.assert.equal(v.params[0], 'azi03');
            chai_1.assert.equal(v.params[1], 6);
        });
        it('MpHostChanged test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Changed match host to Brena_Pia');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MpHostChanged);
            chai_1.assert.equal(v.params[0], 'Brena_Pia');
        });
        it('MpMatchStarted test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Started the match');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MpMatchStarted);
        });
        it('MpMatchAlreadyStarted test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('The match has already been started');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.MpMatchAlreadyStarted);
        });
        it('PasswordChanged test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Changed the match password');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PasswordChanged);
        });
        it('PasswordRemoved test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Removed the match password');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.PasswordRemoved);
        });
        it('AddedReferee test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Added damn to the match referees');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.AddedReferee);
            chai_1.assert.equal(v.params[0], 'damn');
        });
        it('RemovedReferee test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Removed damn from the match referees');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.RemovedReferee);
            chai_1.assert.equal(v.params[0], 'damn');
        });
        it('kick player test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Kicked damn from the match');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.KickedPlayer);
            chai_1.assert.equal(v.params[0], 'damn');
        });
        it('CountedTimer test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Match starts in 10 seconds');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.CounteddownTimer);
            chai_1.assert.equal(v.params[0], 10);
            v = CommandParser_1.parser.ParseBanchoResponse('Match starts in 2 minutes and 40 seconds');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.CounteddownTimer);
            chai_1.assert.equal(v.params[0], 160);
            v = CommandParser_1.parser.ParseBanchoResponse('Match starts in 2 minutes');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.CounteddownTimer);
            chai_1.assert.equal(v.params[0], 120);
            v = CommandParser_1.parser.ParseBanchoResponse('Match starts in 1 minute and 1 second');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.CounteddownTimer);
            chai_1.assert.equal(v.params[0], 61);
        });
        it('BeganStartTimer test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Queued the match to start in 30 seconds');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeganStartTimer);
            chai_1.assert.equal(v.params[0], 30);
            v = CommandParser_1.parser.ParseBanchoResponse('Queued the match to start in 1 second');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeganStartTimer);
            chai_1.assert.equal(v.params[0], 1);
            v = CommandParser_1.parser.ParseBanchoResponse('Queued the match to start in 5 minutes and 40 seconds');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.BeganStartTimer);
            chai_1.assert.equal(v.params[0], 340);
        });
        it('FinishStartTimer test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Good luck, have fun!');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.FinishStartTimer);
        });
        it('AbortedStartTimer test', () => {
            const v = CommandParser_1.parser.ParseBanchoResponse('Countdown aborted');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.AbortedStartTimer);
        });
        it('mp settings test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Room name: 4* auto host rotation test, History: https://osu.ppy.sh/mp/xxxxxxx');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
            v = CommandParser_1.parser.ParseBanchoResponse('Beatmap: https://osu.ppy.sh/b/xxxxxx DJ Genericname - Dear You [Dear Rue]');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
            v = CommandParser_1.parser.ParseBanchoResponse('Team mode: HeadToHead, Win condition: Score');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
            v = CommandParser_1.parser.ParseBanchoResponse('Active mods: Freemod');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
            v = CommandParser_1.parser.ParseBanchoResponse('Players: 2');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
            v = CommandParser_1.parser.ParseBanchoResponse('Slot 1  Not Ready https://osu.ppy.sh/u/xxxxxxxx xxxx          [Host]');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Settings);
        });
        it('roll test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Natu rolls 13 point(s)');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Rolled);
            chai_1.assert.equal(v.params[0], 'Natu');
            chai_1.assert.equal(v.params[1], 13);
            v = CommandParser_1.parser.ParseBanchoResponse('gurdil203 rolls 1 point(s)');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Rolled);
            chai_1.assert.equal(v.params[0], 'gurdil203');
            chai_1.assert.equal(v.params[1], 1);
            v = CommandParser_1.parser.ParseBanchoResponse('DAE rolls rolls 46 point(s)');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Rolled);
            chai_1.assert.equal(v.params[0], 'DAE rolls');
            chai_1.assert.equal(v.params[1], 46);
        });
        it('stats test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Stats for (DAEVOTAKU)[https://osu.ppy.sh/u/10933699] is Multiplayer:');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Stats);
            v = CommandParser_1.parser.ParseBanchoResponse('Score:    906,297,690 (#203086)');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Stats);
            v = CommandParser_1.parser.ParseBanchoResponse('Plays:    3874 (lv76)');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Stats);
            v = CommandParser_1.parser.ParseBanchoResponse('Accuracy: 90.06%');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.Stats);
        });
        it('team change test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('a6387534 changed to Red');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.TeamChanged);
            chai_1.assert.equal(v.params[0], 'a6387534');
            chai_1.assert.equal(v.params[1], Player_1.Teams.Red);
            v = CommandParser_1.parser.ParseBanchoResponse('milisaurus changed to Blue');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.TeamChanged);
            chai_1.assert.equal(v.params[0], 'milisaurus');
            chai_1.assert.equal(v.params[1], Player_1.Teams.Blue);
        });
        it('lobby size changed test', () => {
            let v = CommandParser_1.parser.ParseBanchoResponse('Changed match to size 8');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.LobbySizeChanged);
            chai_1.assert.equal(v.params[0], 8);
            v = CommandParser_1.parser.ParseBanchoResponse('Changed match to size 16');
            chai_1.assert.equal(v.type, CommandParser_1.BanchoResponseType.LobbySizeChanged);
            chai_1.assert.equal(v.params[0], 16);
        });
    });
    it('ensure channel test', () => {
        let v = CommandParser_1.parser.EnsureMpChannelId('123');
        chai_1.assert.equal(v, '#mp_123');
        v = CommandParser_1.parser.EnsureMpChannelId('#mp_123');
        chai_1.assert.equal(v, '#mp_123');
        v = CommandParser_1.parser.EnsureMpChannelId('https://osu.ppy.sh/mp/123');
        chai_1.assert.equal(v, '#mp_123');
    });
    it('SplitCliCommand test', () => {
        let v = CommandParser_1.parser.SplitCliCommand('a abcdefg');
        chai_1.assert.equal(v.command, 'a');
        chai_1.assert.equal(v.arg, 'abcdefg');
        v = CommandParser_1.parser.SplitCliCommand('a b c');
        chai_1.assert.equal(v.command, 'a');
        chai_1.assert.equal(v.arg, 'b c');
        v = CommandParser_1.parser.SplitCliCommand('a');
        chai_1.assert.equal(v.command, 'a');
        chai_1.assert.equal(v.arg, '');
    });
    describe('parse chat command tests', function () {
        it('IsChatCommand?', () => {
            const valids = ['!aioie', '!a', '!123', '!a ', '!v x', '!vv x y[v]', '*abc'];
            const invalids = ['!', '*', '  !asa', '!!ss', '*!v', 'abc', 'abc !abc'];
            const used = ['!help', '!Help', '!info', '!skip', '!SKIP', '!queue', '!q', '*skip', '*stipto'];
            const reservedInvalid = ['!mp', '!roll', '!roll 100', '!where abc', '!faq', '!report', '!request', '!stat', '!stats'];
            const mpredirect = ['!mp x', '!mp start', '!mp start 20'];
            valids.forEach(c => chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand(c), c));
            invalids.forEach(c => chai_1.assert.isFalse(CommandParser_1.parser.IsChatCommand(c), c));
            used.forEach(c => chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand(c), c));
            reservedInvalid.forEach(c => chai_1.assert.isFalse(CommandParser_1.parser.IsChatCommand(c), c));
            mpredirect.forEach(c => chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand(c), c));
        });
        it('ParseChatCommand', () => {
            let v = CommandParser_1.parser.ParseChatCommand('!abc');
            chai_1.assert.equal(v.command, '!abc');
            chai_1.assert.equal(v.param, '');
            v = CommandParser_1.parser.ParseChatCommand('!a a');
            chai_1.assert.equal(v.command, '!a');
            chai_1.assert.equal(v.param, 'a');
            v = CommandParser_1.parser.ParseChatCommand('!a  a ');
            chai_1.assert.equal(v.command, '!a');
            chai_1.assert.equal(v.param, 'a');
            v = CommandParser_1.parser.ParseChatCommand('!a a b');
            chai_1.assert.equal(v.command, '!a');
            chai_1.assert.equal(v.param, 'a b');
            v = CommandParser_1.parser.ParseChatCommand('!a   a    b  ');
            chai_1.assert.equal(v.command, '!a');
            chai_1.assert.equal(v.param, 'a    b');
        });
        it('Case insensitive check', () => {
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!abc'));
            let v = CommandParser_1.parser.ParseChatCommand('!abc');
            chai_1.assert.equal(v.command, '!abc');
            chai_1.assert.equal(v.param, '');
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!Abc'));
            v = CommandParser_1.parser.ParseChatCommand('!Abc');
            chai_1.assert.equal(v.command, '!abc');
            chai_1.assert.equal(v.param, '');
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!ABC'));
            v = CommandParser_1.parser.ParseChatCommand('!ABC');
            chai_1.assert.equal(v.command, '!abc');
            chai_1.assert.equal(v.param, '');
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!AbC aiueo AIUEO'));
            v = CommandParser_1.parser.ParseChatCommand('!AbC aiueo AIUEO');
            chai_1.assert.equal(v.command, '!abc');
            chai_1.assert.equal(v.param, 'aiueo AIUEO');
        });
        it('!mp redirect', () => {
            chai_1.assert.isFalse(CommandParser_1.parser.IsChatCommand('!mp'));
            chai_1.assert.isFalse(CommandParser_1.parser.IsChatCommand('!mp '));
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!mp start'));
            let v = CommandParser_1.parser.ParseChatCommand('!mp start');
            chai_1.assert.equal(v.command, '!start');
            chai_1.assert.equal(v.param, '');
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!mp start 30'));
            v = CommandParser_1.parser.ParseChatCommand('!mp start 30');
            chai_1.assert.equal(v.command, '!start');
            chai_1.assert.equal(v.param, '30');
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand('!mp start 30 xx '));
            v = CommandParser_1.parser.ParseChatCommand('!mp start 30 xx ');
            chai_1.assert.equal(v.command, '!start');
            chai_1.assert.equal(v.param, '30 xx');
        });
    });
});
//# sourceMappingURL=CommandParserTest.js.map
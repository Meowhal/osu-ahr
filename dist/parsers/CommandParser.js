"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BanchoResponseType = exports.parser = void 0;
const Player_1 = require("../Player");
var parser;
(function (parser) {
    function ParseBanchoResponse(message) {
        // 1文字目を整数比較してifの評価回数を減らす
        switch (message.charCodeAt(0)) {
            case 65: // A
                if (message === 'Aborted the match') {
                    return makeBanchoResponse(BanchoResponseType.AbortedMatch);
                }
                if (message === 'All players are ready') {
                    return makeBanchoResponse(BanchoResponseType.AllPlayerReady);
                }
                const m_add_ref = message.match(/Added (.+) to the match referees/);
                if (m_add_ref) {
                    return makeBanchoResponse(BanchoResponseType.AddedReferee, m_add_ref[1]);
                }
                break;
            case 66: // B
                const m_map = message.match(/Beatmap changed to: (.+) \(https:\/\/osu.ppy.sh\/b\/(\d+)\)$/);
                if (m_map) {
                    return makeBanchoResponse(BanchoResponseType.BeatmapChanged, parseInt(m_map[2]), m_map[1]);
                }
                break;
            case 67: // C
                if (message === 'Changed the match password') {
                    return makeBanchoResponse(BanchoResponseType.PasswordChanged);
                }
                if (message === 'Cleared match host') {
                    return makeBanchoResponse(BanchoResponseType.ClearedHost);
                }
                if (message === 'Closed the match') {
                    return makeBanchoResponse(BanchoResponseType.ClosedMatch);
                }
                if (message === 'Countdown aborted') {
                    return makeBanchoResponse(BanchoResponseType.AbortedStartTimer);
                }
                const m_size = message.match(/Changed match to size (\d+)/);
                if (m_size) {
                    return makeBanchoResponse(BanchoResponseType.LobbySizeChanged, parseInt(m_size[1]));
                }
                const m_mpmap = message.match(/Changed beatmap to https:\/\/osu.ppy.sh\/b\/(\d+) (.+)/);
                if (m_mpmap) {
                    return makeBanchoResponse(BanchoResponseType.MpBeatmapChanged, parseInt(m_mpmap[1]), m_mpmap[2]);
                }
                const m_mphost = message.match(/Changed match host to (.+)/);
                if (m_mphost) {
                    return makeBanchoResponse(BanchoResponseType.MpHostChanged, m_mphost[1]);
                }
                const m_setting = message.match(/Changed match settings to\s?((\d+) slots)?,?\s?(HeadToHead|TagCoop|TeamVs|TagTeamVs)?,?\s?(Score|Accuracy|Combo|ScoreV2)?/);
                if (m_setting) {
                    return makeBanchoResponse(BanchoResponseType.MpSettingsChanged, m_setting[2], m_setting[3], m_setting[4]);
                }
                break;
            case 71: // G
                if (message === 'Good luck, have fun!') {
                    return makeBanchoResponse(BanchoResponseType.FinishStartTimer);
                }
                break;
            case 72: // H
                if (message === 'Host is changing map...') {
                    return makeBanchoResponse(BanchoResponseType.BeatmapChanging);
                }
                break;
            case 73: // I
                if (message === 'Invalid map ID provided') {
                    return makeBanchoResponse(BanchoResponseType.MpInvalidMapId);
                }
                if (message === 'Invalid or no settings provided') {
                    return makeBanchoResponse(BanchoResponseType.MpInvalidSettings);
                }
                if (message === 'Invalid or no size provided') {
                    return makeBanchoResponse(BanchoResponseType.MpInvalidSize);
                }
                const m_invite = message.match(/Invited (.*) to the room/);
                if (m_invite) {
                    return makeBanchoResponse(BanchoResponseType.InvitedPlayer, m_invite[1]);
                }
                break;
            case 75: // K
                const m_kick = message.match(/Kicked (.+) from the match/);
                if (m_kick) {
                    return makeBanchoResponse(BanchoResponseType.KickedPlayer, m_kick[1]);
                }
                break;
            case 76: // L
                if (message === 'Locked the match') {
                    return makeBanchoResponse(BanchoResponseType.LockedMatch);
                }
                break;
            case 77: // M
                if (message === 'Match referees:') {
                    return makeBanchoResponse(BanchoResponseType.ListRefs);
                }
                if (message.startsWith('Match starts in ')) {
                    const m_sec = message.match(/(\d+) seconds?/);
                    const m_min = message.match(/(\d+) minutes?/);
                    let secs = 0;
                    if (m_sec) {
                        secs += parseInt(m_sec[1]);
                    }
                    if (m_min) {
                        secs += parseInt(m_min[1]) * 60;
                    }
                    return makeBanchoResponse(BanchoResponseType.CounteddownTimer, secs);
                }
                break;
            case 78: // N
                if (message === 'No user specified') {
                    return makeBanchoResponse(BanchoResponseType.NoUserSpecified);
                }
                break;
            case 81: // Q
                if (message.startsWith('Queued the match to start in ')) {
                    const m_sec = message.match(/(\d+) seconds?/);
                    const m_min = message.match(/(\d+) minutes?/);
                    let secs = 0;
                    if (m_sec) {
                        secs += parseInt(m_sec[1]);
                    }
                    if (m_min) {
                        secs += parseInt(m_min[1]) * 60;
                    }
                    return makeBanchoResponse(BanchoResponseType.BeganStartTimer, secs);
                }
                break;
            case 82: // R
                if (message === 'Removed the match password') {
                    return makeBanchoResponse(BanchoResponseType.PasswordRemoved);
                }
                const m_rm_ref = message.match(/Removed (.+) from the match referees/);
                if (m_rm_ref) {
                    return makeBanchoResponse(BanchoResponseType.RemovedReferee, m_rm_ref[1]);
                }
                break;
            case 83: // S
                if (message === 'Started the match') {
                    return makeBanchoResponse(BanchoResponseType.MpMatchStarted);
                }
                break;
            case 84: //T
                if (message === 'The match has started!') {
                    return makeBanchoResponse(BanchoResponseType.MatchStarted);
                }
                if (message === 'The match has already been started') {
                    return makeBanchoResponse(BanchoResponseType.MpMatchAlreadyStarted);
                }
                if (message === 'The match has finished!') {
                    return makeBanchoResponse(BanchoResponseType.MatchFinished);
                }
                if (message === 'The match is not in progress') {
                    return makeBanchoResponse(BanchoResponseType.AbortMatchFailed);
                }
                break;
            case 85: // U
                if (message === 'User not found') {
                    return makeBanchoResponse(BanchoResponseType.UserNotFound);
                }
                if (message === 'Unlocked the match') {
                    return makeBanchoResponse(BanchoResponseType.UnlockedMatch);
                }
                break;
        }
        const m_joined = message.match(/^(.+) joined in slot (\d+)( for team (blue|red))?\./);
        if (m_joined) {
            const team = m_joined[4] === undefined ? Player_1.Teams.None : m_joined[4] === 'blue' ? Player_1.Teams.Blue : Player_1.Teams.Red;
            return makeBanchoResponse(BanchoResponseType.PlayerJoined, m_joined[1], parseInt(m_joined[2]), team);
        }
        const m_left = message.match(/^(.+) left the game\./);
        if (m_left) {
            return makeBanchoResponse(BanchoResponseType.PlayerLeft, m_left[1]);
        }
        const m_host = message.match(/^(.+) became the host\./);
        if (m_host) {
            return makeBanchoResponse(BanchoResponseType.HostChanged, m_host[1]);
        }
        const m_moved = message.match(/^(.+) moved to slot (\d+)/);
        if (m_moved) {
            return makeBanchoResponse(BanchoResponseType.PlayerMovedSlot, m_moved[1], parseInt(m_moved[2]));
        }
        const m_finish = message.match(/^(.+) finished playing \(Score: (\d+), (PASSED|FAILED)\)\./);
        if (m_finish) {
            return makeBanchoResponse(BanchoResponseType.PlayerFinished, m_finish[1], parseInt(m_finish[2]), m_finish[3] === 'PASSED');
        }
        const m_roll = message.match(/^(.+) rolls (\d+) point\(s\)/);
        if (m_roll) {
            return makeBanchoResponse(BanchoResponseType.Rolled, m_roll[1], parseInt(m_roll[2]));
        }
        const m_team_change = message.match(/^(.+) changed to (Blue|Red)/);
        if (m_team_change) {
            return makeBanchoResponse(BanchoResponseType.TeamChanged, m_team_change[1], (m_team_change[2] === 'Blue' ? Player_1.Teams.Blue : Player_1.Teams.Red));
        }
        const m_stat = message.match(/^(Stats for \(|Score:\s+\d|Plays:\s+\d|Accuracy:\s+\d)/);
        if (m_stat) {
            return makeBanchoResponse(BanchoResponseType.Stats, message);
        }
        if (message.match(/^(Room name:|Beatmap:|Team mode:|Active mods:|Players:|Slot \d+)/)) {
            return makeBanchoResponse(BanchoResponseType.Settings, message);
        }
        return makeBanchoResponse(BanchoResponseType.Unhandled);
    }
    parser.ParseBanchoResponse = ParseBanchoResponse;
    function ParseMpMakeResponse(nick, message) {
        if (nick !== 'BanchoBot')
            return null;
        const reg = /Created the tournament match https:\/\/osu.ppy.sh\/mp\/(\d+) (.+)/;
        const res = message.match(reg);
        if (res) {
            return { id: res[1], title: res[2] };
        }
        return null;
    }
    parser.ParseMpMakeResponse = ParseMpMakeResponse;
    function ParseMPCommand(message) {
        const res = message.match(/^!mp\s+(\w+)\s*(.*?)\s*$/i);
        if (res) {
            return { command: res[1], arg: res[2] };
        }
        return null;
    }
    parser.ParseMPCommand = ParseMPCommand;
    function SplitCliCommand(line) {
        const l = line.match(/^\s*([!*]?\w+)\s+(.*)/);
        if (l === null) {
            return { command: line, arg: '' };
        }
        else {
            return {
                command: l[1],
                arg: l[2],
            };
        }
    }
    parser.SplitCliCommand = SplitCliCommand;
    function EnsureMpChannelId(id) {
        if (!id || id === '')
            return '';
        if (id.match(/^#mp_\d+$/))
            return id;
        if (id.match(/^\d+$/))
            return `#mp_${id}`;
        const m = id.match(/^https:\/\/osu\.ppy\.sh\/mp\/(\d+)$/);
        if (m)
            return `#mp_${m[1]}`;
        else
            return '';
    }
    parser.EnsureMpChannelId = EnsureMpChannelId;
    /**
     * ChatCommandかの判定
     * !か*で始まる、既存のコマンドではない、!mp単独ではない
     * !mp xxx は !xxx と解釈する
     * @param message
     */
    function IsChatCommand(message) {
        message = message.trimRight().toLowerCase();
        if (message[0] !== '!' && message[0] !== '*')
            return false;
        if (message === '!mp')
            return false;
        return message.match(/^[!*](?!roll|stats?|where|faq|report|request)\w+/) !== null;
    }
    parser.IsChatCommand = IsChatCommand;
    function ParseChatCommand(message) {
        message = message.trimRight();
        let m = message.match(/^!mp\s+(\w+)\s*(.*?)$/);
        if (m) {
            return { command: `!${m[1].toLowerCase()}`, param: m[2] };
        }
        m = message.match(/^([!*]\w+)\s*(.*?)$/);
        if (m) {
            return { command: m[1].toLowerCase(), param: m[2] };
        }
        else {
            throw new Error();
        }
    }
    parser.ParseChatCommand = ParseChatCommand;
})(parser = exports.parser || (exports.parser = {}));
var BanchoResponseType;
(function (BanchoResponseType) {
    BanchoResponseType[BanchoResponseType["Unhandled"] = 0] = "Unhandled";
    BanchoResponseType[BanchoResponseType["PlayerJoined"] = 1] = "PlayerJoined";
    BanchoResponseType[BanchoResponseType["PlayerLeft"] = 2] = "PlayerLeft";
    BanchoResponseType[BanchoResponseType["PlayerMovedSlot"] = 3] = "PlayerMovedSlot";
    BanchoResponseType[BanchoResponseType["BeatmapChanging"] = 4] = "BeatmapChanging";
    BanchoResponseType[BanchoResponseType["BeatmapChanged"] = 5] = "BeatmapChanged";
    BanchoResponseType[BanchoResponseType["MpBeatmapChanged"] = 6] = "MpBeatmapChanged";
    BanchoResponseType[BanchoResponseType["MpInvalidMapId"] = 7] = "MpInvalidMapId";
    BanchoResponseType[BanchoResponseType["MpInvalidSettings"] = 8] = "MpInvalidSettings";
    BanchoResponseType[BanchoResponseType["MpInvalidSize"] = 9] = "MpInvalidSize";
    BanchoResponseType[BanchoResponseType["HostChanged"] = 10] = "HostChanged";
    BanchoResponseType[BanchoResponseType["MpHostChanged"] = 11] = "MpHostChanged";
    BanchoResponseType[BanchoResponseType["UserNotFound"] = 12] = "UserNotFound";
    BanchoResponseType[BanchoResponseType["MatchStarted"] = 13] = "MatchStarted";
    BanchoResponseType[BanchoResponseType["MpMatchStarted"] = 14] = "MpMatchStarted";
    BanchoResponseType[BanchoResponseType["MpMatchAlreadyStarted"] = 15] = "MpMatchAlreadyStarted";
    BanchoResponseType[BanchoResponseType["MpSettingsChanged"] = 16] = "MpSettingsChanged";
    BanchoResponseType[BanchoResponseType["PlayerFinished"] = 17] = "PlayerFinished";
    BanchoResponseType[BanchoResponseType["MatchFinished"] = 18] = "MatchFinished";
    BanchoResponseType[BanchoResponseType["AbortedMatch"] = 19] = "AbortedMatch";
    BanchoResponseType[BanchoResponseType["AbortMatchFailed"] = 20] = "AbortMatchFailed";
    BanchoResponseType[BanchoResponseType["ClosedMatch"] = 21] = "ClosedMatch";
    BanchoResponseType[BanchoResponseType["AllPlayerReady"] = 22] = "AllPlayerReady";
    BanchoResponseType[BanchoResponseType["PasswordChanged"] = 23] = "PasswordChanged";
    BanchoResponseType[BanchoResponseType["PasswordRemoved"] = 24] = "PasswordRemoved";
    BanchoResponseType[BanchoResponseType["AddedReferee"] = 25] = "AddedReferee";
    BanchoResponseType[BanchoResponseType["RemovedReferee"] = 26] = "RemovedReferee";
    BanchoResponseType[BanchoResponseType["KickedPlayer"] = 27] = "KickedPlayer";
    BanchoResponseType[BanchoResponseType["CounteddownTimer"] = 28] = "CounteddownTimer";
    BanchoResponseType[BanchoResponseType["BeganStartTimer"] = 29] = "BeganStartTimer";
    BanchoResponseType[BanchoResponseType["FinishStartTimer"] = 30] = "FinishStartTimer";
    BanchoResponseType[BanchoResponseType["AbortedStartTimer"] = 31] = "AbortedStartTimer";
    BanchoResponseType[BanchoResponseType["Settings"] = 32] = "Settings";
    BanchoResponseType[BanchoResponseType["ListRefs"] = 33] = "ListRefs";
    BanchoResponseType[BanchoResponseType["Rolled"] = 34] = "Rolled";
    BanchoResponseType[BanchoResponseType["Stats"] = 35] = "Stats";
    BanchoResponseType[BanchoResponseType["TeamChanged"] = 36] = "TeamChanged";
    BanchoResponseType[BanchoResponseType["LobbySizeChanged"] = 37] = "LobbySizeChanged";
    BanchoResponseType[BanchoResponseType["ClearedHost"] = 38] = "ClearedHost";
    BanchoResponseType[BanchoResponseType["InvitedPlayer"] = 39] = "InvitedPlayer";
    BanchoResponseType[BanchoResponseType["LockedMatch"] = 40] = "LockedMatch";
    BanchoResponseType[BanchoResponseType["UnlockedMatch"] = 41] = "UnlockedMatch";
    BanchoResponseType[BanchoResponseType["NoUserSpecified"] = 42] = "NoUserSpecified";
})(BanchoResponseType = exports.BanchoResponseType || (exports.BanchoResponseType = {}));
function makeBanchoResponse(type, ...params) {
    return { type, params };
}
//# sourceMappingURL=CommandParser.js.map
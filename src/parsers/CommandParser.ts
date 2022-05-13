import { Teams } from '../Player';
export namespace parser {
  export function ParseBanchoResponse(message: string): BanchoResponse {
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
      const team = m_joined[4] === undefined ? Teams.None : m_joined[4] === 'blue' ? Teams.Blue : Teams.Red;
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
      return makeBanchoResponse(BanchoResponseType.PlayerFinished,
        m_finish[1], parseInt(m_finish[2]), m_finish[3] === 'PASSED');
    }

    const m_roll = message.match(/^(.+) rolls (\d+) point\(s\)/);
    if (m_roll) {
      return makeBanchoResponse(BanchoResponseType.Rolled, m_roll[1], parseInt(m_roll[2]));
    }

    const m_team_change = message.match(/^(.+) changed to (Blue|Red)/);
    if (m_team_change) {
      return makeBanchoResponse(BanchoResponseType.TeamChanged, m_team_change[1], (m_team_change[2] === 'Blue' ? Teams.Blue : Teams.Red));
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

  export function ParseMpMakeResponse(nick: string, message: string): { id: string, title: string } | null {
    if (nick !== 'BanchoBot') return null;
    const reg = /Created the tournament match https:\/\/osu.ppy.sh\/mp\/(\d+) (.+)/;
    const res = message.match(reg);
    if (res) {
      return { id: res[1], title: res[2] };
    }
    return null;
  }

  export function ParseMPCommand(message: string): MpCommand | null {
    const res = message.match(/^!mp\s+(\w+)\s*(.*?)\s*$/i);
    if (res) {
      return { command: res[1], arg: res[2] };
    }
    return null;
  }

  export function SplitCliCommand(line: string): { command: string, arg: string } {
    const l = line.match(/^\s*([!*]?\w+)\s+(.*)/);
    if (l === null) {
      return { command: line, arg: '' };
    } else {
      return {
        command: l[1],
        arg: l[2],
      };
    }
  }

  export function EnsureMpChannelId(id: string): string {
    if (!id || id === '') return '';
    if (id.match(/^#mp_\d+$/)) return id;
    if (id.match(/^\d+$/)) return `#mp_${id}`;
    const m = id.match(/^https:\/\/osu\.ppy\.sh\/mp\/(\d+)$/);

    if (m) return `#mp_${m[1]}`;
    else return '';
  }

  /**
   * ChatCommandかの判定
   * !か*で始まる、既存のコマンドではない、!mp単独ではない
   * !mp xxx は !xxx と解釈する
   * @param message
   */
  export function IsChatCommand(message: string) {
    message = message.trimRight().toLowerCase();
    if (message[0] !== '!' && message[0] !== '*') return false;
    if (message === '!mp') return false;
    return message.match(/^[!*](?!roll|stats?|where|faq|report|request)\w+/) !== null;
  }

  export function ParseChatCommand(message: string): { command: string, param: string } {
    message = message.trimRight();
    let m = message.match(/^!mp\s+(\w+)\s*(.*?)$/);
    if (m) {
      return { command: `!${m[1].toLowerCase()}`, param: m[2] };
    }
    m = message.match(/^([!*]\w+)\s*(.*?)$/);
    if (m) {
      return { command: m[1].toLowerCase(), param: m[2] };
    } else {
      throw new Error();
    }
  }
}

export interface MpCommand {
  command: string;
  arg: string;
}

export enum BanchoResponseType {
  Unhandled,
  PlayerJoined,
  PlayerLeft,
  PlayerMovedSlot,
  BeatmapChanging,
  BeatmapChanged,
  MpBeatmapChanged,
  MpInvalidMapId,
  MpInvalidSettings,
  MpInvalidSize,
  HostChanged,
  MpHostChanged,
  UserNotFound,
  MatchStarted,
  MpMatchStarted, // response of !mp start
  MpMatchAlreadyStarted,
  MpSettingsChanged,
  PlayerFinished,
  MatchFinished,
  AbortedMatch,
  AbortMatchFailed,
  ClosedMatch,
  AllPlayerReady,
  PasswordChanged,
  PasswordRemoved,
  AddedReferee,
  RemovedReferee,
  KickedPlayer,
  CounteddownTimer,
  BeganStartTimer,
  FinishStartTimer,
  AbortedStartTimer,
  Settings,
  ListRefs,
  Rolled,
  Stats,
  TeamChanged,
  LobbySizeChanged,
  ClearedHost,
  InvitedPlayer,
  LockedMatch,
  UnlockedMatch,
  NoUserSpecified
}

function makeBanchoResponse(type: BanchoResponseType, ...params: any[]) {
  return { type, params };
}

export interface BanchoResponse {
  type: BanchoResponseType;
  params: any[];
}

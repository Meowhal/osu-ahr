import { Teams } from "../Player";

/**
 * ircテキストを解析して抽象化するためのクラス
 * テキストの解析とその後の処理を分離し、テストなどを容易にすることが目的。
 */
export class CommandParser {

  ParseBanchoResponse(message: string): BanchoResponse {
    const m_joined = message.match(/(.+) joined in slot (\d+)( for team (blue|red))?\./);
    if (m_joined) {
      const team = m_joined[4] == undefined ? Teams.None : m_joined[4] == "blue" ? Teams.Blue : Teams.Red
      return makeBanchoResponse(BanchoResponseType.PlayerJoined, m_joined[1], parseInt(m_joined[2]), team);
    }

    const m_left = message.match(/(.+) left the game\./);
    if (m_left) {
      return makeBanchoResponse(BanchoResponseType.PlayerLeft, m_left[1]);
    }

    if (message == "Host is changing map...") {
      return makeBanchoResponse(BanchoResponseType.BeatmapChanging);
    }

    const m_map = message.match(/Beatmap changed to\: (.+ \[.+\]) \(https:\/\/osu.ppy.sh\/b\/(\d+)\)/);
    if (m_map) {
      return makeBanchoResponse(BanchoResponseType.BeatmapChanged, m_map[2], m_map[1]);
    }

    const m_host = message.match(/(.+) became the host\./);
    if (m_host) {
      return makeBanchoResponse(BanchoResponseType.HostChanged, m_host[1]);
    }

    const m_mphost = message.match(/Changed match host to (.+)/);
    if (m_mphost) {
      return makeBanchoResponse(BanchoResponseType.MpHostChanged, m_mphost[1]);
    }

    const m_moved = message.match(/(.+) moved to slot (\d+)/);
    if (m_moved) {
      return makeBanchoResponse(BanchoResponseType.PlayerMovedSlot, m_moved[1], parseInt(m_moved[2]));
    }

    if (message == "User not found") {
      return makeBanchoResponse(BanchoResponseType.UserNotFound);
    }

    if (message == "The match has started!") {
      return makeBanchoResponse(BanchoResponseType.MatchStarted);
    }

    if (message == "Started the match") {
      return makeBanchoResponse(BanchoResponseType.MpMatchStarted);
    }

    if (message == "The match has already been started") {
      return makeBanchoResponse(BanchoResponseType.MpMatchAlreadyStarted);
    }

    const m_finish = message.match(/(.+) finished playing \(Score: (\d+), (PASSED|FAILED)\)\./);
    if (m_finish) {
      return makeBanchoResponse(BanchoResponseType.PlayerFinished,
        m_finish[1], parseInt(m_finish[2]), m_finish[3] == "PASSED");
    }

    if (message == "The match has finished!") {
      return makeBanchoResponse(BanchoResponseType.MatchFinished);
    }

    if (message == "Aborted the match") {
      return makeBanchoResponse(BanchoResponseType.AbortedMatch);
    }

    if (message == "The match is not in progress") {
      return makeBanchoResponse(BanchoResponseType.AbortMatchFailed);
    }

    if (message == "Closed the match") {
      return makeBanchoResponse(BanchoResponseType.ClosedMatch);
    }

    if (message == "All players are ready") {
      return makeBanchoResponse(BanchoResponseType.AllPlayerReady);
    }

    if (message == "Changed the match password") {
      return makeBanchoResponse(BanchoResponseType.PasswordChanged);
    }
    if (message == "Removed the match password") {
      return makeBanchoResponse(BanchoResponseType.PasswordRemoved);
    }

    const m_add_ref = message.match(/Added (.+) to the match referees/);
    if (m_add_ref) {
      return makeBanchoResponse(BanchoResponseType.AddedReferee, m_add_ref[1]);
    }

    const m_rm_ref = message.match(/Removed (.+) from the match referees/)
    if (m_rm_ref) {
      return makeBanchoResponse(BanchoResponseType.RemovedReferee, m_rm_ref[1]);
    }

    const m_kick = message.match(/Kicked (.+) from the match/);
    if (m_kick) {
      return makeBanchoResponse(BanchoResponseType.KickedPlayer, m_kick[1]);
    }

    if (message.startsWith("Match starts in ")) {
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

    if (message.startsWith("Queued the match to start in ")) {
      const m_sec = message.match(/(\d+) seconds?/);
      const m_min = message.match(/(\d+) minutes?/);
      let secs = 0;
      if (m_sec) {
        secs += parseInt(m_sec[1]);
      }
      if (m_min) {
        secs += parseInt(m_min[1]) * 60;
      }
      return makeBanchoResponse(BanchoResponseType.MpBeganStartTimer, secs);
    }

    if (message == "Good luck, have fun!") {
      return makeBanchoResponse(BanchoResponseType.FinishStartTimer);
    }

    if (message == "Countdown aborted") {
      return makeBanchoResponse(BanchoResponseType.AbortedStartTimer);
    }

    if (message.match(/^(Room name:|Beatmap:|Team mode:|Active mods:|Players:|Slot \d+)/)) {
      return makeBanchoResponse(BanchoResponseType.Settings);
    }

    if (message == "Match referees:") {
      return makeBanchoResponse(BanchoResponseType.ListRefs);

      /* 注意点、頭文字が大文字になる、終点が明示されない
      [2019-08-31T16:09:36.892] [DEBUG] irc - @msg  BanchoBot => #mp_54496537: Match referees:
      [2019-08-31T16:09:36.892] [DEBUG] irc - @msg  BanchoBot => #mp_54496537: D_am_n
      [2019-08-31T16:09:36.892] [DEBUG] irc - @msg  BanchoBot => #mp_54496537: Gnsksz
      */
    }

    const m_roll = message.match(/(.+) rolls (\d+) point\(s\)/);
    if (m_roll) {
      return makeBanchoResponse(BanchoResponseType.Rolled, m_roll[1], parseInt(m_roll[2]));
    }

    const m_stat = message.match(/(Stats for \(|Score:\s+\d|Plays:\s+\d|Accuracy:\s+\d)/);
    if (m_stat) {
      return makeBanchoResponse(BanchoResponseType.Stats);
    }

    const m_team_change = message.match(/(.+) changed to (Blue|Red)/);
    if (m_team_change) {
      return makeBanchoResponse(BanchoResponseType.TeamChanged, m_team_change[1], (m_team_change[2] == "Blue" ? Teams.Blue : Teams.Red));
    }

    return makeBanchoResponse(BanchoResponseType.Unhandled);
  }

  ParseMpMakeResponse(nick: string, message: string): { id: string, title: string } | null {
    if (nick != "BanchoBot") return null;
    const reg = /Created the tournament match https:\/\/osu.ppy.sh\/mp\/(\d+) (.+)/;
    const res = message.match(reg);
    if (res) {
      return { id: res[1], title: res[2] };
    }
    return null;
  }

  ParseMPCommand(message: string): MpCommand | null {
    const res = message.match(/^!mp (\w+)\s*(.*)\s*/i);
    if (res) {
      return { command: res[1], arg: res[2] };
    }
    return null;
  }

  SplitCliCommand(line: string): { command: string, arg: string } {
    const l = line.match(/(\w+) (.*)/);
    if (l == null) {
      return { command: line, arg: "" };
    } else {
      return {
        command: l[1],
        arg: l[2],
      }
    }
  }

  EnsureMpChannelId(id: string): string {
    if (id == null || id == "") return "";
    if (id.match(/^#mp_\d+$/)) return id;
    if (id.match(/^\d+$/)) return "#mp_" + id;
    let m = id.match(/^https:\/\/osu\.ppy\.sh\/mp\/(\d+)$/);

    if (m) return "#mp_" + m[1];
    else return "";
  }

  /**
   * CustomCommandかの判定
   * !か*で始まる、既存のコマンドではない、!mp単独ではない
   * !mp xxx は !xxx と解釈する
   * @param message 
   */
  IsCustomCommand(message: string) {
    message = message.trimRight().toLowerCase();
    if (message[0] != "!" && message[0] != "*") return false;
    if (message == "!mp") return false;
    return message.match(/^[\!\*](?!roll|stats|where|faq|report|request)\w+/) != null;
  }

  ParseCustomCommand(message: string): { command: string, param: string } {
    message = message.trimRight();
    let m = message.match(/\!mp (\w+)\s*(.*)\s*/);
    if (m) {
      return { command: "!" + m[1].toLowerCase(), param: m[2] };
    }
    m = message.match(/([\!\*]\w+)\s*(.*)\s*/);
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
  HostChanged,
  MpHostChanged,
  UserNotFound,
  MatchStarted,
  MpMatchStarted,
  MpMatchAlreadyStarted,
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
  BeganStartTimer,
  MpBeganStartTimer,
  FinishStartTimer,
  AbortedStartTimer,
  Settings,
  ListRefs,
  Rolled,
  Stats,
  TeamChanged,
}

function makeBanchoResponse(type: BanchoResponseType, ...params: any[]) {
  return { type, params };
}

export interface BanchoResponse {
  type: BanchoResponseType;
  params: any[];
}

export const parser = new CommandParser();
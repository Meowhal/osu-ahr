/**
 * ircテキストを解析して抽象化するためのクラス
 * テキストの解析とその後の処理を分離し、テストなどを容易にすることが目的。
 */
export class CommandParser {

  ParseBanchoResponse(message: string): BanchoResponse {
    const m_joined = message.match(/(.+) joined in slot (\d+)\./);
    if (m_joined) {
      return makeBanchoResponse(BanchoResponseType.PlayerJoined, m_joined[1], parseInt(m_joined[2]));
    }

    const m_left = message.match(/(.+) left the game\./);
    if (m_left) {
      return makeBanchoResponse(BanchoResponseType.PlayerLeft, m_left[1]);
    }

    if (message == "Host is changing map...") {
      return makeBanchoResponse(BanchoResponseType.BeatmapChanging);
    }

    const m_map = message.match(/Beatmap changed to\: .+ \[.+\] \(https:\/\/osu.ppy.sh\/b\/(\d+)\)/);
    if (m_map) {
      return makeBanchoResponse(BanchoResponseType.BeatmapChanged, m_map[1]);
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

    const m_ref = message.match(/Added (.+) to the match referees/);
    if (m_ref) {
      return makeBanchoResponse(BanchoResponseType.AddedReferees, m_ref[1]);
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
    const reg = /^!mp/;
    message = message.toLowerCase();
    const res = message.match(reg);
    if (res) {
      let [_mp, command, ...args] = message.split(' ');
      switch (command) {
        case "make":
        case "invlide":
        case "host":
          const username = args.join(" ");
          return { command: command, args: [username] };

        default:
          return { command: command, args: args };
      }
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
  args: string[];
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
  AddedReferees,
}

function makeBanchoResponse(type: BanchoResponseType, ...params: any[]) {
  return { type, params };
}

export interface BanchoResponse {
  type: BanchoResponseType;
  params: any[];
}

export const parser = new CommandParser();
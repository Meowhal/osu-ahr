export class CommandParser {

  ParseBanchoResponse(message: string): BanchoResponse {
    const m_joined = message.match(/(.+) joined in slot (\d+)\./);
    if (m_joined) {
      const p = { id: m_joined[1], slot: parseInt(m_joined[2]) };
      return new BanchoResponse(BanchoResponseType.PlayerJoined, p);
    }

    const m_left = message.match(/(.+) left the game\./);
    if (m_left) {
      return new BanchoResponse(BanchoResponseType.PlayerLeft, m_left[1]);
    }

    if (message == "Host is changing map...") {
      return new BanchoResponse(BanchoResponseType.BeatmapChanging, undefined);
    }

    const m_map = message.match(/Beatmap changed to\: .+ \[.+\] \(https:\/\/osu.ppy.sh\/b\/(\d+)\)/);
    if (m_map) {
      return new BanchoResponse(BanchoResponseType.BeatmapChanged, m_map[1]);
    }

    const m_host = message.match(/(.+) became the host\./);
    if (m_host) {
      return new BanchoResponse(BanchoResponseType.HostChanged, m_host[1]);
    }

    if (message == "User not found") {
      return new BanchoResponse(BanchoResponseType.UserNotFound, undefined);
    }

    if (message == "The match has started!") {
      return new BanchoResponse(BanchoResponseType.MatchStarted, undefined);
    }

    const m_finish = message.match(/(.+) finished playing \(Score: (\d+), (PASSED|FAILED)\)\./);
    if (m_finish) {
      const p = {
        id: m_finish[1],
        score: parseInt(m_finish[2]),
        isPassed: m_finish[3] == "PASSED"
      }
      return new BanchoResponse(BanchoResponseType.PlayerFinished, p);
    }

    if (message == "The match has finished!") {
      return new BanchoResponse(BanchoResponseType.MatchFinished, undefined);
    }

    if (message == "Aborted the match") {
      return new BanchoResponse(BanchoResponseType.AbortedMatch, undefined);
    }

    if (message == "The match is not in progress") {
      return new BanchoResponse(BanchoResponseType.AbortMatchFailed, undefined);
    }

    if (message == "Closed the match") {
      return new BanchoResponse(BanchoResponseType.ClosedLobby, undefined);
    }

    if (message == "All players are ready") {
      return new BanchoResponse(BanchoResponseType.AllPlayerReady, undefined);
    }

    return new BanchoResponse(BanchoResponseType.None, undefined);
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
}

export interface MpCommand {
  command: string;
  args: string[];
}

export enum BanchoResponseType {
  None,
  PlayerJoined,
  PlayerLeft,
  BeatmapChanging,
  BeatmapChanged,
  HostChanged,
  UserNotFound,
  MatchStarted,
  PlayerFinished,
  MatchFinished,
  AbortedMatch,
  AbortMatchFailed,
  ClosedLobby,
  AllPlayerReady,
}

export class BanchoResponse {
  type: BanchoResponseType;
  param: BanchoResponseParameter;
  constructor(type: BanchoResponseType, param: BanchoResponseParameter) {
    this.type = type;
    this.param = param;
  }
}

export interface PlayerJoinedParameter {
  id: string;
  slot: number;
}

export interface PlayerFinishedParameter {
  id: string;
  score: number;
  isPassed: boolean;
}

export type BanchoResponseParameter
  = string
  | boolean
  | PlayerJoinedParameter
  | PlayerFinishedParameter
  | undefined;

export const parser = new CommandParser();
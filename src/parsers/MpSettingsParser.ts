import { Teams } from '../Player';
export interface MpSettingsResult {
  name: string;
  id: number;
  history: string;
  beatmapUrl: string;
  beatmapId: number;
  beatmapTitle: string;
  teamMode: string;
  winCondition: string;
  activeMods: string;
  players: PlayerSettings[];
  numPlayers: number;
}

export interface PlayerSettings {
  slot: number;
  ready: string;
  profile: string;
  id: number;
  name: string;
  isHost: boolean;
  options: string;
  team: Teams;
}

export class MpSettingsParser {
  result: MpSettingsResult | null = null;
  isParsing: boolean = false;
  get isParsed(): boolean {
    return !this.isParsing && this.result !== null;
  }

  feedLine(line: string): boolean {
    let m = line.match(/Room name: (.+), History: (.+?(\d+))/);
    if (m) {
      this.result = {
        name: m[1],
        id: parseInt(m[3]),
        history: m[2],
        beatmapUrl: '',
        beatmapId: 0,
        beatmapTitle: '',
        teamMode: '',
        winCondition: '',
        activeMods: '',
        numPlayers: 0,
        players: [],
      };
      this.isParsing = true;
      return true;
    }
    if (this.result === null) return false;

    m = line.match(/Beatmap: (\S+?(\d+)) (.+)/);
    if (m) {
      this.result.beatmapUrl = m[1];
      this.result.beatmapId = parseInt(m[2]);
      this.result.beatmapTitle = m[3];
      return true;
    }
    m = line.match(/Team mode: (.+), Win condition: (.+)/);
    if (m) {
      this.result.teamMode = m[1];
      this.result.winCondition = m[2];
      return true;
    }
    m = line.match(/Active mods: (.+)/);
    if (m) {
      this.result.activeMods = m[1];
      return true;
    }
    m = line.match(/Players: (\d+)/);
    if (m) {
      this.result.numPlayers = parseInt(m[1]);
      this.isParsing = this.result.numPlayers !== 0;
      return true;
    }
    m = line.match(/^Slot (\d+)\s+(.+) https:\/\/osu\.ppy\.sh\/u\/(\d+) (.{15})\s*(\[(.+)\])?$/);
    if (m) {
      const team = m[6] === undefined || !m[6].includes('Team') ? Teams.None
        : m[6].includes('Blue') ? Teams.Blue : Teams.Red;

      const p: PlayerSettings = {
        slot: parseInt(m[1]),
        ready: m[2].trim(),
        id: parseInt(m[3]),
        profile: `https://osu.ppy.sh/u/${m[3]}`,
        name: m[4].trim(),
        isHost: m[6] === undefined ? false : m[6].includes('Host'),
        team: team,
        options: m[6] === undefined ? '' : m[6].trim()
      };
      this.result.players.push(p);
      this.isParsing = this.result.players.length !== this.result.numPlayers;
      return true;
    }
    return false;
  }
}

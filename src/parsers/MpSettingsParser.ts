import { Teams } from "../Player";

export interface PlayerSettings {
  slot: number;
  ready: string;
  profile: string;
  id: string;
  isHost: boolean;
  options: string;
  team: Teams;
}

export class MpSettingsParser {
  name: string = "";
  history: string = "";
  beatmapUrl: string = "";
  beatmapId:number = 0;
  beatmapTitle: string = "";
  teamMode: string = "";
  winCondition: string = "";
  activeMods: string = "";
  players: PlayerSettings[] = [];
  private loaded_players = 0;

  parsed: boolean;

  constructor() {
    this.parsed = false;
  }

  feedLine(line: string): boolean {
    let m = line.match(/Room name: (.+), History: (.+)/);
    if (m) {
      this.name = m[1];
      this.history = m[2];
      return false;
    }
    m = line.match(/Beatmap: (\S+?(\d+)) (.+)/);
    if (m) {
      this.beatmapUrl = m[1];
      this.beatmapId = parseInt(m[2]);
      this.beatmapTitle = m[3];      
      return false;
    }
    m = line.match(/Team mode: (.+), Win condition: (.+)/);
    if (m) {
      this.teamMode = m[1];
      this.winCondition = m[2];
      return false;
    }
    m = line.match(/Active mods: (.+)/);
    if (m) {
      this.activeMods = m[1];
    }
    m = line.match(/Players: (\d+)/);
    if (m) {
      const len = parseInt(m[1]);
      this.players = new Array(len);
      this.parsed = len == 0;
      return this.parsed;
    }
    m = line.match(/^Slot (\d+)\s+(.+) (https\S+) (.{15})\s*(\[(.+)\])?$/);
    if (m) {
      if (this.players == null) {
        throw new Error("unexpected mpsetting response order");
      }

      let team = m[6] == undefined || !m[6].includes("Team") ? Teams.None
        : m[6].includes("Blue") ? Teams.Blue : Teams.Red

      const p = {
        slot: parseInt(m[1]),
        ready: m[2],
        profile: m[3],
        id: m[4].trim(),
        isHost: m[6] == undefined ? false : m[6].includes("Host"),
        team: team,
        options: m[6] == undefined ? "" : m[6]
      }
      this.players[this.loaded_players] = p;
      this.loaded_players += 1;
      this.parsed = this.players.length == this.loaded_players;
      return this.parsed;
    }
    return false;
  }
}

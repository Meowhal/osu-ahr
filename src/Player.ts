import { StatResult } from "./parsers";

export class Player {
  id: string;
  escaped_id: string;
  role: Roles = Roles.Player;
  team: Teams = Teams.None; // いつteammodeに変更されたか検知する方法がないので、正確な情報ではない
  slot: number = 0;
  mpstatus: MpStatuses = MpStatuses.None;
  laststat: StatResult | null = null;

  constructor(id: string) {
    this.id = id;
    this.escaped_id = escapeUserId(id);
  }
  is(r: Roles): boolean {
    return (this.role & r) != 0;
  }
  get isPlayer(): boolean {
    return this.is(Roles.Player);
  }
  get isHost(): boolean {
    return this.is(Roles.Host);
  }
  get isAuthorized(): boolean {
    return this.is(Roles.Authorized);
  }
  get isReferee(): boolean {
    return this.is(Roles.Referee);
  }
  get isCreator(): boolean {
    return this.is(Roles.Creator);
  }
  setRole(r: Roles): void {
    this.role |= r;
  }
  removeRole(r: Roles): void {
    this.role &= ~r;
  }
  toString(): string {
    return `Player{id:${this.id}, slot:${this.slot}, role:${this.role}}`;
  }
}

export enum Roles {
  None = 0,
  Player = 1,
  Host = 2,
  Authorized = 4,
  Referee = 8,
  Creator = 16
}

export enum Teams {
  None,
  Blue,
  Red,
}

export enum MpStatuses {
  None,
  InLobby,
  Playing,
  Finished,
}

/**
 * IDの表記ゆれを統一する
 * @param id 
 */
export function escapeUserId(id: string): string {
  return id.toLowerCase().replace(/ /g, '_');
}

/**
 * ユーザーIDを表示するときhighlightされないように名前を変更する
 * @param userid 
 */
export function disguiseUserId(userid: string): string {
  return userid[0] + "\u{200B}" + userid.substring(1);
}

/**
 *  disguiseUserIdで変更を加えた文字列をもとに戻す
 * @param disguisedId 
 */
export function revealUserId(disguisedId: string): string {
  return disguisedId.replace(/\u200B/g, "");
}

import { StatResult } from './parsers/StatParser';
import { UserProfile } from './webapi/UserProfile';

export class Player {
  id: number = 0;
  name: string;
  escaped_name: string;
  role: Roles = Roles.Player;
  team: Teams = Teams.None; // いつteammodeに変更されたか検知する方法がないので、正確な情報ではない
  slot: number = 0;
  mpstatus: MpStatuses = MpStatuses.None;
  laststat: StatResult | null = null;
  profile: UserProfile | null = null;

  constructor(name: string) {
    this.name = name;
    this.escaped_name = escapeUserName(name);
  }
  is(r: Roles): boolean {
    return (this.role & r) !== 0;
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
    return `Player{id:${this.name}, slot:${this.slot}, role:${this.role}}`;
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
 * Nameの表記ゆれを統一する
 * @param name
 */
export function escapeUserName(name: string): string {
  return name.toLowerCase().replace(/ /g, '_');
}

/**
 * UserNameを表示するときhighlightされないように名前を変更する
 * @param username
 */
export function disguiseUserName(username: string): string {
  return `${username[0]}\u{200B}${username.substring(1)}`;
}

/**
 *  disguiseUserNameで変更を加えた文字列をもとに戻す
 * @param disguisedName
 */
export function revealUserName(disguisedName: string): string {
  return disguisedName.replace(/\u200B/g, '');
}

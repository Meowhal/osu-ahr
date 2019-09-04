export class Player {
  id: string;
  escaped_id: string;
  role: Roles = Roles.Player;
  team: Teams = Teams.None; // いつteammodeに変更されたか検知する方法がないので、正確な情報ではない
  slot: number = 0;

  constructor(id: string) {
    this.id = id;
    this.escaped_id = escapeUserId(id);
  }
  is(r: Roles): boolean {
    return (this.role & r) != 0;
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


export function escapeUserId(id: string): string {
  return id.toLowerCase().replace(' ', '_');
}
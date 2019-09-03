export class Player {
  id: string;
  escaped_id: string;
  role: Role = Role.Player;
  constructor(id: string) {
    this.id = id;
    this.escaped_id = escapeUserId(id);
  }
  is(r: Role): boolean {
    return (this.role & r) != 0;
  }
  get isHost(): boolean {
    return this.is(Role.Host);
  }
  get isAuthorized(): boolean {
    return this.is(Role.Authorized);
  }
  get isReferee(): boolean {
    return this.is(Role.Referee);
  }
  get isCreator(): boolean {
    return this.is(Role.Creator);
  }
  setRole(r: Role): void {
    this.role |= r;
  }
  removeRole(r: Role): void {
    this.role &= ~r;
  }
}

export enum Role {
  None = 0,
  Player = 1,
  Host = 2,
  Authorized = 4,
  Referee = 8,
  Creator = 16
}

export function escapeUserId(id: string): string {
  return id.replace(' ', '_');
}
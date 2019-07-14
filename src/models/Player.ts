export class Player {
  id: string;
  escaped_id: string;
  constructor(id: string) {
    this.id = id;
    this.escaped_id = escapeUserId(id);
  }
}

export function escapeUserId(id: string): string {
  return id.replace(' ', '_');
}
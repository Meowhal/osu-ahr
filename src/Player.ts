export class Player {
  id: string;
  escaped_id: string;
  constructor(id: string) {
    this.id = id;
    this.escaped_id = id.replace(' ', "_");
  }
}
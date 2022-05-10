import { Player } from '../Player';

export class VoteCounter {
  readonly requiredRate: number;
  readonly requiredMin: number;
  private _passed: boolean;
  voters: Map<Player, boolean>;

  constructor(requiredRate: number, requiredMin: number) {
    this.requiredRate = requiredRate;
    this.requiredMin = requiredMin;
    this._passed = false;
    this.voters = new Map<Player, boolean>();
  }

  public Vote(player: Player): boolean {
    if (!this.voters.has(player)) return false;
    if (this.voters.get(player)) return false;
    this.voters.set(player, true);
    this.checkPassed();
    return true;
  }

  public AddVoter(player: Player): void {
    if (!this.voters.has(player)) {
      this.voters.set(player, false);
    }
  }

  public RemoveVoter(player: Player): void {
    this.voters.delete(player);
    this.checkPassed();
  }

  public Clear(): void {
    for (const k of this.voters.keys()) {
      this.voters.set(k, false);
    }
    this._passed = false;
  }

  public RemoveAllVoters(): void {
    this.voters.clear();
    this._passed = false;
  }

  get required(): number {
    return Math.ceil(Math.max(
      this.voters.size * this.requiredRate,
      this.requiredMin));
  }

  get count(): number {
    let c = 0;
    this.voters.forEach((v, k) => v ? c++ : 0);
    return c;
  }

  get passed(): boolean {
    return this._passed;
  }

  private checkPassed(): void {
    if (this.required <= this.count) {
      this._passed = true;
    }
  }

  toString(): string {
    return `${this.count} / ${this.required}`;
  }
}

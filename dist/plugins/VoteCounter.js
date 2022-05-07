"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteCounter = void 0;
class VoteCounter {
    constructor(requiredRate, requiredMin) {
        this.requiredRate = requiredRate;
        this.requiredMin = requiredMin;
        this._passed = false;
        this.voters = new Map();
    }
    Vote(player) {
        if (!this.voters.has(player))
            return false;
        if (this.voters.get(player))
            return false;
        this.voters.set(player, true);
        this.checkPassed();
        return true;
    }
    AddVoter(player) {
        if (!this.voters.has(player)) {
            this.voters.set(player, false);
        }
    }
    RemoveVoter(player) {
        this.voters.delete(player);
        this.checkPassed();
    }
    Clear() {
        for (const k of this.voters.keys()) {
            this.voters.set(k, false);
        }
        this._passed = false;
    }
    RemoveAllVoters() {
        this.voters.clear();
        this._passed = false;
    }
    get required() {
        return Math.ceil(Math.max(this.voters.size * this.requiredRate, this.requiredMin));
    }
    get count() {
        let c = 0;
        this.voters.forEach((v, k) => v ? c++ : 0);
        return c;
    }
    get passed() {
        return this._passed;
    }
    checkPassed() {
        if (this.required <= this.count) {
            this._passed = true;
        }
    }
    toString() {
        return `${this.count} / ${this.required}`;
    }
}
exports.VoteCounter = VoteCounter;
//# sourceMappingURL=VoteCounter.js.map
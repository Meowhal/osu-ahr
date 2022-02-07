"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
function trial() {
    let cases = ["a", "asdflkj", " $% BN |~=", "4-5 | alt | test @join", "あいうおaaa", "aa\n\raa"];
    for (let c of cases) {
        console.log(`${c} => ${rep(c)}`);
    }
}
exports.trial = trial;
function rep(text) {
    text = text.replace(/[^ -/:-@\[-~0-9a-zA-Z]/g, "");
    return text;
}
//# sourceMappingURL=LobbynameTrial.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
function trial() {
    const cases = ['a', 'asdflkj', ' $% BN |~=', '4-5 | alt | test @join', 'あいうおaaa', 'aa\n\raa'];
    for (const c of cases) {
        console.log(`${c} => ${rep(c)}`);
    }
}
exports.trial = trial;
function rep(text) {
    text = text.replace(/[^ -~]/g, '');
    return text;
}
//# sourceMappingURL=LobbynameTrial.js.map
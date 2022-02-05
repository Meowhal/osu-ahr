"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
const libs_1 = require("../libs");
function trial() {
    let e1 = new libs_1.TypedEvent();
    e1.once(n => console.log(`fired e1 arg = ${n}`));
    e1.emit(1);
    let e2 = new libs_1.TypedEvent();
    e2.once((t) => console.log(`fired e2 arg1 = ${t[0]} arg2 = ${t[1]}`));
    e2.emit([1, "x"]);
    let e3 = new libs_1.TypedEvent();
    e3.once((t) => console.log(`fired e2 a = ${t.a} b = ${t.b}`));
    const a = 1;
    const b = "x";
    const c = "c";
    e3.emit({ a, b });
}
exports.trial = trial;
//# sourceMappingURL=TypedEventTrials.js.map
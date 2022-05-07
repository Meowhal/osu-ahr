"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const StatParser_1 = require("../parsers/StatParser");
const testTexts = [
    'Stats for (Jason)[https://osu.ppy.sh/u/7342098] is Multiplaying:',
    'Score:    18,163,888,782 (#1631)',
    'Plays:    78245 (lv100)',
    'Accuracy: 97.36%',
    'Stats for (horcrux18)[https://osu.ppy.sh/u/8778911] is Afk:',
    'Score:    584,565,786 (#260177)',
    'Plays:    5695 (lv64)',
    'Accuracy: 86.94%',
    'Stats for (gviz)[https://osu.ppy.sh/u/15145414] is Multiplayer:',
    'Score:    00 (#0)',
    'Plays:    7 (lv2)',
    'Accuracy: 0%',
    'Stats for (Angel Arrow)[https://osu.ppy.sh/u/1970239] is Testing:',
    'Score:    59,315,895,109 (#1006)',
    'Plays:    104962 (lv102)',
    'Accuracy: 98.16%',
    'Stats for (Foreskin)[https://osu.ppy.sh/u/3760263]:',
    'Score:    00 (#0)',
    'Plays:    1 (lv1)',
    'Accuracy: 0.00%'
];
const expectedResults = [
    new StatParser_1.StatResult('Jason', 7342098, StatParser_1.StatStatuses.Multiplaying, 18163888782, 1631, 78245, 100, 97.36),
    new StatParser_1.StatResult('horcrux18', 8778911, StatParser_1.StatStatuses.Afk, 584565786, 260177, 5695, 64, 86.94),
    new StatParser_1.StatResult('gviz', 15145414, StatParser_1.StatStatuses.Multiplayer, 0, 0, 7, 2, 0),
    new StatParser_1.StatResult('Angel Arrow', 1970239, StatParser_1.StatStatuses.Testing, 59315895109, 1006, 104962, 102, 98.16),
    new StatParser_1.StatResult('Foreskin', 3760263, StatParser_1.StatStatuses.None, 0, 0, 1, 1, 0),
];
it('StatParser Test', function () {
    chai_1.assert.equal(testTexts.length, expectedResults.length * 4);
    const parser = new StatParser_1.StatParser();
    chai_1.assert.isFalse(parser.isParsed);
    chai_1.assert.isFalse(parser.isParsing);
    chai_1.assert.isNull(parser.result);
    for (let i = 0; i < expectedResults.length; i++) {
        chai_1.assert.isFalse(parser.isParsing);
        for (let j = 0; j < 4; j++) {
            chai_1.assert.isTrue(parser.feedLine(testTexts[i * 4 + j]));
            if (j !== 3) {
                chai_1.assert.isTrue(parser.isParsing);
                chai_1.assert.isFalse(parser.isParsed);
            }
        }
        chai_1.assert.isFalse(parser.isParsing);
        chai_1.assert.isTrue(parser.isParsed);
        if (parser.result !== null)
            parser.result.date = 0;
        chai_1.assert.deepEqual(parser.result, expectedResults[i]);
    }
});
//# sourceMappingURL=StatParserTest.js.map
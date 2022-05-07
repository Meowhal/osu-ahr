"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOption = void 0;
exports.validateOption = {
    number: function (name, value, min, max) {
        let v = value;
        if (typeof v !== 'number') {
            v = parseFloat(v);
        }
        if (isNaN(v)) {
            throw new Error(`Invalid number option @${name}. ${value} is not a number`);
        }
        if (min !== undefined && v < min) {
            throw new Error(`Invalid number option. @${name} must be at least ${min}`);
        }
        if (max !== undefined && max < v) {
            throw new Error(`Invalid number option. @${name} must be at most ${max}`);
        }
        return v;
    },
    bool: function (name, value) {
        let v = value;
        if (typeof v === 'string') {
            v = v.toLocaleLowerCase().trim();
            if (v === 'false') {
                v = false;
            }
            else if (v === 'true') {
                v = true;
            }
            else {
                throw new Error(`${name} (${value}) is not a boolean`);
            }
        }
        return !!v;
    }
};
//# sourceMappingURL=OptionValidator.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OahrWeb = void 0;
const config_1 = __importDefault(require("config"));
const express_1 = __importDefault(require("express"));
const OahrWebDefaultOption = config_1.default.get('OahrWeb');
class OahrWeb {
    constructor() {
        this.config = OahrWebDefaultOption;
        this.app = (0, express_1.default)();
        this.app.use(express_1.default.static(this.config.staticDir));
        this.server = this.app.listen(this.config.port, this.config.hostname, () => {
            console.log(`Server running at http://${this.config.hostname}:${this.config.port}/`);
        });
        this.app.get('/api/test/:id', (req, res, next) => {
            const re = {
                test: 'hello',
                id: req.params.id
            };
            res.json(re);
        });
    }
}
exports.OahrWeb = OahrWeb;
//# sourceMappingURL=OahrWeb.js.map
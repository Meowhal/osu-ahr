"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeferredAction = void 0;
/**
 * 延期可能な遅延実行アクションを表現するクラス。
 */
class DeferredAction {
    constructor(action) {
        this.timeId = null;
        this.action = action;
    }
    /**
     * アクションの遅延実行を開始する
     * @param delay 遅延時間 ms
     * @param param アクションに渡されるパラメータ
     * @param resetTimer 現在の遅延時間をリセットするか
     */
    start(delay, param = undefined, resetTimer = false) {
        if (this.timeId !== null && resetTimer) {
            clearTimeout(this.timeId);
            this.timeId = null;
        }
        this.param = param;
        if (this.timeId === null) {
            this.timeId = setTimeout(() => {
                this.timeId = null;
                this.action(this.param);
                this.param = undefined;
            }, delay);
            this.timeId.unref();
        }
    }
    /** 遅延実行をキャンセルする。*/
    cancel() {
        if (this.timeId !== null) {
            clearTimeout(this.timeId);
            this.timeId = null;
            this.param = undefined;
        }
    }
    /** 遅延実行が完了しているか */
    get done() {
        return this.timeId === null;
    }
}
exports.DeferredAction = DeferredAction;
//# sourceMappingURL=DeferredAction.js.map
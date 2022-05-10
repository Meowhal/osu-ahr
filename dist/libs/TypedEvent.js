"use strict";
// code from https://typescript-jp.gitbook.io/deep-dive/main-1/typed-event
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedEvent = void 0;
/** passes through events as they happen. You will not get events from before you start listening */
class TypedEvent {
    constructor() {
        this.listeners = [];
        this.listenersOncer = [];
    }
    on(listener) {
        this.listeners.push(listener);
        return {
            dispose: () => this.off(listener)
        };
    }
    once(listener) {
        this.listenersOncer.push(listener);
    }
    async() {
        return new Promise(resolve => {
            this.listenersOncer.push(a => {
                resolve(a);
            });
        });
    }
    off(listener) {
        const callbackIndex = this.listeners.indexOf(listener);
        if (callbackIndex > -1)
            this.listeners.splice(callbackIndex, 1);
    }
    emit(event) {
        /** Update any general listeners */
        this.listeners.forEach((listener) => listener(event));
        /** Clear the `once` queue */
        if (this.listenersOncer.length > 0) {
            this.listenersOncer.forEach((listener) => listener(event));
            this.listenersOncer = [];
        }
    }
    pipe(te) {
        return this.on((e) => te.emit(e));
    }
}
exports.TypedEvent = TypedEvent;
//# sourceMappingURL=TypedEvent.js.map
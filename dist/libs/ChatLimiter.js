"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySpeedLimit = void 0;
function applySpeedLimit(ircClient, tokens = 10, periodMs = 5000) {
    const queue = [];
    const waitTime = periodMs / tokens;
    let lastChatAt = 0;
    let timeId;
    const originalSay = ircClient.say.bind(ircClient);
    const sayWrapper = (target, message) => {
        message.split(/\r?\n/).filter(l => l.length > 0).forEach(l => queueMessage(target, l));
    };
    const queueMessage = (target, message) => {
        if (timeId) {
            queue.push({ target, message });
            return;
        }
        if (Date.now() < lastChatAt + waitTime) {
            queue.push({ target, message });
            waitAndSay();
            return;
        }
        originalSay(target, message);
        lastChatAt = Date.now();
    };
    const waitAndSay = () => {
        if (queue.length === 0)
            return;
        let wt = lastChatAt + waitTime - Date.now();
        if (wt < 0)
            wt = 0;
        timeId = setTimeout(() => {
            timeId = undefined;
            const task = queue.shift();
            if (task) {
                originalSay(task.target, task.message);
                lastChatAt = Date.now();
                waitAndSay();
            }
        }, wt);
    };
    ircClient.say = sayWrapper;
    return {
        dispose: () => {
            if (timeId) {
                clearTimeout(timeId);
            }
            queue.length = 0;
        }
    };
}
exports.applySpeedLimit = applySpeedLimit;
//# sourceMappingURL=ChatLimiter.js.map
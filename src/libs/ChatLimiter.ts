import { IIrcClient } from '../IIrcClient';

export function applySpeedLimit(ircClient: IIrcClient, tokens: number = 10, periodMs: number = 5000): { dispose: () => void } {
  const queue: { target: string, message: string }[] = [];
  const waitTime = periodMs / tokens;
  let lastChatAt: number = 0;
  let timeId: NodeJS.Timeout | undefined;
  const originalSay = ircClient.say.bind(ircClient);

  const sayWrapper = (target: string, message: string) => {
    message.split(/\r?\n/).filter(l => l.length > 0).forEach(l => queueMessage(target, l));
  };

  const queueMessage = (target: string, message: string) => {
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
    if (queue.length === 0) return;
    let wt = lastChatAt + waitTime - Date.now();
    if (wt < 0) wt = 0;
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

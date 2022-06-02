"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchStarter = void 0;
const CommandParser_1 = require("../parsers/CommandParser");
const LobbyPlugin_1 = require("./LobbyPlugin");
const VoteCounter_1 = require("./VoteCounter");
const TypedConfig_1 = require("../TypedConfig");
class MatchStarter extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, 'MatchStarter', 'starter');
        this.option = (0, TypedConfig_1.getConfig)(this.pluginName, option);
        this.voting = new VoteCounter_1.VoteCounter(this.option.vote_rate, this.option.vote_min);
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.PlayerJoined.on(p => this.onPlayerJoined(p.player));
        this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
        this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
        this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
        this.lobby.PluginMessage.on(a => this.onPluginMessage(a.type, a.args, a.src));
        this.lobby.ReceivedBanchoResponse.on(a => {
            switch (a.response.type) {
                case CommandParser_1.BanchoResponseType.AllPlayerReady:
                    this.onAllPlayerReady();
                    break;
                case CommandParser_1.BanchoResponseType.MatchStarted:
                    this.stopTimer();
                    break;
            }
        });
    }
    onPlayerJoined(player) {
        this.voting.AddVoter(player);
    }
    onPlayerLeft(player) {
        this.voting.RemoveVoter(player);
        if (this.lobby.isMatching)
            return;
        this.checkVoteCount();
        if (this.lobby.players.size === 0) {
            this.stopTimer();
        }
    }
    onHostChanged(player) {
        if (this.lobby.isMatching)
            return;
        this.voting.Clear();
        this.stopTimer();
    }
    onAllPlayerReady() {
        if (this.option.start_when_all_player_ready) {
            this.start();
        }
    }
    onChatCommand(player, command, param) {
        if (this.lobby.isMatching)
            return;
        switch (command) {
            case '!start':
                if (param === '') {
                    if (player.isHost) {
                        this.start();
                    }
                    else {
                        this.vote(player);
                    }
                }
                else if ((player.isHost || player.isAuthorized) && param.match(/^\d+$/)) {
                    this.startTimer(parseInt(param));
                }
                break;
            case '!stop':
            case '!abort':
                if (player.isHost || player.isAuthorized) {
                    if (this.IsSelfStartTimerActive) {
                        this.lobby.SendMessage('Aborted the match start timer.');
                        this.stopTimer();
                    }
                }
                break;
            case '*start':
                if (player.isAuthorized) {
                    this.start();
                }
        }
    }
    onPluginMessage(type, args, src) {
        if (type === 'mp_start') {
            if (args.length === 0) {
                this.start();
            }
            else {
                const count = parseInt(args[0]);
                const withhelp = args[1] !== undefined && args[1] === 'withhelp';
                this.startTimer(count, withhelp);
            }
        }
        else if (type === 'mp_abort_start') {
            this.stopTimer();
        }
    }
    vote(player) {
        if (this.voting.passed)
            return;
        if (this.voting.Vote(player)) {
            this.logger.trace(`Accepted a match start request from player ${player.name}`);
            this.checkVoteCount(true);
        }
        else {
            this.logger.trace('A match start vote was ignored.');
        }
    }
    // 投票状況を確認して、必要数に達している場合は試合を開始する
    checkVoteCount(showMessage = false) {
        if (this.voting.count !== 0 && showMessage) {
            this.lobby.DeferMessage(`Bot: Match start progress: ${this.voting.toString()}`, 'match start vote', this.option.vote_msg_defer_ms, false);
        }
        if (this.voting.passed) {
            this.lobby.DeferMessage(`Bot: Passed a match start vote: ${this.voting.toString()}`, 'match start vote', 100, true);
            this.start();
        }
    }
    startTimer(count, withHint = false) {
        if (count === 0) {
            this.start();
        }
        else {
            this.lobby.SendMessage(`Queued the match to start in ${this.secsToCountdownText(count)}${withHint ? '. (Host can stop the timer with !stop command.)' : ''}`);
            this.lobby.DeferMessage('!mp start', 'mp_start', count * 1000, true);
            if (count > 15) {
                this.lobby.DeferMessage('Match starts in 10 seconds', 'mp_start 10 sec', (count - 10) * 1000, true);
            }
        }
    }
    secsToCountdownText(secs) {
        const min = Math.floor(secs / 60);
        const sec = Math.floor(secs % 60);
        let strMin = '';
        let strAnd = '';
        let strSec = '';
        if (min > 1) {
            strMin = `${min.toString()} minutes`;
        }
        else if (min === 1) {
            strMin = '1 minute';
        }
        if (min > 0 && sec > 0) {
            strAnd = ' and ';
        }
        if (sec > 1) {
            strSec = `${sec.toString()} seconds`;
        }
        else if (sec === 1) {
            strSec = '1 second';
        }
        return `${strMin}${strAnd}${strSec}`;
    }
    start() {
        this.stopTimer();
        this.lobby.SendMessageWithCoolTime('!mp start', 'mp_start', 1000);
        this.voting.Clear();
    }
    stopTimer() {
        this.lobby.CancelDeferredMessage('mp_start');
        this.lobby.CancelDeferredMessage('mp_start 10 sec');
        this.lobby.CancelDeferredMessage('match start vote');
        if (this.lobby.isStartTimerActive) {
            this.lobby.SendMessage('!mp aborttimer');
        }
    }
    get IsSelfStartTimerActive() {
        if ('mp_start' in this.lobby.deferredMessages) {
            return !this.lobby.deferredMessages['mp_start'].done;
        }
        return false;
    }
    GetPluginStatus() {
        return `-- Match Starter --
  Vote: ${this.voting.toString()}`;
    }
}
exports.MatchStarter = MatchStarter;
//# sourceMappingURL=MatchStarter.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchAborter = void 0;
const parsers_1 = require("../parsers");
const Player_1 = require("../Player");
const LobbyPlugin_1 = require("./LobbyPlugin");
const config_1 = __importDefault(require("config"));
const VoteCounter_1 = require("./VoteCounter");
/**
 * Abort投票を受け付けるためのプラグイン
 * 試合中に進行が止まってしまった際に復帰するため
 */
class MatchAborter extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, "MatchAborter", "aborter");
        this.abortTimer = null;
        const d = config_1.default.get(this.pluginName);
        this.option = { ...d, ...option };
        this.voting = new VoteCounter_1.VoteCounter(this.option.vote_rate, this.option.vote_min);
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player));
        this.lobby.MatchStarted.on(() => this.onMatchStarted());
        this.lobby.PlayerFinished.on(a => this.onPlayerFinished(a.player, a.score, a.isPassed, a.playersFinished, a.playersInGame));
        this.lobby.MatchFinished.on(() => this.onMatchFinished());
        this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
        this.lobby.LeftChannel.on(a => this.stopTimer());
    }
    // 試合中に抜けた場合
    onPlayerLeft(player) {
        if (!this.lobby.isMatching)
            return;
        this.voting.RemoveVoter(player);
        // 母数が減るので投票とタイマーを再評価する
        this.checkVoteCount();
        this.checkAutoAbort();
        // 誰もいなくなったらタイマーを止める
        if (this.lobby.players.size == 0) {
            this.voting.Clear();
            this.stopTimer();
        }
    }
    onMatchStarted() {
        this.voting.RemoveAllVoters();
        for (let p of this.lobby.players) {
            this.voting.AddVoter(p);
        }
    }
    onPlayerFinished(player, score, isPassed, playersFinished, playersInGame) {
        this.checkAutoAbort();
    }
    onMatchFinished() {
        this.stopTimer();
    }
    onChatCommand(player, command, param) {
        if (!this.lobby.isMatching)
            return;
        if (command == "!abort") {
            if (player == this.lobby.host) {
                this.logger.trace("host(%s) sent !abort command", player.name);
                this.doAbort();
            }
            else {
                this.vote(player);
            }
        }
        else if (player.isAuthorized) {
            if (command == "*abort") {
                this.doAbort();
            }
        }
    }
    vote(player) {
        if (this.voting.passed)
            return;
        if (this.voting.Vote(player)) {
            this.logger.trace("accept abort request from %s (%s)", player.name, this.voting.toString());
            this.checkVoteCount(true);
        }
        else {
            this.logger.trace("vote from %s was ignored", player.name);
        }
    }
    // 投票数を確認して必要数に達していたら試合中断
    checkVoteCount(showMessage = false) {
        if (this.voting.count != 0 && showMessage) {
            this.lobby.DeferMessage(`bot : match abort progress: ${this.voting.toString()}`, "aborter vote", this.option.vote_msg_defer_ms, false);
        }
        if (this.voting.passed) {
            this.lobby.DeferMessage(`bot : passed abort vote: ${this.voting.toString()}`, "aborter vote", 100, true);
            this.doAbort();
        }
    }
    /** 投票の必要数 */
    get voteRequired() {
        return Math.ceil(Math.max(this.lobby.playersInGame * this.option.vote_rate, this.option.vote_min));
    }
    checkAutoAbort() {
        if (this.abortTimer == null) {
            if (this.autoAbortRequired <= this.lobby.playersFinished) { // 半数以上終了したらタイマー起動
                this.startTimer();
            }
        }
    }
    get autoAbortRequired() {
        return Math.ceil(this.lobby.playersInGame * this.option.auto_abort_rate);
    }
    doAbort() {
        this.logger.info("do abort");
        this.stopTimer();
        this.lobby.AbortMatch();
    }
    startTimer() {
        if (this.option.auto_abort_delay_ms == 0)
            return;
        this.stopTimer();
        this.logger.trace("start timer");
        this.abortTimer = setTimeout(() => {
            if (this.abortTimer != null && this.lobby.isMatching) {
                this.logger.trace("abort timer action");
                this.doAutoAbortAsync();
            }
        }, this.option.auto_abort_delay_ms);
    }
    async doAutoAbortAsync() {
        const playersStillPlaying = Array.from(this.lobby.players).filter(v => v.mpstatus == Player_1.MpStatuses.Playing);
        for (let p of playersStillPlaying) {
            if (p.mpstatus == Player_1.MpStatuses.Playing) {
                try {
                    const stat = await this.lobby.RequestStatAsync(p, true);
                    if (stat.status == parsers_1.StatStatuses.Multiplaying) {
                        this.startTimer();
                        return;
                    }
                }
                catch {
                    this.logger.warn("couldn't get players status. AutoAbortCheck was canceled.");
                }
            }
        }
        if (!this.lobby.isMatching)
            return;
        if (this.option.auto_abort_do_abort) {
            this.doAbort();
        }
        else {
            this.lobby.SendMessage("bot : if the game is stuck, abort the game with !abort vote.");
        }
    }
    stopTimer() {
        if (this.abortTimer != null) {
            this.logger.trace("stop timer");
            clearTimeout(this.abortTimer);
            this.abortTimer = null;
        }
    }
    GetPluginStatus() {
        return `-- Match Aborter -- timer : ${this.abortTimer != null ? "active" : "###"}, vote : ${this.voting.toString()}`;
    }
}
exports.MatchAborter = MatchAborter;
//# sourceMappingURL=MatchAborter.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotKeeper = exports.LobbyKeeper = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const Modes_1 = require("../Modes");
const TypedConfig_1 = require("../TypedConfig");
const OPTION_TYPE_HINTS = [
    { key: 'mode', nullable: true, type: 'string' },
    { key: 'size', nullable: true, type: 'number' },
    { key: 'password', nullable: true, type: 'string' },
    { key: 'mods', nullable: true, type: 'string' },
    { key: 'hostkick_tolerance', nullable: false, type: 'number' },
    { key: 'title', nullable: true, type: 'string' },
];
class LobbyKeeper extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, 'LobbyKeeper', 'keeper');
        this.option = (0, TypedConfig_1.getConfig)(this.pluginName, option, OPTION_TYPE_HINTS);
        this.kickedUsers = new Set();
        this.mpKickedUsers = new Set();
        this.slotKeeper = new SlotKeeper(this.option.size, this.logger);
        this.convertOptions();
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.JoinedLobby.on(a => this.onJoined());
        this.lobby.HostChanged.on(a => this.onHostChanged(a.player));
        this.lobby.MatchFinished.on(() => this.onMatchFinished());
        this.lobby.ReceivedChatCommand.on(a => this.onChatCommand(a.player, a.command, a.param));
        this.lobby.PlayerJoined.on(a => this.onPlayerJoined(a.slot));
        this.lobby.PlayerLeft.on(a => this.onPlayerLeft(a.player, a.slot));
        this.lobby.PlayerMoved.on(a => this.onPlayerMoved(a.from, a.to));
        this.lobby.ParsedSettings.on(a => this.onParsedSettings(a.result));
        this.lobby.historyRepository.kickedUser.on(a => this.onKickedPlayer(a.kickedUser));
        this.lobby.historyRepository.finishedGame.on(a => this.onFinishedGame(a.game));
    }
    convertOptions() {
        this.setModeOption(this.option.mode);
        this.setSizeOption(this.option.size);
        this.setModsOption(this.option.mods);
    }
    setModeOption(mode) {
        if (mode === null || mode === undefined || mode === 'null' || mode === '') {
            this.option.mode = null;
            return;
        }
        if (typeof mode === 'string') {
            const r = this.tryParseModeParams(mode);
            if (r) {
                this.option.mode = r;
                return;
            }
            else {
                throw new Error(`Invalid mode option. Lobby keeper mode: ${mode}`);
            }
        }
        if ('team' in mode && 'score' in mode) {
            if ((mode.team instanceof Modes_1.TeamMode) && (mode.score instanceof Modes_1.ScoreMode)) {
                this.option.mode = mode;
            }
            else {
                this.option.mode = {
                    team: Modes_1.TeamMode.from(mode.team.toString(), true),
                    score: Modes_1.ScoreMode.from(mode.score.toString(), true)
                };
            }
            return;
        }
        throw new Error(`Invalid mode option. Lobby keeper mode: ${mode}`);
    }
    setSizeOption(size) {
        if (size === null || size === undefined || size === 'null' || size === '') {
            size = 0;
        }
        if (typeof size === 'string') {
            size = parseInt(size);
        }
        if (typeof size !== 'number') {
            throw new Error(`Invalid size ${size}`);
        }
        if (size < 0 || size > 16 || isNaN(size)) {
            throw new Error(`Invalid size ${size}`);
        }
        this.option.size = size;
        this.slotKeeper.size = size;
    }
    setModsOption(mods) {
        if (mods === null || mods === undefined || mods === 'null') {
            this.option.mods = null;
            return;
        }
        if (typeof mods === 'string') {
            this.option.mods = Modes_1.Mod.parseMods(mods);
            return;
        }
        if (Array.isArray(mods)) {
            mods = mods.filter(m => m).map(m => Modes_1.Mod.from(m.toString()));
            this.option.mods = Modes_1.Mod.removeInvalidCombinations(mods);
            return;
        }
        throw new Error(`Invalid mod option. Lobby keeper mod(s): ${mods}`);
    }
    tryParseModeParams(param) {
        const m1 = /^(.+),(.+)$/.exec(param);
        if (m1) {
            try {
                const team = Modes_1.TeamMode.from(m1[1], true);
                const score = Modes_1.ScoreMode.from(m1[2], true);
                return { team, score };
            }
            catch { /* continue to parse */ }
        }
        const m2 = /^(\S+)\s+(\S+)$/.exec(param);
        if (m2) {
            try {
                const team = Modes_1.TeamMode.from(m2[1], true);
                const score = Modes_1.ScoreMode.from(m2[2], true);
                return { team, score };
            }
            catch { /* continue to parse */ }
        }
        try {
            const team = Modes_1.TeamMode.from(param, true);
            return { team, score: this.option.mode?.score ?? Modes_1.ScoreMode.Score };
        }
        catch { /* continue to parse */ }
        try {
            const score = Modes_1.ScoreMode.from(param, true);
            return { team: this.option.mode?.team ?? Modes_1.TeamMode.HeadToHead, score };
        }
        catch {
            throw new Error(`Invalid mode option. Lobby keeper mode: ${param}`);
        }
    }
    checkMode(teamMode, scoreMode) {
        if (this.option.mode === null)
            return false;
        if (this.option.mode.score !== scoreMode || this.option.mode.team !== teamMode) {
            return true;
        }
        else {
            return false;
        }
    }
    checkMods(mods) {
        if (this.option.mods === null)
            return false;
        const s = new Set(this.option.mods);
        for (const m of mods) {
            if (!s.delete(m)) {
                return true;
            }
        }
        return s.size !== 0;
    }
    checkTitle(title) {
        if (!title && (this.lobby.historyRepository.hasError || this.option.title !== this.lobby.lobbyName)) {
            return true;
        }
        else if (title !== this.option.title) {
            return true;
        }
        return false;
    }
    fixLobbyModeAndSize() {
        if (this.option.mode !== null) {
            if (this.option.size) {
                this.lobby.SendMessage(`!mp set ${this.option.mode.team.value} ${this.option.mode.score.value} ${this.option.size}`);
            }
            else {
                this.lobby.SendMessage(`!mp set ${this.option.mode.team.value} ${this.option.mode.score.value}`);
            }
        }
        else {
            if (this.option.size) {
                this.lobby.SendMessage(`!mp size ${this.option.size}`);
            }
        }
        this.slotKeeper.resetTimestamp();
    }
    fixPassword() {
        if (this.option.password !== null) {
            this.lobby.SendMessage(`!mp password ${this.option.password}`);
        }
    }
    fixTitle() {
        if (this.option.title === null)
            return;
        //Set title length to max 50
        this.option.title = this.option.title.substring(0, 50);
        this.lobby.SendMessage(`!mp name ${this.option.title}`);
    }
    fixMods() {
        if (this.option.mods !== null) {
            this.lobby.SendMessage(`!mp mods ${this.option.mods.map(m => m.value).join(' ')}`);
        }
    }
    onJoined() {
        this.fixTitle();
        this.fixLobbyModeAndSize();
        this.fixMods();
        this.fixPassword();
    }
    onParsedSettings(result) {
        try {
            const team = Modes_1.TeamMode.from(result.teamMode);
            const score = Modes_1.ScoreMode.from(result.winCondition);
            if (this.checkMode(team, score) || this.slotKeeper.checkMpSettings(result)) {
                this.fixLobbyModeAndSize();
            }
            const mods = Modes_1.Mod.parseMods(result.activeMods);
            if (this.checkMods(mods)) {
                this.fixMods();
            }
            if (this.checkTitle(result.name)) {
                this.fixTitle();
            }
        }
        catch (e) {
            this.logger.error(`@LobbyKeeper#onParsedSettings\n${e?.message}\n${e?.stack}`);
        }
    }
    onPlayerJoined(toSlot) {
        if (this.slotKeeper.checkJoin(toSlot)) {
            this.fixLobbyModeAndSize();
        }
    }
    onPlayerLeft(player, slot) {
        if (this.slotKeeper.checkLeave(slot)) {
            this.fixLobbyModeAndSize();
        }
    }
    onPlayerMoved(fromSlot, toSlot) {
        if (this.slotKeeper.checkMove(fromSlot, toSlot)) {
            this.fixLobbyModeAndSize();
        }
    }
    onKickedPlayer(u) {
        if (!this.option.hostkick_tolerance || !this.lobby.host)
            return;
        const p = this.lobby.GetPlayer(u.username);
        if (!p || this.mpKickedUsers.has(p))
            return;
        this.kickedUsers.add(p);
        this.logger.debug(`Added player ${p.name} to kicked users. Count: ${this.kickedUsers.size}`);
        if (this.option.hostkick_tolerance <= this.kickedUsers.size || p.isReferee || p.isAuthorized) {
            this.kickedUsers.clear();
            this.mpKickedUsers.clear();
            this.logger.debug(`Kick counter activated: ${this.lobby.host.name}`);
            this.lobby.SendMessage(`!mp kick ${this.lobby.host.name}`);
        }
    }
    onHostChanged(host) {
        this.kickedUsers.clear();
        this.mpKickedUsers.clear();
    }
    onChatCommand(player, command, param) {
        if (player.isAuthorized) {
            if (command.startsWith('*keep') || command.startsWith('*no')) {
                const msg = this.processCommand(command, param);
                if (msg) {
                    this.lobby.SendMessage(msg);
                    this.logger.info(msg);
                }
            }
        }
    }
    onMatchFinished() {
        this.fixPassword();
        if (this.slotKeeper.checkUnused()) {
            this.fixLobbyModeAndSize();
        }
        if (this.option.title !== null || this.option.mode !== null || this.option.mods !== null) {
            this.lobby.LoadMpSettingsAsync().catch((e) => {
                this.logger.error(`LobbyKeeper#onMatchFinished\nFailed to loadMpSettingsAsync\n${e}`);
            });
        }
    }
    onFinishedGame(game) {
        this.logger.trace(`Have finished the game -> Mode: ${game.mode}, Mode_int: ${game.mode_int}, Score type: ${game.scoring_type}, Team type: ${game.team_type}, Mod(s): ${game.mods}`);
    }
    processCommand(command, param) {
        if (command === '*keep') {
            const matchMode = /^mode(\s+(.+))?\s*$/.exec(param);
            if (matchMode) {
                if (matchMode[2] === undefined) {
                    this.logger.warn('Missing parameters. *keep mode [0-3] [0-3] e.g., *keep mode 0 0');
                    return null;
                }
                try {
                    this.setModeOption(matchMode[2]);
                    if (this.option.mode) {
                        this.fixLobbyModeAndSize();
                        return `Keeping the lobby mode ${this.option.mode.team.name}, ${this.option.mode.score.name}`;
                    }
                    else {
                        return 'Disabled keeping the lobby mode.';
                    }
                }
                catch (e) {
                    this.logger.warn(e?.message ?? 'Failed to parse the mode parameters.');
                    return null;
                }
            }
            const matchSize = /^size(\s+(\d+))?\s*$/.exec(param);
            if (matchSize) {
                if (matchSize[2] === undefined) {
                    this.logger.warn('Missing parameters. *keep size [1-16]');
                    return null;
                }
                try {
                    this.setSizeOption(matchSize[2]);
                    if (this.option.size) {
                        this.fixLobbyModeAndSize();
                        return `Keeping the lobby size ${this.option.size}`;
                    }
                    else {
                        return 'Disabled keeping the lobby size.';
                    }
                }
                catch (e) {
                    this.logger.warn(e?.message ?? 'Failed to parse the size parameters.');
                    return null;
                }
            }
            const matchMods = /^mods?(\s+(.+))?\s*$/.exec(param);
            if (matchMods) {
                if (matchMods[2] === undefined) {
                    this.logger.warn('Missing parameters. *keep mods [mod] ([mod]) ([mod]) ...');
                    return null;
                }
                try {
                    this.setModsOption(matchMods[2]);
                    if (this.option.mods) {
                        this.fixMods();
                        return `Keeping the lobby mod(s) ${this.option.mods === null || this.option.mods.length === 0 ? 'None' : this.option.mods.map(m => m.name).join(', ')}`;
                    }
                    else {
                        return 'Disabled keeping the lobby mods.';
                    }
                }
                catch (e) {
                    this.logger.warn(e?.message ?? 'Failed to parse the mods.');
                    return null;
                }
            }
            const matchPassword = /^password(\s+(.+))?\s*$/.exec(param);
            if (matchPassword) {
                this.option.password = matchPassword[2] !== undefined ? matchPassword[2] : '';
                this.fixPassword();
                return `Keeping the lobby password ${this.option.password !== '' ? this.option.password : '[empty]'}`;
            }
            const matchTitle = /^(title|name)(\s+(.+))?\s*$/.exec(param);
            if (matchTitle) {
                this.option.title = matchTitle[3] !== undefined ? matchTitle[3] : '';
                this.fixTitle();
                return `Keeping the lobby title ${this.option.title !== '' ? this.option.title : '[empty]'}`;
            }
            this.logger.warn('Missing parameters. *keep <mode|size|mods|password|title> ...parameters');
        }
        if (command === '*no') {
            if (param === 'keep mode' && this.option.mode !== null) {
                this.setModeOption(null);
                return 'Disabled keeping the lobby team and score modes.';
            }
            if (param === 'keep size' && this.option.size !== 0) {
                this.setSizeOption(0);
                return 'Disabled keeping the lobby size.';
            }
            if ((param === 'keep mod' || param === 'keep mods') && this.option.mods !== null) {
                this.setModsOption(null);
                return 'Disabled keeping the lobby mods.';
            }
            if (param === 'keep password' && this.option.password !== null) {
                if (this.option.password !== '') {
                    this.option.password = '';
                    this.fixPassword();
                }
                this.option.password = null;
                return 'Disabled keeping the lobby password.';
            }
            if ((param === 'keep title' || param === 'keep name') && this.option.title !== null) {
                this.option.title = null;
                return 'Disabled keeping the room title.';
            }
            if (param.startsWith('keep')) {
                this.logger.warn('Missing parameters. *no keep <mode|size|mods|password|title>');
            }
        }
        return null;
    }
    getDescription() {
        const keeps = [];
        if (this.option.mode) {
            keeps.push(`Mode: ${this.option.mode.team.name}, ${this.option.mode.score.name}`);
        }
        if (this.option.size !== 0) {
            keeps.push(`Size: ${this.option.size}`);
        }
        if (this.option.password) {
            keeps.push(`Password: ${this.option.password !== '' ? this.option.password : '(empty)'}`);
        }
        if (this.option.mods) {
            keeps.push(`Mod(s): ${this.option.mods.map(m => m.value).join(' ')}`);
        }
        if (this.option.title) {
            keeps.push(`Title: ${this.option.title}`);
        }
        return keeps.join(', ');
    }
    GetPluginStatus() {
        return `-- Lobby Keeper --
  ${this.getDescription()}`;
    }
}
exports.LobbyKeeper = LobbyKeeper;
class SlotKeeper {
    constructor(size = 16, logger) {
        /**
         * スロットがロックされているとみなすまでのミリ秒時間
         */
        this.timeToConsiderAsLockedSlotMS = 10 * 60 * 1000;
        this.size = size;
        this.slots = new Array(16).fill(null).map(_ => ({ timestamp: Date.now(), hasPlayer: false }));
        this.logger = logger;
    }
    checkJoin(slot) {
        let result = false;
        const idx = slot - 1;
        if (this.size === 0) {
            // do nothing
        }
        else if (this.size <= idx) {
            result = true;
            // Slots larger than the specified size are open
            this.logger?.trace(`Detected a slot expansion. Actual size: ${slot}, Specified size: ${this.size}`);
        }
        else { // 一度に複数のイベントを発生させないために else句を使う
            for (let i = 0; i < idx; i++) {
                // the player didn't enter the slot that shold be empty
                if (!this.slots[i].hasPlayer) {
                    result = true;
                    this.logger?.trace(`Detected a locked slot: ${i + 1}`);
                    break;
                }
            }
        }
        this.slots[idx].hasPlayer = true;
        this.slots[idx].timestamp = Date.now();
        return result;
    }
    checkLeave(slot) {
        const idx = slot - 1;
        this.slots[idx].hasPlayer = false;
        this.slots[idx].timestamp = Date.now();
        return false;
    }
    checkMove(fromSlot, toSlot) {
        let result = false;
        const fromIdx = fromSlot - 1;
        this.slots[fromIdx].hasPlayer = false;
        this.slots[fromIdx].timestamp = Date.now();
        const toIdx = toSlot - 1;
        if (this.size !== 0 && this.size <= toIdx) {
            // Slots larger than the specified size are open
            result = true;
            this.logger?.trace(`Detected a slot expansion. Actual size: ${toSlot}, Specified size: ${this.size}`);
        }
        this.slots[toIdx].hasPlayer = true;
        this.slots[toIdx].timestamp = Date.now();
        return result;
    }
    checkUnused() {
        if (this.size === 0)
            return false;
        const now = Date.now();
        let estematedSize = -1;
        let lockedSlot = -1;
        for (let i = 0; i < this.size; i++) {
            if (!this.slots[i].hasPlayer) {
                const durationEmpty = now - this.slots[i].timestamp;
                if (lockedSlot === -1 && this.timeToConsiderAsLockedSlotMS <= durationEmpty) {
                    lockedSlot = i + 1;
                    continue;
                }
            }
            estematedSize = i + 1;
        }
        if (lockedSlot !== -1) {
            this.logger?.trace(`Detected a locked slot: ${lockedSlot}`);
            return true;
        }
        else {
            return false;
        }
    }
    resetTimestamp() {
        const now = Date.now();
        for (let i = 0; i < 16; i++) {
            this.slots[i].timestamp = now;
        }
    }
    checkMpSettings(setting) {
        for (let idx = 0; idx < 16; idx++) {
            this.slots[idx].hasPlayer = false;
        }
        let result = false;
        for (const ps of setting.players) {
            const idx = ps.slot - 1;
            this.slots[idx].hasPlayer = true;
            this.slots[idx].timestamp = Date.now();
            if (this.size !== 0 && this.size < ps.slot) {
                result = true;
            }
        }
        return result;
    }
}
exports.SlotKeeper = SlotKeeper;
//# sourceMappingURL=LobbyKeeper.js.map
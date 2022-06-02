"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMapcheckerOwnerCommand = exports.MapValidator = exports.secToTimeNotation = exports.MapChecker = void 0;
const LobbyPlugin_1 = require("./LobbyPlugin");
const OptionValidator_1 = require("../libs/OptionValidator");
const Modes_1 = require("../Modes");
const CommandParser_1 = require("../parsers/CommandParser");
const BeatmapRepository_1 = require("../webapi/BeatmapRepository");
const TypedConfig_1 = require("../TypedConfig");
class MapChecker extends LobbyPlugin_1.LobbyPlugin {
    constructor(lobby, option = {}) {
        super(lobby, 'MapChecker', 'mapChecker');
        this.lastMapId = 0;
        this.checkingMapId = 0;
        this.numViolations = 0;
        const d = (0, TypedConfig_1.getConfig)(this.pluginName, option);
        validateMapCheckerOption(d);
        this.option = d;
        if (this.option.gamemode instanceof Modes_1.PlayMode) {
            this.lobby.gameMode = this.option.gamemode;
        }
        this.validator = new MapValidator(this.option, this.logger);
        this.registerEvents();
    }
    registerEvents() {
        this.lobby.JoinedLobby.once(a => this.onJoinedLobby());
        this.lobby.ReceivedChatCommand.on(a => this.onReceivedChatCommand(a.command, a.param, a.player));
        this.lobby.ReceivedBanchoResponse.on(a => {
            switch (a.response.type) {
                case CommandParser_1.BanchoResponseType.BeatmapChanged:
                    this.onBeatmapChanged(a.response.params[0], a.response.params[1]);
                    break;
                case CommandParser_1.BanchoResponseType.HostChanged:
                    this.cancelCheck();
                    break;
                case CommandParser_1.BanchoResponseType.BeatmapChanging:
                    this.checkingMapId = 0;
                    break;
                case CommandParser_1.BanchoResponseType.MatchStarted:
                    this.onMatchStarted();
                    break;
            }
        });
    }
    onJoinedLobby() {
        if (this.option.enabled) {
            this.SendPluginMessage('enabledMapChecker');
        }
    }
    onMatchStarted() {
        if (this.checkingMapId) {
            this.lastMapId = this.checkingMapId;
        }
        this.cancelCheck();
    }
    onBeatmapChanged(mapId, mapTitle) {
        if (this.option.enabled) {
            this.checkingMapId = mapId;
            this.check(mapId, mapTitle);
        }
    }
    onReceivedChatCommand(command, param, player) {
        if (command === '!r' || command === '!regulation') {
            this.lobby.SendMessageWithCoolTime(this.getRegulationDescription(), 'regulation', 10000);
            return;
        }
        if (player.isAuthorized) {
            this.processOwnerCommand(command, param);
        }
    }
    processOwnerCommand(command, param) {
        try {
            const p = parseMapcheckerOwnerCommand(command, param);
            if (p === undefined)
                return;
            if (p.enabled !== undefined) {
                this.SetEnabled(p.enabled);
            }
            if (p.num_violations_allowed !== undefined) {
                this.option.num_violations_allowed = p.num_violations_allowed;
                this.logger.info(`Number of allowed violations set to ${p.num_violations_allowed}`);
            }
            let changed = false;
            if (p.star_min !== undefined) {
                this.option.star_min = p.star_min;
                if (this.option.star_max <= this.option.star_min && this.option.star_max > 0) {
                    this.option.star_max = 0;
                }
                changed = true;
            }
            if (p.star_max !== undefined) {
                this.option.star_max = p.star_max;
                if (this.option.star_max <= this.option.star_min && this.option.star_max > 0) {
                    this.option.star_min = 0;
                }
                changed = true;
            }
            if (p.length_min !== undefined) {
                this.option.length_min = p.length_min;
                if (this.option.length_max <= this.option.length_min && this.option.length_max > 0) {
                    this.option.length_max = 0;
                }
                changed = true;
            }
            if (p.length_max !== undefined) {
                this.option.length_max = p.length_max;
                if (this.option.length_max <= this.option.length_min && this.option.length_max > 0) {
                    this.option.length_min = 0;
                }
                changed = true;
            }
            if (p.gamemode !== undefined) {
                this.option.gamemode = p.gamemode;
                this.lobby.gameMode = p.gamemode;
                changed = true;
            }
            if (p.allow_convert !== undefined) {
                this.option.allow_convert = p.allow_convert;
                changed = true;
            }
            if (changed) {
                const m = `New regulation: ${this.validator.GetDescription()}`;
                this.lobby.SendMessage(m);
                this.logger.info(m);
            }
        }
        catch (e) {
            this.logger.warn(`@MapChecker#processOwnerCommand\n${e.message}\n${e.stack}`);
        }
    }
    getRegulationDescription() {
        if (this.option.enabled) {
            return this.validator.GetDescription();
        }
        else {
            return `Disabled (${this.validator.GetDescription()})`;
        }
    }
    SetEnabled(v) {
        if (v === this.option.enabled)
            return;
        if (v) {
            this.SendPluginMessage('enabledMapChecker');
            this.lobby.SendMessage('Map Checker plugin enabled.');
            this.logger.info('Map Checker plugin enabled.');
        }
        else {
            this.SendPluginMessage('disabledMapChecker');
            this.lobby.SendMessage('Map Checker plugin disabled.');
            this.logger.info('Map Checker plugin disabled.');
        }
        this.option.enabled = v;
    }
    async cancelCheck() {
        this.checkingMapId = 0;
        this.numViolations = 0;
    }
    async check(mapId, mapTitle) {
        if (mapId === this.lastMapId)
            return;
        try {
            const map = await BeatmapRepository_1.BeatmapRepository.getBeatmap(mapId, this.option.gamemode, this.option.allow_convert);
            if (mapId !== this.checkingMapId) {
                this.logger.info(`The target beatmap has already been changed. Checked beatmap: ${mapId}, Current: ${this.checkingMapId}`);
                return;
            }
            const r = this.validator.RateBeatmap(map);
            if (r.rate > 0) {
                this.rejectMap(r.message, true);
            }
            else {
                this.acceptMap(map);
            }
        }
        catch (e) {
            if (e instanceof BeatmapRepository_1.FetchBeatmapError) {
                switch (e.reason) {
                    case BeatmapRepository_1.FetchBeatmapErrorReason.FormatError:
                        this.logger.error(`Failed to parse the webpage. Checked beatmap: ${mapId}`);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotFound:
                        this.logger.info(`Beatmap cannot be found. Checked beatmap: ${mapId}`);
                        this.rejectMap(`[https://osu.ppy.sh/b/${mapId} ${mapTitle}] had already been removed from the website.`, false);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.PlayModeMismatched:
                        this.logger.info(`Gamemode mismatched. Checked beatmap: ${mapId}`);
                        this.rejectMap(`[https://osu.ppy.sh/b/${mapId} ${mapTitle}] is not ${this.option.gamemode.officialName} beatmap. Pick ${this.option.gamemode.officialName} beatmap.`, false);
                        break;
                    case BeatmapRepository_1.FetchBeatmapErrorReason.NotAvailable:
                        this.logger.info(`Beatmap is not available. Checked beatmap: ${mapId}`);
                        this.rejectMap(`[https://osu.ppy.sh/b/${mapId} ${mapTitle}] is not available for download.`, false);
                        break;
                }
            }
            else {
                this.logger.error(`@MapChecker#check\nThere was an error while checking beatmap ${mapId}\n${e.message}\n${e.stack}`);
            }
        }
    }
    skipHost() {
        const msg = `The number of violations has reached ${this.option.num_violations_allowed}. Skipped player ${this.lobby.host?.escaped_name}`;
        this.logger.info(msg);
        this.lobby.SendMessage(msg);
        this.SendPluginMessage('skip');
    }
    rejectMap(reason, showRegulation) {
        this.numViolations += 1;
        this.logger.info(`Rejected the beatmap selected by ${this.lobby.host?.escaped_name} (${this.numViolations} / ${this.option.num_violations_allowed})`);
        if (showRegulation) {
            this.lobby.SendMessage(`!mp map ${this.lastMapId} ${this.option.gamemode.value} | Current regulation: ${this.validator.GetDescription()}`);
            this.lobby.SendMessage(reason);
            this.lobby.SendMessage('Attention! Star rating will not be calculated correctly if a global mod is applied.');
        }
        else {
            this.lobby.SendMessage(`!mp map ${this.lastMapId} ${this.option.gamemode.value} | ${reason}`);
        }
        this.checkingMapId = 0;
        if (this.option.num_violations_allowed !== 0 && this.option.num_violations_allowed <= this.numViolations) {
            this.skipHost();
        }
    }
    acceptMap(map) {
        this.SendPluginMessage('validatedMap');
        this.lastMapId = this.lobby.mapId;
        if (map.beatmapset) {
            const desc = this.getMapDescription(map, map.beatmapset);
            this.lobby.SendMessage(`!mp map ${this.lobby.mapId} ${this.option.gamemode.value} | ${desc}`);
        }
        else {
            this.lobby.SendMessage(`!mp map ${this.lobby.mapId} ${this.option.gamemode.value}`);
        }
    }
    getMapDescription(map, set) {
        let desc = this.option.map_description;
        desc = desc.replace(/\$\{title\}/g, set.title);
        desc = desc.replace(/\$\{map_id\}/g, map.id.toString());
        desc = desc.replace(/\$\{beatmapset_id\}/g, set.id.toString());
        desc = desc.replace(/\$\{star\}/g, map.difficulty_rating.toFixed(2));
        desc = desc.replace(/\$\{length\}/g, secToTimeNotation(map.total_length));
        return desc;
    }
    GetPluginStatus() {
        return `-- Map Checker --
  Regulation: ${this.getRegulationDescription()}`;
    }
}
exports.MapChecker = MapChecker;
function secToTimeNotation(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec - m * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
exports.secToTimeNotation = secToTimeNotation;
class MapValidator {
    constructor(option, logger) {
        this.option = option;
        this.logger = logger;
    }
    RateBeatmap(map) {
        let rate = 0;
        const violationMsgs = [];
        const mapmode = Modes_1.PlayMode.from(map.mode);
        if (mapmode !== this.option.gamemode && this.option.gamemode !== null) {
            violationMsgs.push(`the gamemode is not ${this.option.gamemode.officialName}.`);
            rate += 1;
        }
        if (this.option.star_min > 0 && map.difficulty_rating < this.option.star_min) {
            rate += parseFloat((this.option.star_min - map.difficulty_rating).toFixed(2));
            violationMsgs.push('the beatmap star rating is lower than the allowed star rating.');
        }
        if (this.option.star_max > 0 && this.option.star_max < map.difficulty_rating) {
            rate += parseFloat((map.difficulty_rating - this.option.star_max).toFixed(2));
            violationMsgs.push('the beatmap star rating is higher than the allowed star rating.');
        }
        if (this.option.length_min > 0 && map.total_length < this.option.length_min) {
            rate += (this.option.length_min - map.total_length) / 60.0;
            violationMsgs.push('the beatmap length is shorter than the allowed length.');
        }
        if (this.option.length_max > 0 && this.option.length_max < map.total_length) {
            rate += (map.total_length - this.option.length_max) / 60.0;
            violationMsgs.push('the beatmap length is longer than the allowed length.');
        }
        if (rate > 0) {
            let message;
            const mapDesc = `[${map.url} ${map.beatmapset?.title}] (Star rating: ${map.difficulty_rating}, Length: ${secToTimeNotation(map.total_length)})`;
            if (violationMsgs.length === 1) {
                message = `${mapDesc} was rejected because ${violationMsgs[0]}`;
            }
            else {
                message = `${mapDesc} was rejected because of following reason:\n${violationMsgs.map(m => `- ${m}`).join('\n')}`;
            }
            return { rate, message };
        }
        else {
            return { rate: 0, message: '' };
        }
    }
    GetDescription() {
        let d_star = '';
        let d_length = '';
        let d_gamemode = `Mode: ${this.option.gamemode.officialName}`;
        if (this.option.gamemode !== Modes_1.PlayMode.Osu) {
            if (this.option.allow_convert) {
                d_gamemode += ' (Converts allowed)';
            }
            else {
                d_gamemode += ' (Converts disallowed)';
            }
        }
        if (this.option.star_min > 0 && this.option.star_max > 0) {
            d_star = `${this.option.star_min.toFixed(2)} <= star rating <= ${this.option.star_max.toFixed(2)}`;
        }
        else if (this.option.star_min > 0) {
            d_star = `${this.option.star_min.toFixed(2)} <= star rating`;
        }
        else if (this.option.star_max > 0) {
            d_star = `star rating <= ${this.option.star_max.toFixed(2)}`;
        }
        if (this.option.length_min > 0 && this.option.length_max > 0) {
            d_length = `${secToTimeNotation(this.option.length_min)} <= length <= ${secToTimeNotation(this.option.length_max)}`;
        }
        else if (this.option.length_min > 0) {
            d_length = `${secToTimeNotation(this.option.length_min)} <= length`;
        }
        else if (this.option.length_max > 0) {
            d_length = `length <= ${secToTimeNotation(this.option.length_max)}`;
        }
        return [d_star, d_length, d_gamemode].filter(d => d !== '').join(', ');
    }
}
exports.MapValidator = MapValidator;
function validateMapCheckerOption(option) {
    if (option.enabled !== undefined) {
        option.enabled = OptionValidator_1.validateOption.bool('MapChecker.enabled', option.enabled);
    }
    if (option.star_min !== undefined) {
        option.star_min = OptionValidator_1.validateOption.number('MapChecker.star_min', option.star_min, 0);
    }
    if (option.star_max !== undefined) {
        option.star_max = OptionValidator_1.validateOption.number('MapChecker.star_max', option.star_max, 0);
    }
    if (option.length_min !== undefined) {
        option.length_min = OptionValidator_1.validateOption.number('MapChecker.length_min', option.length_min, 0);
    }
    if (option.length_max !== undefined) {
        option.length_max = OptionValidator_1.validateOption.number('MapChecker.length_max', option.length_max, 0);
    }
    if (option.star_max !== undefined && option.star_min !== undefined && option.star_max <= option.star_min && option.star_max > 0) {
        option.star_min = 0;
    }
    if (option.length_max !== undefined && option.length_min !== undefined && option.length_max <= option.length_min && option.length_max > 0) {
        option.length_min = 0;
    }
    if (option.gamemode !== undefined) {
        if (typeof option.gamemode === 'string') {
            try {
                option.gamemode = Modes_1.PlayMode.from(option.gamemode, true);
            }
            catch {
                throw new Error('MapChecker#validateMapCheckerOption: Option must be [osu | fruits | taiko | mania]');
            }
        }
        if (!(option.gamemode instanceof Modes_1.PlayMode)) {
            throw new Error('MapChecker#validateMapCheckerOption: Option must be [osu | fruits | taiko | mania]');
        }
    }
    if (option.num_violations_to_skip !== undefined) {
        option.num_violations_allowed = option.num_violations_to_skip;
    }
    if (option.num_violations_allowed !== undefined) {
        option.num_violations_allowed = OptionValidator_1.validateOption.number('MapChecker.num_violations_allowed', option.num_violations_allowed, 0);
    }
    if (option.allowConvert !== undefined) {
        option.allow_convert = option.allowConvert;
    }
    if (option.allow_convert !== undefined) {
        option.allow_convert = OptionValidator_1.validateOption.bool('MapChecker.allow_convert', option.allow_convert);
    }
    return true;
}
/**
 * function for processing owner commands
 * Separated from MapChecker for ease of testing
 */
function parseMapcheckerOwnerCommand(command, param) {
    let option = undefined;
    command = command.toLocaleLowerCase();
    if (command === '*mapchecker_enable') {
        return { enabled: true };
    }
    if (command === '*mapchecker_disable') {
        option = { enabled: false };
    }
    if (command.startsWith('*regulation')) {
        if (param.indexOf('=') !== -1) {
            option = parseRegulationSetter(param);
        }
        else {
            const params = param.split(/\s+/).map(s => s.toLowerCase()).filter(s => s !== '');
            option = parseRegulationCommand(params);
        }
    }
    if (command === '*no' && param.startsWith('regulation')) {
        const params = param.split(/\s+/).map(s => s.toLowerCase()).filter(s => s !== '');
        if (params.length === 1) {
            option = { enabled: false };
        }
        else {
            option = parseNoRegulationCommand(params[1]);
        }
    }
    if (option !== undefined) {
        validateMapCheckerOption(option);
    }
    return option;
}
exports.parseMapcheckerOwnerCommand = parseMapcheckerOwnerCommand;
function parseRegulationCommand(params) {
    switch (unifyParamName(params[0])) {
        case 'enabled':
            return { enabled: true };
        case 'disabled':
            return { enabled: false };
        case 'num_violations_allowed':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation num_violations_allowed [number]');
            return { num_violations_allowed: params[1] };
        case 'star_min':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation star_min [number]');
            return { star_min: params[1] };
        case 'star_max':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation star_max [number]');
            return { star_max: params[1] };
        case 'length_min':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation length_min [number]');
            return { length_min: params[1] };
        case 'length_max':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation length_max [number]');
            return { length_max: params[1] };
        case 'gamemode':
            if (params.length < 2)
                throw new Error('Missing parameter. *regulation gamemode [osu | fruits | taiko | mania]');
            return { gamemode: params[1] };
        case 'allow_convert':
            if (params.length < 2) {
                return { allow_convert: true };
            }
            else {
                return { allow_convert: params[1] };
            }
        case 'disallow_convert':
            return { allow_convert: false };
    }
    throw new Error('Missing parameter. *regulation [enable | disable | star_min | star_max | length_min | length_max | gamemode | num_violations_allowed] <...params>');
}
function parseNoRegulationCommand(param) {
    switch (unifyParamName(param)) {
        case 'num_violations_allowed':
            return { num_violations_allowed: 0 };
        case 'star_min':
            return { star_min: 0 };
        case 'star_max':
            return { star_max: 0 };
        case 'length_min':
            return { length_min: 0 };
        case 'length_max':
            return { length_max: 0 };
        case 'gamemode':
            return { gamemode: Modes_1.PlayMode.Osu, allow_convert: true };
        case 'allow_convert':
            return { allow_convert: false };
    }
}
function parseRegulationSetter(param) {
    const result = {};
    for (const m of param.matchAll(/([0-9a-zA-Z_-]+)\s*=\s*([^\s,]+)/g)) {
        const name = unifyParamName(m[1]);
        const value = m[2];
        result[name] = value;
    }
    return result;
}
function unifyParamName(name) {
    name = name.toLowerCase();
    if (name.includes('star') || name.includes('diff')) {
        if (name.includes('low') || name.includes('min')) {
            return 'star_min';
        }
        else if (name.includes('up') || name.includes('max')) {
            return 'star_max';
        }
    }
    else if (name.includes('len')) {
        if (name.includes('low') || name.includes('min')) {
            return 'length_min';
        }
        else if (name.includes('up') || name.includes('max')) {
            return 'length_max';
        }
    }
    else if (name.startsWith('enable')) {
        return 'enabled';
    }
    else if (name.startsWith('disable')) {
        return 'disabled';
    }
    else if (name === 'num_violations_to_skip' || name.includes('violations')) {
        return 'num_violations_allowed';
    }
    else if (name === 'allowconvert') {
        return 'allow_convert';
    }
    else if (name === 'disallowconvert') {
        return 'disallow_convert';
    }
    return name;
}
//# sourceMappingURL=MapChecker.js.map
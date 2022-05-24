"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revealUserName = exports.disguiseUserName = exports.escapeUserName = exports.MpStatuses = exports.Teams = exports.Roles = exports.Player = void 0;
class Player {
    constructor(name) {
        this.id = 0;
        this.role = Roles.Player;
        this.team = Teams.None; // いつteammodeに変更されたか検知する方法がないので、正確な情報ではない
        this.slot = 0;
        this.mpstatus = MpStatuses.None;
        this.laststat = null;
        this.profile = null;
        this.name = name;
        this.escaped_name = escapeUserName(name);
    }
    is(r) {
        return (this.role & r) !== 0;
    }
    get isPlayer() {
        return this.is(Roles.Player);
    }
    get isHost() {
        return this.is(Roles.Host);
    }
    get isAuthorized() {
        return this.is(Roles.Authorized);
    }
    get isReferee() {
        return this.is(Roles.Referee);
    }
    get isCreator() {
        return this.is(Roles.Creator);
    }
    setRole(r) {
        this.role |= r;
    }
    removeRole(r) {
        this.role &= ~r;
    }
    toString() {
        return `Player{id:${this.name}, slot:${this.slot}, role:${this.role}}`;
    }
}
exports.Player = Player;
var Roles;
(function (Roles) {
    Roles[Roles["None"] = 0] = "None";
    Roles[Roles["Player"] = 1] = "Player";
    Roles[Roles["Host"] = 2] = "Host";
    Roles[Roles["Authorized"] = 4] = "Authorized";
    Roles[Roles["Referee"] = 8] = "Referee";
    Roles[Roles["Creator"] = 16] = "Creator";
})(Roles = exports.Roles || (exports.Roles = {}));
var Teams;
(function (Teams) {
    Teams[Teams["None"] = 0] = "None";
    Teams[Teams["Blue"] = 1] = "Blue";
    Teams[Teams["Red"] = 2] = "Red";
})(Teams = exports.Teams || (exports.Teams = {}));
var MpStatuses;
(function (MpStatuses) {
    MpStatuses[MpStatuses["None"] = 0] = "None";
    MpStatuses[MpStatuses["InLobby"] = 1] = "InLobby";
    MpStatuses[MpStatuses["Playing"] = 2] = "Playing";
    MpStatuses[MpStatuses["Finished"] = 3] = "Finished";
})(MpStatuses = exports.MpStatuses || (exports.MpStatuses = {}));
/**
 * Nameの表記ゆれを統一する
 * @param name
 */
function escapeUserName(name) {
    return name.toLowerCase().replace(/ /g, '_');
}
exports.escapeUserName = escapeUserName;
/**
 * UserNameを表示するときhighlightされないように名前を変更する
 * @param username
 */
function disguiseUserName(username) {
    return `${username[0]}\u{200B}${username.substring(1)}`;
}
exports.disguiseUserName = disguiseUserName;
/**
 *  disguiseUserNameで変更を加えた文字列をもとに戻す
 * @param disguisedName
 */
function revealUserName(disguisedName) {
    return disguisedName.replace(/\u200B/g, '');
}
exports.revealUserName = revealUserName;
//# sourceMappingURL=Player.js.map
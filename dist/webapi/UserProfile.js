"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimProfile = void 0;
/**
 * データ容量節約のため、余計なデータを取り除く
 */
function trimProfile(data) {
    return {
        avatar_url: data.avatar_url,
        country_code: data.country_code,
        default_group: data.default_group,
        id: data.id,
        is_active: data.is_active,
        is_bot: data.is_bot,
        is_online: data.is_online,
        is_supporter: data.is_supporter,
        last_visit: data.last_visit,
        pm_friends_only: data.pm_friends_only,
        username: data.username,
        join_date: data.join_date,
        country: { code: data.country.code, name: data.country.name },
        previous_usernames: data.previous_usernames,
        statistics: data.statistics,
        support_level: data.support_level,
        get_time: data.get_time
    };
}
exports.trimProfile = trimProfile;
//# sourceMappingURL=UserProfile.js.map
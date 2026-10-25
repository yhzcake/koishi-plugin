import { Context } from 'koishi';
import { DeviceInfo } from './vault';
import { Game } from './client';
export interface Passport {
    id: string;
    platform: string;
    userId: string;
    ltuid: string;
    cookie: string;
    stoken: string;
    device: string;
    enabled: boolean;
    communityEnabled: boolean;
    followMissions: boolean;
    fpExpires: string;
    lastMissionDay: string;
}
export interface GameRole {
    id: string;
    platform: string;
    userId: string;
    ltuid: string;
    game: string;
    uid: string;
    region: string;
    current: boolean;
    lastDay: string;
}
declare module 'koishi' {
    interface Tables {
        miyoushe_passport: Passport;
        miyoushe_role: GameRole;
    }
}
export declare const gameBiz: Record<string, Game>;
export type DiscoveredRole = {
    game: Game;
    uid: string;
    region: string;
};
export declare function parseCookie(cookie: string, kind: 'ck' | 'stoken'): {
    ltuid: string;
    cookie: string;
};
export declare function createAccounts(ctx: Context, keyText: string): {
    id: (...parts: string[]) => string;
    passport: (platform: string, userId: string, ltuid: string) => Promise<Passport>;
    passports: (platform: string, userId: string) => Promise<Passport[]>;
    all: () => Promise<Passport[]>;
    roles: (platform: string, userId: string) => Promise<GameRole[]>;
    save(platform: string, userId: string, ltuid: string, cookie: string, roles: DiscoveredRole[]): Promise<{
        id: string;
        platform: string;
        userId: string;
        ltuid: string;
        game: "zzz" | "bh3" | "bh2" | "gs" | "sr" | "wd";
        uid: string;
        region: string;
        current: boolean;
        lastDay: string;
    }[]>;
    saveToken(platform: string, userId: string, ltuid: string, token: string): Promise<boolean>;
    removeToken(platform: string, userId: string, ltuid: string): Promise<boolean>;
    use<T>(platform: string, userId: string, ltuid: string, kind: "ck" | "stoken", callback: (secret: string, row: Passport) => Promise<T>): Promise<T>;
    device<T>(platform: string, userId: string, ltuid: string, callback: (device?: DeviceInfo) => Promise<T>): Promise<T>;
    setDevice(platform: string, userId: string, ltuid: string, device?: DeviceInfo): Promise<boolean>;
    saveFingerprint(platform: string, userId: string, ltuid: string, device: DeviceInfo): Promise<boolean>;
    setEnabled(platform: string, userId: string, ltuid: string, enabled: boolean): Promise<boolean>;
    setCommunityEnabled(platform: string, userId: string, ltuid: string, enabled: boolean): Promise<boolean>;
    setFollowMissions(platform: string, userId: string, ltuid: string, enabled: boolean): Promise<boolean>;
    markMissionDay(platform: string, userId: string, ltuid: string, day: string, mode: "follow" | "scheduled"): Promise<boolean>;
    choose(platform: string, userId: string, game: string, uid: string): Promise<boolean>;
    mark(role: GameRole, day: string): Promise<void>;
    remove(platform: string, userId: string, ltuid: string): Promise<boolean>;
};

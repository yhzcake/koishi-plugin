import { Context } from 'koishi';
import { DeviceInfo } from './vault';
import { DiscoveredRole, GameRole } from './accounts';
export declare const games: {
    readonly gs: {
        readonly name: "原神";
        readonly cn: readonly ["hk4e", "e202311201442471"];
        readonly os: readonly ["sol", "e202102251931481"];
    };
    readonly sr: {
        readonly name: "星穹铁道";
        readonly cn: readonly ["hkrpg", "e202304121516551"];
        readonly os: readonly ["luna/hkrpg/os", "e202303301540311"];
    };
    readonly zzz: {
        readonly name: "绝区零";
        readonly cn: readonly ["zzz", "e202406242138391"];
        readonly os: readonly ["luna/zzz/os", "e202406031448091"];
    };
    readonly bh3: {
        readonly name: "崩坏3";
        readonly cn: readonly ["bh3", "e202306201626331"];
        readonly os: readonly ["mani", "e202110291205111"];
    };
    readonly bh2: {
        readonly name: "崩坏学园2";
        readonly cn: readonly ["bh2", "e202203291431091"];
    };
    readonly wd: {
        readonly name: "未定事件簿";
        readonly cn: readonly ["nxx", "e202202251749321"];
        readonly os: readonly ["luna/nxx/os", "e202202281857121"];
    };
};
export declare const forums: {
    readonly bh3: 1;
    readonly gs: 2;
    readonly bh2: 3;
    readonly wd: 4;
    readonly dby: 5;
    readonly sr: 6;
    readonly zzz: 8;
    readonly hna: 9;
    readonly planet: 10;
};
export type Game = keyof typeof games;
export type Forum = keyof typeof forums;
export type SignResult = {
    text: string;
    done: boolean;
};
export type Result = {
    retcode: number;
    message?: string;
    data?: Record<string, unknown>;
};
export declare function createClient(ctx: Context, timeout: number, interval: number): {
    qrCreate(): Promise<{
        url: string;
        ticket: string;
    }>;
    qrStatus(ticket: string): Promise<Result>;
    qrExchange(stoken: string, mid: string | number): Promise<string>;
    exchangeCookie(secret: string, ltuid: string, gameBiz?: string): Promise<string>;
    fingerprint(deviceId: string, overseas: boolean, secret: string): Promise<string>;
    discover(secret: string): Promise<DiscoveredRole[]>;
    record(url: string, secret: string, body?: object, device?: DeviceInfo): Promise<Result>;
    game(account: GameRole, secret: string, game: Game, device?: DeviceInfo): Promise<{
        text: string;
        done: boolean;
    }>;
    forum(secret: string, forum: Forum, device?: DeviceInfo): Promise<{
        text: string;
        done: boolean;
    }>;
};

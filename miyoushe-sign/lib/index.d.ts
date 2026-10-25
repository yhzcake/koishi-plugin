import { Context, Schema } from 'koishi';
export declare const name = "miyoushe-sign";
export declare const inject: string[];
export interface Config {
    encryptionKey?: string;
    accounts: ConfigAccount[];
    timeout: number;
    interval: number;
    hour: number;
}
export interface ConfigAccount {
    platform: string;
    userId: string;
    ltuid: string;
    cookie?: string;
    stoken?: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;

import { Context, Schema } from 'koishi';
export declare const name = "query-balance";
export declare const inject: string[];
export interface AccountConfig {
    name: string;
    type: 'usage' | 'deepseek';
    baseUrl: string;
    apiKey?: string;
    proxy?: string;
    noProxy?: string[];
}
export interface Config {
    accounts: AccountConfig[];
    timeout: number;
    timezone: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;

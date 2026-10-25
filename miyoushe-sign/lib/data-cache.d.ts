import { Context } from 'koishi';
export interface StaticCacheEntry {
    id: string;
    source: string;
    version: string;
    fetchedAt: string;
    sha256: string;
    payload: string;
}
declare module 'koishi' {
    interface Tables {
        miyoushe_static_cache: StaticCacheEntry;
    }
}
export declare function createStaticCache(ctx: Context): {
    get: <T>(id: string) => Promise<T | undefined>;
    put: (id: string, source: string, version: string, value: unknown) => Promise<void>;
    getOrFetch: <T>(id: string, fetcher: () => Promise<{
        source: string;
        version: string;
        data: T;
    }>) => Promise<any>;
};
export type StaticCache = ReturnType<typeof createStaticCache>;

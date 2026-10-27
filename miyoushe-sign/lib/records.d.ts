import { createClient } from './client';
import { DeviceInfo } from './vault';
import { GameRole } from './accounts';
import { StaticCache } from './data-cache';
import { FribbelsIncompleteScore, FribbelsRelicScore, FribbelsSetScore, FribbelsUnsupportedScore } from './fribbels-score';
export declare const recordTypes: {
    readonly sr: {
        readonly panel: "avatar/info";
        readonly roles: "avatar/basic";
        readonly overview: "index";
        readonly forgotten: "challenge";
        readonly fiction: "challenge_story";
        readonly apocalypse: "challenge_boss";
        readonly anomaly: "challenge_peak";
    };
    readonly gs: {
        readonly panel: "character/detail";
        readonly roles: "character/list";
        readonly overview: "index";
        readonly abyss: "spiralAbyss";
        readonly theater: "role_combat";
        readonly peril: "hard_challenge";
    };
    readonly zzz: {
        readonly roles: "avatar/basic";
        readonly overview: "index";
    };
};
export type RecordGame = keyof typeof recordTypes;
export interface PanelAffix {
    name: string;
    value?: string;
    count?: string;
}
export type PanelRelicScore = FribbelsRelicScore | FribbelsUnsupportedScore | FribbelsIncompleteScore;
export type PanelRelicSetScore = FribbelsSetScore | FribbelsUnsupportedScore | FribbelsIncompleteScore;
export interface PanelRelic {
    id?: string;
    name: string;
    slot: string;
    level?: string;
    rarity?: string;
    icon?: string;
    rank?: string;
    setName?: string;
    setId?: string;
    setCount?: string;
    main?: PanelAffix;
    mainPropertyType?: string;
    mainFinalPropertyType?: string;
    mainPropertyId?: string;
    mainValue?: number;
    mainComplete?: boolean;
    subComplete?: boolean;
    subProperties?: {
        type: string;
        value?: number;
        exact: boolean;
        min?: number;
        max?: number;
    }[];
    subStats: PanelAffix[];
    mainIcon?: string;
    score?: PanelRelicScore;
}
export interface PanelItem {
    name: string;
    level?: string;
    rarity?: string;
    rank?: string;
    promotion?: string;
    icon?: string;
    path?: string;
    stats?: PanelAffix[];
    pathIcon?: string;
    pathId?: string;
    element?: string;
    elementIcon?: string;
    id?: string;
}
export interface PanelTrace {
    name: string;
    category?: 'main' | 'major' | 'minor';
    label?: string;
    level?: string;
    type?: string;
    icon?: string;
    id?: string;
    active?: boolean;
}
export interface PanelCharacter {
    id?: string;
    name: string;
    level?: string;
    rank?: string;
    rarity?: string;
    promotion?: string;
    icon?: string;
    image?: string;
    element?: string;
    path?: string;
    pathId?: string;
    pathIcon?: string;
    elementIcon?: string;
    statsIcon?: Record<string, string>;
    statDetails?: PanelStatDetail[];
    calculatedStats?: PanelAffix[];
    lightCone?: PanelItem;
    stats: PanelAffix[];
    traces: PanelTrace[];
    relics: PanelRelic[];
    relicScore?: PanelRelicSetScore;
}
export interface PanelStatDetail {
    field: string;
    base: string;
    added: string;
    total: string;
    display: string;
}
export interface PanelData {
    game: string;
    uid: string;
    server: string;
    characters: PanelCharacter[];
}
export interface AccountOverviewCharacter {
    id: string;
    name: string;
    avatar?: string;
}
export interface AccountOverview {
    game: 'gs' | 'sr';
    uid: string;
    nickname: string;
    avatar?: string;
    characters: AccountOverviewCharacter[];
    level?: string;
    server?: string;
    stamina?: Record<string, unknown>;
    challenges?: Record<string, Record<string, unknown>>;
}
export declare function formatRecord(label: string, data: unknown): string;
export declare function formatAccountOverview(data: AccountOverview): string;
export declare function createRecords(client: ReturnType<typeof createClient>, cache?: StaticCache): {
    query: (account: GameRole, secret: string, type: string, schedule?: 1 | 2 | 3, device?: DeviceInfo, character?: string) => Promise<string>;
    queryPanel: (account: GameRole, secret: string, device?: DeviceInfo, character?: string) => Promise<PanelData | string>;
    queryAccount: (account: GameRole, secret: string, device?: DeviceInfo, includeChallenges?: boolean) => Promise<AccountOverview | string>;
    queryStamina: (account: GameRole, secret: string, device?: DeviceInfo) => Promise<Record<string, unknown>>;
};

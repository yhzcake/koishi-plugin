import { StaticCache } from './data-cache';
export type RelicSlot = 'HEAD' | 'HAND' | 'BODY' | 'FOOT' | 'NECK' | 'OBJECT';
export type FribbelsGrade = '?' | 'F' | 'F+' | 'D' | 'D+' | 'C' | 'C+' | 'B' | 'B+' | 'A' | 'A+' | 'S' | 'S+' | 'SS' | 'SS+' | 'SSS' | 'SSS+' | 'WTF' | 'WTF+' | 'AEON';
export declare const fribbelsScoreMetadata: Readonly<{
    source: "https://github.com/fribbels/hsr-optimizer";
    commit: "a44c5d3ae2f1ed5907055a16c264bdc2392cf131";
    license: "MIT";
    date: "2026-10-24";
}>;
export interface FribbelsRelicScore {
    status: 'supported';
    characterId: string;
    effectiveRolls: number;
    score: number;
    grade: FribbelsGrade;
    mainOk: boolean;
}
export interface FribbelsUnsupportedScore {
    status: 'unsupported';
    characterId: string;
    reason: string;
    source: string;
    date: string;
}
export interface FribbelsIncompleteScore {
    status: 'incomplete';
    characterId?: string;
    reason: string;
    source: string;
    date: string;
}
export interface FribbelsSetScore {
    status: 'supported';
    characterId: string;
    relics: FribbelsRelicScore[];
    averageScore: number;
    averageGrade: FribbelsGrade;
    effectiveRolls: number;
    source: string;
    date: string;
}
export interface FribbelsRelicInput {
    slot: RelicSlot;
    rarity: number;
    main: string;
    subStats: readonly {
        type: string;
        value: number;
    }[];
}
export declare function scoreFribbelsRelic(characterId: string, relic: FribbelsRelicInput): FribbelsRelicScore | FribbelsUnsupportedScore | FribbelsIncompleteScore;
export declare function scoreFribbelsSet(characterId: string, relics: readonly FribbelsRelicInput[]): FribbelsSetScore | FribbelsUnsupportedScore | FribbelsIncompleteScore;
export declare function fribbelsSlotOf(slot: string): RelicSlot | undefined;
export declare function ensureFribbelsScoring(characterId: string, cache?: StaticCache): Promise<boolean>;

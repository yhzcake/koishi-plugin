export declare const fribbelsScoringSource: {
    readonly repository: "https://github.com/fribbels/hsr-optimizer";
    readonly commit: "a44c5d3ae2f1ed5907055a16c264bdc2392cf131";
    readonly license: "MIT";
    readonly extractedAt: "2026-10-24";
};
export type FribbelsScoring = {
    stats: Record<string, number>;
    parts: Record<string, string[]>;
};
export declare const fribbelsPartMainStats: Record<string, string[]>;
export declare const fribbelsScoring: Record<string, FribbelsScoring>;

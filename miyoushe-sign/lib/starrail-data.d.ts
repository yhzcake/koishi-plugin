interface StarRailStat {
    base: number;
    step: number;
}
interface StarRailPromotion {
    hp: StarRailStat;
    atk: StarRailStat;
    def: StarRailStat;
    spd?: StarRailStat;
}
interface StarRailProperty {
    type: string;
    value: number;
}
interface StarRailCharacter {
    id: string;
    name: string;
    rarity: number;
    path: string;
    element: string;
    icon: string;
    max_sp?: number;
    ranks: string[];
    skills: string[];
    skill_trees: string[];
}
interface StarRailLightCone {
    id: string;
    name: string;
    rarity: number;
    path: string;
    icon: string;
}
interface StarRailSkill {
    id: string;
    name: string;
    type: string;
    type_text: string;
    icon: string;
    levels?: {
        properties: StarRailProperty[];
    }[];
}
interface StarRailSkillTree {
    id: string;
    name: string;
    icon: string;
    anchor: string;
    level_up_skills: {
        id: string;
        num: number;
    }[];
    levels: {
        properties: StarRailProperty[];
    }[];
}
interface StarRailPromotionEntry {
    id: string;
    values: StarRailPromotion[];
}
interface StarRailLightConeRank {
    id: string;
    skill: string;
    properties: StarRailProperty[][];
}
export declare const starRailData: {
    readonly source: "https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_new/cn/";
    readonly characters: Record<string, StarRailCharacter>;
    readonly characterPromotions: Record<string, StarRailPromotionEntry>;
    readonly characterSkills: Record<string, StarRailSkill>;
    readonly characterSkillTrees: Record<string, StarRailSkillTree>;
    readonly lightCones: Record<string, StarRailLightCone>;
    readonly lightConePromotions: Record<string, StarRailPromotionEntry>;
    readonly lightConeRanks: Record<string, StarRailLightConeRank>;
    readonly relicMainAffixes: unknown;
    readonly relicSubAffixes: unknown;
    readonly relics: {
        source: string;
        set_id: string;
        entries: {
            id: string;
            set_id: string;
            name: string;
            rarity: number;
            type: string;
            max_level: number;
            main_affix_id: string;
            sub_affix_id: string;
            icon: string;
        }[];
    };
    readonly relicIcons: {
        readonly '101': readonly ["icon/relic/101_0.png", "icon/relic/101_1.png", "icon/relic/101_2.png", "icon/relic/101_3.png"];
    };
    readonly relicSets: unknown;
};
export declare function mergeStarRailData(resource: keyof typeof starRailData, value: unknown): boolean;
export {};

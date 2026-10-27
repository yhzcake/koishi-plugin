import { createClient, Result } from './client'
import { DeviceInfo } from './vault'
import { GameRole } from './accounts'
import { starRailData } from './starrail-data'
import { mergeStarRailData } from './starrail-data'
import { StaticCache } from './data-cache'
import { ensureFribbelsScoring, fribbelsScoreMetadata, fribbelsSlotOf, scoreFribbelsRelic, scoreFribbelsSet, FribbelsIncompleteScore, FribbelsRelicInput, FribbelsRelicScore, FribbelsSetScore, FribbelsUnsupportedScore } from './fribbels-score'

export const recordTypes = {
  sr: { panel: 'avatar/info', roles: 'avatar/basic', overview: 'index', forgotten: 'challenge', fiction: 'challenge_story', apocalypse: 'challenge_boss', anomaly: 'challenge_peak' },
  gs: { panel: 'character/detail', roles: 'character/list', overview: 'index', abyss: 'spiralAbyss', theater: 'role_combat', peril: 'hard_challenge' },
  zzz: { roles: 'avatar/basic', overview: 'index' },
} as const

export type RecordGame = keyof typeof recordTypes

export interface PanelAffix {
  name: string
  value?: string
  count?: string
}

export type PanelRelicScore = FribbelsRelicScore | FribbelsUnsupportedScore | FribbelsIncompleteScore
export type PanelRelicSetScore = FribbelsSetScore | FribbelsUnsupportedScore | FribbelsIncompleteScore

export interface PanelRelic {
  id?: string
  name: string
  slot: string
  level?: string
  rarity?: string
  icon?: string
  rank?: string
  setName?: string
  setId?: string
  setCount?: string
  main?: PanelAffix
  mainPropertyType?: string
  mainFinalPropertyType?: string
  mainPropertyId?: string
  mainValue?: number
  mainComplete?: boolean
  subComplete?: boolean
  subProperties?: { type: string; value?: number; exact: boolean; min?: number; max?: number }[]
  subStats: PanelAffix[]
  mainIcon?: string
  score?: PanelRelicScore
}

export interface PanelItem {
  name: string
  level?: string
  rarity?: string
  rank?: string
  promotion?: string
  icon?: string
  path?: string
  stats?: PanelAffix[]
  pathIcon?: string
  pathId?: string
  element?: string
  elementIcon?: string
  id?: string
}

export interface PanelTrace {
  name: string
  category?: 'main' | 'major' | 'minor'
  label?: string
  level?: string
  type?: string
  icon?: string
  id?: string
  active?: boolean
}

export interface PanelCharacter {
  id?: string
  name: string
  level?: string
  rank?: string
  rarity?: string
  promotion?: string
  icon?: string
  image?: string
  element?: string
  path?: string
  pathId?: string
  pathIcon?: string
  elementIcon?: string
  statsIcon?: Record<string, string>
  statDetails?: PanelStatDetail[]
  calculatedStats?: PanelAffix[]
  lightCone?: PanelItem
  stats: PanelAffix[]
  traces: PanelTrace[]
  relics: PanelRelic[]
  relicScore?: PanelRelicSetScore
}

export interface PanelStatDetail {
  field: string
  base: string
  added: string
  total: string
  display: string
}

export interface PanelData {
  game: string
  uid: string
  server: string
  characters: PanelCharacter[]
}

export interface AccountOverviewCharacter {
  id: string
  name: string
  avatar?: string
}

export interface AccountOverview {
  game: 'gs' | 'sr'
  uid: string
  nickname: string
  avatar?: string
  characters: AccountOverviewCharacter[]
  level?: string
  server?: string
  stamina?: Record<string, unknown>
  challenges?: Record<string, Record<string, unknown>>
}

interface MihomoPlayerData {
  player?: Record<string, unknown>
  characters?: Record<string, unknown>[]
}

const mihomoPropertyNames: Record<string, string> = {
  hp: '生命值', atk: '攻击力', def: '防御力', spd: '速度', crit_rate: '暴击率',
  crit_dmg: '暴击伤害', break_dmg: '击破特攻', effect_hit: '效果命中',
  effect_res: '效果抵抗', energy_regen_rate: '能量恢复效率', healing_boost: '治疗量加成',
  physical_dmg_boost: '物理属性伤害提高', fire_dmg_boost: '火属性伤害提高',
  ice_dmg_boost: '冰属性伤害提高', lightning_dmg_boost: '雷属性伤害提高',
  wind_dmg_boost: '风属性伤害提高', quantum_dmg_boost: '量子属性伤害提高',
  imaginary_dmg_boost: '虚数属性伤害提高',
}

const mihomoTraceIcons: Record<string, string> = {
  '150301': 'icon/skill/1503_basic_atk.png',
  '150302': 'icon/skill/1503_skill.png',
  '150303': 'icon/skill/1503_ultimate.png',
  '150304': 'icon/skill/1503_talent.png',
  '150307': 'icon/skill/1503_technique.png',
  '1503001': 'icon/skill/1503_basic_atk.png',
  '1503002': 'icon/skill/1503_skill.png',
  '1503003': 'icon/skill/1503_ultimate.png',
  '1503004': 'icon/skill/1503_talent.png',
  '1503007': 'icon/skill/1503_technique.png',
  '1503008': 'icon/skill/1503_elation.png',
  '1503101': 'icon/skill/1503_skilltree1.png',
  '1503102': 'icon/skill/1503_skilltree2.png',
  '1503103': 'icon/skill/1503_skilltree3.png',
  '1503201': 'icon/property/IconDefence.png',
  '1503202': 'icon/property/IconSpeed.png',
  '1503203': 'icon/property/IconStatusResistance.png',
  '1503204': 'icon/property/IconJoy.png',
  '1503205': 'icon/property/IconDefence.png',
  '1503206': 'icon/property/IconSpeed.png',
  '1503207': 'icon/property/IconStatusResistance.png',
  '1503208': 'icon/property/IconJoy.png',
  '1503209': 'icon/property/IconSpeed.png',
  '1503210': 'icon/property/IconDefence.png',
  '150308': 'icon/skill/1503_elation.png',
}

const propertyLabels: Record<string, string> = {
  HPDelta: '生命值', AttackDelta: '攻击力', DefenceDelta: '防御力', SpeedDelta: '速度',
  HPAddedRatio: '生命值百分比', AttackAddedRatio: '攻击力百分比', DefenceAddedRatio: '防御力百分比',
  CriticalChanceBase: '暴击率', CriticalDamageBase: '暴击伤害', StatusProbabilityBase: '效果命中',
  StatusResistanceBase: '效果抵抗', BreakDamageAddedRatioBase: '击破特攻', HealRatioBase: '治疗量加成',
  EnergyRecoveryRateBase: '能量恢复效率', SPRatioBase: '能量恢复效率',
  PhysicalAddedRatio: '物理属性伤害提高', FireAddedRatio: '火属性伤害提高', IceAddedRatio: '冰属性伤害提高',
  ThunderAddedRatio: '雷属性伤害提高', WindAddedRatio: '风属性伤害提高', QuantumAddedRatio: '量子属性伤害提高',
  ImaginaryAddedRatio: '虚数属性伤害提高', ElationDamageAddedRatioBase: '欢愉度',
}

const elementDamageTypes: Record<string, string> = {
  Physical: 'PhysicalAddedRatio', Fire: 'FireAddedRatio', Ice: 'IceAddedRatio',
  Lightning: 'ThunderAddedRatio', Thunder: 'ThunderAddedRatio', Wind: 'WindAddedRatio', Quantum: 'QuantumAddedRatio',
  Imaginary: 'ImaginaryAddedRatio',
}

type PromotionValue = { hp: { base: number; step: number }; atk: { base: number; step: number }; def: { base: number; step: number }; spd?: { base: number; step: number } }
type StarRailProperty = { type: string; value: number }
type StarRailTree = { levels?: { properties?: StarRailProperty[] }[] }
type StarRailAffix = { property: string; base: number; step: number }
type StarRailAffixGroup = { affixes: Record<string, StarRailAffix> }
type StarRailSubAffix = { property: string; base: number; step: number }
type StarRailSubAffixGroup = { affixes: Record<string, StarRailSubAffix> }
type StarRailSet = { id: string; properties: { type: string; value: number }[][] }

const characterProfiles = starRailData.characters as unknown as Record<string, { element?: string; path?: string }>
const characterPromotions = starRailData.characterPromotions as unknown as Record<string, { values: PromotionValue[] }>
const characterTrees = starRailData.characterSkillTrees as unknown as Record<string, StarRailTree>
const lightConePromotions = starRailData.lightConePromotions as unknown as Record<string, { values: PromotionValue[] }>
const lightConeRanks = starRailData.lightConeRanks as unknown as Record<string, { properties: StarRailProperty[][] }>
const relicMainAffixes = starRailData.relicMainAffixes as unknown as Record<string, StarRailAffixGroup>
const relicSubAffixes = starRailData.relicSubAffixes as unknown as Record<string, StarRailSubAffixGroup>
const relicSets = starRailData.relicSets as unknown as Record<string, StarRailSet>
const propertyAffixId: Record<string, number> = {
  HPDelta: 1, AttackDelta: 2, DefenceDelta: 3, HPAddedRatio: 4, AttackAddedRatio: 5, DefenceAddedRatio: 6,
  SpeedDelta: 7, CriticalChanceBase: 8, CriticalDamageBase: 9, StatusProbabilityBase: 10,
  StatusResistanceBase: 11, BreakDamageAddedRatioBase: 12, EnergyRecoveryRateBase: 13,
  HealRatioBase: 14, IceAddedRatio: 15,
}

function parseStatValue(type: string | undefined, value: string) {
  const normalized = value.replace(/,/g, '').replace(/％/g, '%').trim()
  if (!normalized) return undefined
  const amount = Number(normalized.replace(/%$/, ''))
  if (!Number.isFinite(amount)) return undefined
  return type && /Ratio|Base$/.test(type) && !/Delta$/.test(type) && normalized.endsWith('%') ? amount / 100 : amount
}

function formatStatValue(type: string, value: number) {
  const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type)
  return ratio ? `${(value * 100).toFixed(1)}%` : String(Number(value.toFixed(2)))
}

function promotionFor(level: number) {
  return Math.max(0, Math.min(6, Math.ceil(level / 10) - 2))
}

function promotionValue(values: PromotionValue[], level: number, promotion: number) {
  const value = values[Math.max(0, Math.min(values.length - 1, promotion))]
  const offset = Math.max(0, level - 1)
  return {
    hp: value.hp.base + value.hp.step * offset,
    atk: value.atk.base + value.atk.step * offset,
    def: value.def.base + value.def.step * offset,
    spd: (value.spd?.base || 0) + (value.spd?.step || 0) * offset,
  }
}

function calculateStats(character: PanelCharacter): PanelAffix[] {
  const id = character.id
  const lightCone = character.lightCone
  const lightConeId = lightCone?.id
  if (!id || !lightConeId) return []
  const promotions = characterPromotions[id]?.values
  const conePromotions = lightConePromotions[lightConeId]?.values
  const coneRanks = lightConeRanks[lightConeId]?.properties
  if (!promotions?.length || !conePromotions?.length || !coneRanks?.length) return []
  const level = Number(character.level)
  if (!Number.isInteger(level) || level < 1 || level > 80) return []
  if (character.relics.length !== 6 || new Set(character.relics.map(relic => relic.slot)).size !== 6 || character.relics.some(relic => !relic.mainComplete || !relic.subComplete)) return []
  const charPromotion = Math.max(0, Math.min(6, Number(character.promotion ?? promotionFor(level))))
  const coneLevel = Number(lightCone.level)
  if (!Number.isInteger(coneLevel) || coneLevel < 1 || coneLevel > 80) return []
  const conePromotion = Math.max(0, Math.min(6, Number(lightCone.promotion ?? promotionFor(coneLevel))))
  const superimposition = Number(lightCone.rank || 1)
  if (![charPromotion, conePromotion, superimposition].every(Number.isInteger) || superimposition < 1 || superimposition > 5) return []
  const charBase = promotionValue(promotions, level, charPromotion)
  const coneBase = promotionValue(conePromotions, coneLevel, conePromotion)
  const base = {
    HPDelta: charBase.hp + coneBase.hp,
    AttackDelta: charBase.atk + coneBase.atk,
    DefenceDelta: charBase.def + coneBase.def,
    SpeedDelta: charBase.spd,
    CriticalChanceBase: 0.05,
    CriticalDamageBase: 0.5,
  }
  const additions: Record<string, number> = {}
  const add = (type: string, value: number) => { additions[type] = (additions[type] || 0) + value }
  for (const trace of character.traces) {
    if (!trace.active || !trace.id) continue
    const tree = characterTrees[trace.id]
    for (const property of tree?.levels?.flatMap(node => node.properties || []) || []) {
      if (property.type && property.value !== undefined) add(property.type, property.value)
    }
  }
  for (const relic of character.relics) {
    if (relic.mainFinalPropertyType && relic.mainValue !== undefined) add(relic.mainFinalPropertyType, relic.mainValue)
    for (const property of relic.subProperties || []) if (property.exact && property.value !== undefined) add(property.type, property.value)
  }
  const setCounts = new Map<string, number>()
  for (const relic of character.relics) {
    if (relic.setId) setCounts.set(relic.setId, (setCounts.get(relic.setId) || 0) + 1)
  }
  for (const [setId, count] of setCounts) {
    const set = relicSets[setId]
    for (const [index, properties] of (set?.properties || []).entries()) {
      if (count < (index + 1) * 2) continue
      for (const property of properties || []) add(property.type, property.value)
    }
  }
  const hpBase = base.HPDelta
  const attackBase = base.AttackDelta
  const defenceBase = base.DefenceDelta
  for (const property of coneRanks[superimposition - 1] || []) add(property.type, property.value)
  const totals: Record<string, number> = {}
  for (const type of Object.keys(propertyLabels)) totals[type] = additions[type] || 0
  totals.EnergyRecoveryRateBase = 1 + (additions.SPRatioBase || 0) + (additions.EnergyRecoveryRateBase || 0)
  for (const key of ['HPDelta', 'AttackDelta', 'DefenceDelta']) {
    const prefix = key === 'HPDelta' ? 'HP' : key === 'AttackDelta' ? 'Attack' : 'Defence'
    const white = key === 'HPDelta' ? hpBase : key === 'AttackDelta' ? attackBase : defenceBase
    totals[key] = white * (1 + (additions[`${prefix}AddedRatio`] || 0)) + (additions[key] || 0)
  }
  totals.SpeedDelta = (base.SpeedDelta + (additions.SpeedDelta || 0)) * (1 + (additions.SpeedAddedRatio || 0))
  totals.CriticalChanceBase = base.CriticalChanceBase + (additions.CriticalChanceBase || 0)
  totals.CriticalDamageBase = base.CriticalDamageBase + (additions.CriticalDamageBase || 0)
  const profile = characterProfiles[id]
  const elementType = elementDamageTypes[profile?.element || '']
  const shown = [
    'HPDelta', 'AttackDelta', 'DefenceDelta', 'SpeedDelta', 'CriticalChanceBase', 'CriticalDamageBase',
    'StatusProbabilityBase', 'StatusResistanceBase', 'BreakDamageAddedRatioBase', 'EnergyRecoveryRateBase',
    elementType, 'HealRatioBase',
  ].filter((type): type is string => !!type)
  if (profile?.path === 'Elation' || totals.ElationDamageAddedRatioBase) shown.push('ElationDamageAddedRatioBase')
  return shown.map(type => {
    const value = totals[type] || 0
    const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type)
    const display = ratio
      ? `${(Math.floor(value * 1000 + 1e-9) / 10).toFixed(1)}%`
      : type === 'SpeedDelta' ? String(Math.round(value)) : String(Math.floor(value + 1e-9))
    return { name: propertyLabels[type] || type, value: display }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function roleList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  for (const key of ['list', 'avatar_list', 'avatars', 'characters']) {
    if (Array.isArray(data[key])) return (data[key] as unknown[]).filter(isRecord)
  }
  return []
}

function findRole(data: unknown, name: string) {
  const target = name.trim().toLowerCase()
  return roleList(data).find(role => [role.name, role.avatar_name, role.id].some(value => String(value ?? '').toLowerCase() === target))
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length <= 80) return value.replace(/[\r\n\x00-\x1f]/g, ' ').trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
}

function valueOf(value: unknown, keys: string[]) {
  if (isRecord(value)) {
    for (const key of keys) {
      const result = text(value[key])
      if (result) return result
    }
  }
  return text(value)
}

function imageOf(value: unknown) {
  if (!isRecord(value)) return undefined
  for (const key of ['icon', 'icon_url', 'preview', 'portrait', 'image', 'url']) {
    const result = assetUrl(value[key])
    if (result) return result
  }
}

function accountAvatar(value: unknown) {
  if (typeof value === 'string') return assetUrl(value)
  if (!isRecord(value)) return undefined
  for (const key of ['avatar', 'avatar_url', 'avatar_icon', 'avatar_icon_url', 'avatar_side_icon', 'game_head_icon', 'head_icon', 'icon', 'icon_url', 'portrait', 'image', 'url']) {
    const candidate = value[key]
    const result = assetUrl(candidate) || (isRecord(candidate) ? accountAvatar(candidate) : undefined)
    if (result) return result
  }
}

function accountCharacterAvatar(game: AccountOverview['game'], character: Record<string, unknown>, id: string) {
  for (const source of [character, character.avatar, character.icon]) {
    if (!isRecord(source)) continue
    for (const key of ['portrait', 'preview', 'image', 'avatar_url', 'icon_url', 'icon', 'url']) {
      const candidate = isRecord(source[key]) ? imageOf(source[key]) : assetUrl(source[key])
      if (candidate) return candidate
    }
  }
  if (!/^\d+$/.test(id)) return undefined
  return game === 'sr'
    ? assetUrl(`image/character/${id}_Splash.png`) || starRailIcon('character', id)
    : `https://enka.network/ui/UI_Gacha_AvatarImg_${encodeURIComponent(id)}.png`
}

const starRailAssetBase = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/'

function assetUrl(value: unknown) {
  const path = typeof value === 'string' ? value.trim() : undefined
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:\/\//i, 'https://')
  if (/^(icon|image)\//.test(path)) return `${starRailAssetBase}${path.split('/').map(encodeURIComponent).join('/')}`
}

function staticIcon(path: string) {
  return assetUrl(path)
}

function starRailIcon(kind: 'character' | 'light_cone' | 'skill' | 'relic', id: string | undefined, relicPosition?: number, relicSetId?: string) {
  if (kind === 'character' && id) return staticIcon(`icon/character/${id}.png`)
  if (kind === 'light_cone' && id) return staticIcon(`icon/light_cone/${id}.png`)
  if (kind === 'skill' && id) {
    const skill = (starRailData.characterSkills as Record<string, { icon?: string }>)[id]
    return staticIcon(skill?.icon || mihomoTraceIcons[id] || '')
  }
  if (kind === 'relic' && relicSetId && relicPosition) return staticIcon(`icon/relic/${relicSetId}_${relicPosition > 4 ? relicPosition - 5 : relicPosition - 1}.png`)
}

function mihomoImage(value: unknown) {
  return imageOf(value) || (isRecord(value) ? assetUrl(value.icon) : undefined)
}

function affix(value: unknown): PanelAffix | undefined {
  if (!isRecord(value)) return undefined
  const name = valueOf(value, ['name', 'type', 'property', 'property_name', 'key'])
  const result = valueOf(value, ['display_value', 'display', 'value', 'val', 'content'])
  if (!name && !result) return undefined
  return {
    name: name || '未知属性',
    value: result,
    count: valueOf(value, ['count', 'times', 'add_count']),
  }
}

function affixList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(affix).filter((item): item is PanelAffix => !!item)
}

function propertyName(value: unknown, propertyInfo: unknown) {
  const type = valueOf(value, ['property_type', 'type', 'key'])
  if (!type || !isRecord(propertyInfo)) return type
  const info = propertyInfo[type]
  if (isRecord(info)) return valueOf(info, ['property_name', 'name', 'property_name_filter', 'filter_name']) || type
  return text(info) || type
}

function relicAffix(value: unknown, propertyInfo: unknown): PanelAffix | undefined {
  if (!isRecord(value)) return undefined
  const name = valueOf(value, ['name']) || propertyName(value, propertyInfo)
  const result = valueOf(value, ['display_value', 'display', 'value', 'val', 'content'])
  if (!name && !result) return undefined
  return {
    name: name || '未知属性',
    value: result,
    count: valueOf(value, ['count', 'times', 'add_count']),
  }
}

function relicAffixList(value: unknown, propertyInfo: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(item => relicAffix(item, propertyInfo)).filter((item): item is PanelAffix => !!item)
}

function normalizeItem(value: unknown): PanelItem | undefined {
  if (!isRecord(value)) return undefined
  const name = valueOf(value, ['name', 'equip_name', 'light_cone_name', 'weapon_name'])
  if (!name) return undefined
  const pathData = isRecord(value.path) ? value.path : undefined
  const path = valueOf(value, ['path_name', 'career']) || valueOf(pathData, ['name', 'path_name'])
  const elementData = isRecord(value.element) ? value.element : undefined
  return {
    name,
    id: valueOf(value, ['id', 'item_id', 'tid']),
    level: valueOf(value, ['level', 'lv']),
    rarity: valueOf(value, ['rarity', 'star']),
    rank: valueOf(value, ['rank', 'refinement', 'superimposition']),
    promotion: valueOf(value, ['promotion', 'promote_level']),
    icon: mihomoImage(value) || starRailIcon('light_cone', valueOf(value, ['id', 'item_id', 'tid'])),
    path,
    pathIcon: mihomoImage(pathData),
    pathId: valueOf(pathData, ['id']),
    element: valueOf(elementData, ['name', 'id']),
    elementIcon: mihomoImage(elementData),
    stats: [...normalizeMihomoStats(value.attributes), ...normalizeMihomoStats(value.properties)],
  }
}

function relicSlot(value: unknown) {
  const raw = valueOf(value, ['slot_name', 'position_name', 'type_name', 'pos_name', 'slot', 'position', 'type'])
  if (raw) {
    const numeric = Number(raw)
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 6) return ['头部', '手部', '躯干', '脚部', '位面球', '连结绳'][numeric - 1]
    const names: Record<string, string> = {
      head: '头部', hands: '手部', body: '躯干', feet: '脚部', sphere: '位面球', rope: '连结绳',
      head_piece: '头部', hand_piece: '手部', body_piece: '躯干', foot_piece: '脚部', planar_sphere: '位面球', link_rope: '连结绳',
    }
    return names[raw.toLowerCase()] || raw
  }
  const number = Number(valueOf(value, ['pos', 'type', 'position', 'slot']))
  return ['头部', '手部', '躯干', '脚部', '位面球', '连结绳'][number - 1] || '遗器'
}

function displayedStat(type: string, value: number) {
  const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type)
  return ratio ? Math.floor(value * 1000 + 1e-9) / 10 : Math.floor(value + 1e-9)
}

function exactSubAffix(affix: { base: number; step: number; step_num?: number }, rolls: number, type: string, target: number) {
  const expected = displayedStat(type, target)
  const stepNum = Math.max(0, Math.floor(Number(affix.step_num ?? 2)))
  const candidates: number[] = []
  for (let index = 0; index <= stepNum * rolls; index++) {
    const value = affix.base * rolls + affix.step * index
    const floatValue = Math.fround(affix.base) * rolls + Math.fround(affix.step) * index
    const matches = displayedStat(type, value) === expected || displayedStat(type, floatValue) === expected
    if (matches && (Number.isInteger(target) || Math.abs(value - target) < 1e-9 || type !== 'SpeedDelta')) candidates.push(value)
  }
  if (!candidates.length) return undefined
  const min = Math.min(...candidates)
  const max = Math.max(...candidates)
  return { value: min, min, max }
}

function normalizeRelic(value: unknown, propertyInfo?: unknown): PanelRelic | undefined {
  if (!isRecord(value)) return undefined
  const set = isRecord(value.set) ? value.set : undefined
  const name = valueOf(value, ['name', 'relic_name']) || valueOf(set, ['name']) || '遗器'
  const mainSource = value.main_affix || value.mainAffix || value.main_stat || value.main_property
  const relicId = valueOf(value, ['id', 'relic_id'])
  const standardId = relicId && /^[2-6]\d{4}$/.test(relicId) ? relicId : undefined
  const setId = valueOf(value, ['set_id']) || valueOf(set, ['id']) || standardId?.slice(1, 4)
  const rarity = Number(valueOf(value, ['rarity', 'star']) || (standardId ? Number(standardId[0]) - 1 : 0))
  const position = Number(value.pos ?? value.type ?? value.position ?? value.slot ?? standardId?.slice(-1))
  const icon = mihomoImage(value) || starRailIcon('relic', undefined, position, setId)
  const mainIcon = isRecord(mainSource) ? mihomoImage(mainSource) : undefined
  const subSource = value.properties ?? value.sub_affix_list ?? value.sub_affix ?? value.sub_affixes ?? value.sub_stats ?? value.subStats
  const rawSubProperties = Array.isArray(subSource) ? subSource.filter(item => !isRecord(item) || !item.is_preview) : []
  const subAffixes = rarity >= 2 && rarity <= 5 ? Object.values(relicSubAffixes[String(rarity)]?.affixes || {}) : []
  const properties = rawSubProperties.flatMap(item => {
    if (!isRecord(item)) return []
    const type = propertyType(item, propertyInfo)
    if (!type) return []
    let rawAmount = valueOf(item, ['value', 'display_value', 'display'])
    if (type === 'SpeedDelta' && rawAmount !== undefined) {
      const amount = parseStatValue(type, rawAmount)
      const display = valueOf(item, ['display_value', 'display'])
      const displayedAmount = display === undefined ? undefined : parseStatValue(type, display)
      if (amount !== undefined && Number.isInteger(amount) && displayedAmount !== undefined
        && !Number.isInteger(displayedAmount) && Math.floor(displayedAmount) === amount) {
        rawAmount = display
      }
    }
    const normalizedAmount = String(rawAmount || '').replace(/,/g, '').replace(/％/g, '%').trim()
    const amount = Number(normalizedAmount.replace(/%$/, ''))
    const rolls = Number(valueOf(item, ['times', 'count', 'add_count']))
    const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type)
    const affix = subAffixes.find(entry => entry.property === type)
    if (affix && Number.isInteger(rolls) && rolls > 0 && rawAmount && Number.isFinite(amount)) {
      const target = ratio && normalizedAmount.endsWith('%') ? amount / 100 : amount
      const exact = exactSubAffix(affix, rolls, type, target)
      if (exact !== undefined) return [{ type, ...exact, exact: true }]
    }
    if (rawAmount && Number.isFinite(amount)) {
      return [{ type, value: ratio && normalizedAmount.endsWith('%') ? amount / 100 : amount, exact: true }]
    }
    if (Number.isFinite(rolls) && rolls > 0) return [{ type, exact: false }]
    return []
  })
  const rawMainType = mainSource ? propertyType(mainSource, propertyInfo) : undefined
  const mainType = rawMainType === 'EnergyRecoveryRateBase' ? 'SPRatioBase' : rawMainType
  const slotAffixOrder: Record<string, Record<string, string>> = {
    '3': { HPAddedRatio: '1', AttackAddedRatio: '2', DefenceAddedRatio: '3', CriticalChanceBase: '4', CriticalDamageBase: '5', HealRatioBase: '6', StatusProbabilityBase: '7' },
    '4': { HPAddedRatio: '1', AttackAddedRatio: '2', DefenceAddedRatio: '3', SpeedDelta: '4' },
    '5': { HPAddedRatio: '1', AttackAddedRatio: '2', DefenceAddedRatio: '3', IceAddedRatio: '6' },
    '6': { HPAddedRatio: '3', AttackAddedRatio: '4', DefenceAddedRatio: '5', BreakDamageAddedRatioBase: '1', SPRatioBase: '2' },
  }
  const mainAffixId = mainSource ? valueOf(mainSource, ['affix_id', 'main_affix_id', 'id']) : undefined
  const slotGroup = `${rarity}${position}`
  const mainTableId = mainAffixId || (mainType ? slotAffixOrder[String(position)]?.[mainType] : position === 1 ? '1' : position === 2 ? '1' : undefined)
  const mainAffixes = relicMainAffixes[slotGroup]?.affixes
  const mainTable = mainType
    ? Object.values(mainAffixes || {}).find(affix => affix.property === mainType)
    : mainSource && valueOf(mainSource, ['property_type', 'type', 'property_name', 'name']) ? undefined : mainAffixes?.[mainTableId || '']
  const mappedMainType = mainTable?.property || mainType
  const displayMainType = mappedMainType || (position === 1 ? 'HPDelta' : position === 2 ? 'AttackDelta' : undefined)
  const mainLevelSource = valueOf(value, ['level', 'lv'])
  const mainLevel = Number(mainLevelSource)
  const mainCalculated = mainTable && mainLevelSource !== undefined && Number.isInteger(mainLevel) && mainLevel >= 0 ? mainTable.base + mainTable.step * mainLevel : undefined
  const mainValue = mainSource ? valueOf(mainSource, ['value', 'display_value']) : undefined
  const parsedMainValue = mainValue ? parseStatValue(displayMainType, mainValue) : undefined
  const mainComplete = !!mappedMainType && (parsedMainValue !== undefined || (!!mainSource && mainCalculated !== undefined))
  return {
    id: relicId,
    name,
    slot: ['头部', '手部', '躯干', '脚部', '位面球', '连结绳'][position - 1] || relicSlot(value),
    level: valueOf(value, ['level', 'lv']),
    rarity: valueOf(value, ['rarity', 'star']) || String(rarity || ''),
    icon,
    setName: valueOf(value, ['set_name', 'relic_set_name']) || valueOf(set, ['name']) || (setId ? (relicSets[setId] as StarRailSet & { name?: string })?.name : undefined),
    setId,
    setCount: valueOf(value, ['set_count']),
    main: displayMainType && (parsedMainValue ?? mainCalculated) !== undefined ? { name: propertyLabels[displayMainType] || displayMainType, value: mainValue || formatStatValue(displayMainType, mainCalculated!) } : relicAffix(mainSource, propertyInfo) || affix(mainSource),
    mainIcon,
    mainPropertyType: mappedMainType,
    mainFinalPropertyType: displayMainType,
    mainPropertyId: mainAffixId,
    mainValue: mainCalculated ?? parsedMainValue,
    mainComplete,
    subProperties: properties,
    subComplete: Array.isArray(subSource) && properties.length === rawSubProperties.length && properties.every(property => property.exact),
    subStats: normalizeMihomoStats(value.sub_affix || value.sub_affixes, 'affix').length
      ? normalizeMihomoStats(value.sub_affix || value.sub_affixes, 'affix')
      : relicAffixList(value.sub_affix_list || value.sub_affixes || value.sub_stats || value.subStats || value.properties, propertyInfo),
  }
}

function propertyType(value: unknown, propertyInfo: unknown) {
  const raw = valueOf(value, ['property_type', 'type', 'property_name', 'name'])
  if (!raw) return undefined
  const knownTypes = new Set([
    ...Object.keys(propertyLabels),
    ...Object.values(relicMainAffixes).flatMap(group => Object.values(group.affixes).map(affix => affix.property)),
    ...Object.values(relicSubAffixes).flatMap(group => Object.values(group.affixes).map(affix => affix.property)),
  ])
  if (knownTypes.has(raw)) return raw
  if (!isRecord(propertyInfo)) return undefined
  const entry = isRecord(propertyInfo[raw])
    ? [raw, propertyInfo[raw]] as const
    : Object.entries(propertyInfo).find(([, info]) => isRecord(info) && ['property_name_filter', 'property_name', 'name'].some(key => text(info[key]) === raw))
  if (!entry || !isRecord(entry[1])) return undefined
  const [key, info] = entry
  if (knownTypes.has(key)) return key
  for (const field of ['property_type', 'type', 'key', 'property_name_filter', 'property_name', 'name']) {
    const label = text(info[field])
    if (!label) continue
    if (knownTypes.has(label)) return label
    const prefix = { '生命值': 'HP', '攻击力': 'Attack', '防御力': 'Defence' }[label]
    if (prefix && typeof info.is_percent === 'boolean') return `${prefix}${info.is_percent ? 'AddedRatio' : 'Delta'}`
    const type = Object.keys(propertyLabels).find(type => propertyLabels[type] === label)
    if (type) return type
  }
}

function normalizeTraces(value: unknown): PanelTrace[] {
  const source = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.values(value)
      : []
  const defaults = ['普攻', '战技', '终结技', '天赋', '秘技']
  const skillTypes: Record<string, string> = {
    Normal: '普攻', BPSkill: '战技', Ultra: '终结技', Talent: '天赋', Maze: '秘技', ElationDamage: '欢愉技',
  }
  const mainLabels = [...defaults, '欢愉技']
  return source.filter(isRecord).flatMap((item, index) => {
    const nested = Array.isArray(item.skills) ? item.skills : Array.isArray(item.skill_list) ? item.skill_list : []
    const values = nested.length ? nested : [item]
    return values.filter(isRecord).map(skill => {
      const id = valueOf(skill, ['id', 'point_id'])
      const tree = starRailData.characterSkillTrees[id || '']
      const linkedSkills = Array.isArray(tree?.level_up_skills) ? tree.level_up_skills : []
      const metadata = starRailData.characterSkills[id || ''] || linkedSkills.map(link => starRailData.characterSkills[link.id]).find(Boolean)
      const rawType = valueOf(skill, ['type_text', 'type', 'skill_type', 'point_type'])
      const type = skillTypes[rawType || ''] || rawType || valueOf(metadata, ['type_text', 'type'])
      const mainLabel = [type, valueOf(metadata, ['type_text']), skillTypes[valueOf(metadata, ['type']) || '']].find(label => label && mainLabels.includes(label))
      const category: PanelTrace['category'] = mainLabel || linkedSkills.length ? 'main'
        : /^Point0[678]$/.test(tree?.anchor || '') || /额外能力|额外行迹/.test(type || '') ? 'major' : 'minor'
      const label = mainLabel || (category === 'main' ? defaults[index] || '技能' : category === 'major' ? '额外能力' : '属性加成')
      return {
        name: valueOf(skill, ['name', 'skill_name', 'title']) || valueOf(metadata, ['name']) || valueOf(tree, ['name']) || '行迹',
        category,
        label,
        level: valueOf(skill, ['level', 'cur_level', 'lv']),
        type,
        id,
        icon: assetUrl(tree?.icon) || starRailIcon('skill', id) || mihomoImage(skill) || assetUrl(mihomoTraceIcons[id || '']),
        active: skill.is_activated === true,
      }
    })
  })
}

function normalizeStats(value: unknown, propertyInfo?: unknown) {
  const sources = [value, isRecord(value) ? value.stats : undefined, isRecord(value) ? value.attributes : undefined]
  const output: PanelAffix[] = []
  for (const source of sources) {
    if (Array.isArray(source)) {
      output.push(...source.map(item => relicAffix(item, propertyInfo) || affix(item)).filter((item): item is PanelAffix => !!item))
    }
    else if (isRecord(source)) {
      for (const [name, item] of Object.entries(source)) {
        const parsed = relicAffix(isRecord(item) ? { ...item, name: item.name || name } : { name, value: item }, propertyInfo) || affix(isRecord(item) ? { ...item, name: item.name || name } : { name, value: item })
        if (parsed) output.push(parsed)
      }
    }
  }
  return output.filter((item, index, list) => list.findIndex(other => other.name === item.name && other.value === item.value) === index)
}

function normalizeProperties(value: unknown, propertyInfo: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item): PanelAffix | undefined => {
    if (!isRecord(item)) return undefined
    const name = propertyName(item, propertyInfo) || valueOf(item, ['name', 'property_name'])
    const result = valueOf(item, ['display_value', 'value', 'val', 'content'])
    return name && result ? { name, value: result } : undefined
  }).filter((item): item is PanelAffix => !!item)
}

function normalizeMihomoStats(value: unknown, mode: 'stat' | 'affix' = 'stat') {
  if (!Array.isArray(value)) return []
  return value.map((item): PanelAffix | undefined => {
    if (!isRecord(item)) return undefined
    const field = valueOf(item, ['field'])
    const name = valueOf(item, ['name']) || mihomoPropertyNames[field?.toLowerCase() || ''] || field
    const result = valueOf(item, ['display_value', 'display', 'value'])
    return name && result ? { name, value: result, count: mode === 'affix' ? valueOf(item, ['count']) : undefined } : undefined
  }).filter((item): item is PanelAffix => !!item)
}

function mihomoStatDetails(statistics: unknown, attributes: unknown, additions: unknown): PanelStatDetail[] {
  if (!Array.isArray(statistics)) return []
  const values = (source: unknown) => new Map(Array.isArray(source)
    ? source.filter(isRecord).flatMap(item => {
      const field = valueOf(item, ['field'])
      return field ? [[field, item] as const] : []
    })
    : [])
  const baseValues = values(attributes)
  const addedValues = values(additions)
  return statistics.flatMap(item => {
    if (!isRecord(item)) return []
    const field = valueOf(item, ['field'])
    if (!field) return []
    const base = Number(baseValues.get(field)?.value)
    const added = Number(addedValues.get(field)?.value)
    const total = Number(item.value)
    const display = valueOf(item, ['display']) || (Number.isFinite(total) ? String(total) : '')
    return [{
      field: mihomoPropertyNames[field.toLowerCase()] || field,
      base: Number.isFinite(base) ? String(base) : '-',
      added: Number.isFinite(added) ? String(added) : '-',
      total: Number.isFinite(total) ? String(total) : display,
      display,
    }]
  })
}

function mihomoStatIcons(value: unknown) {
  if (!Array.isArray(value)) return {}
  const output: Record<string, string> = {}
  for (const item of value) {
    if (!isRecord(item)) continue
    const name = valueOf(item, ['name', 'field'])
    const icon = mihomoImage(item)
    if (name && icon) output[name] = icon
  }
  return output
}

function calculateRelicScores(character: PanelCharacter) {
  const incomplete = (reason: string): FribbelsIncompleteScore => ({ status: 'incomplete', characterId: character.id, reason, ...fribbelsScoreMetadata })
  if (!character.id) {
    character.relicScore = incomplete('缺少角色 ID，无法评分')
    for (const relic of character.relics) relic.score = incomplete('缺少角色 ID，无法评分')
    return
  }
  const support = scoreFribbelsSet(character.id, [])
  if (support.status === 'unsupported') {
    character.relicScore = support
    for (const relic of character.relics) relic.score = { ...support }
    return
  }
  const inputs: FribbelsRelicInput[] = []
  for (const relic of character.relics) {
    const slot = fribbelsSlotOf(relic.slot)
    if (!slot || !relic.mainComplete || !relic.subComplete || !relic.mainFinalPropertyType || !relic.subProperties || relic.subProperties.some(property => !property.exact || property.value === undefined)) {
      relic.score = incomplete(`${relic.slot}：部位或主副词条数据不完整，无法评分`)
      continue
    }
    const input: FribbelsRelicInput = {
      slot,
      rarity: Number(relic.rarity),
      main: relic.mainFinalPropertyType,
      subStats: relic.subProperties.map(property => ({ type: property.type, value: property.value! })),
    }
    try {
      const score = scoreFribbelsRelic(character.id, input)
      relic.score = score
      if (score.status === 'supported') inputs.push(input)
    } catch (error) {
      relic.score = incomplete(`${relic.slot}：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const failed = character.relics.find(relic => relic.score?.status === 'incomplete' || relic.score?.status === 'unsupported')
  if (failed?.score && failed.score.status !== 'supported') {
    character.relicScore = failed.score.status === 'unsupported' ? failed.score : incomplete(failed.score.reason)
  } else if (inputs.length !== 6) {
    character.relicScore = incomplete(`整套评分需要六个不同部位的完整遗器，当前 ${inputs.length} 件`)
  } else {
    character.relicScore = scoreFribbelsSet(character.id, inputs)
  }
}

function normalizeCharacter(value: Record<string, unknown>, propertyInfo?: unknown): PanelCharacter {
  const base = isRecord(value.base) ? value.base : {}
  const character = { ...value, ...base }
  const lightConeSource = value.equip || value.light_cone || value.weapon || value.equipment
  const lightCone = normalizeItem(lightConeSource)
  const relicSource = [
    ...(Array.isArray(value.relic_list) ? value.relic_list : []),
    ...(Array.isArray(value.relics) ? value.relics : []),
    ...(Array.isArray(value.ornaments) ? value.ornaments : []),
    ...(Array.isArray(value.artifacts) ? value.artifacts : []),
  ]
  const statsSource = value.statistics || value.stats || value.attributes || value.attribute_list || value.attributeList || value.property_list || value.propertyList || value.extra
  const normalizedProperties = normalizeProperties(statsSource, propertyInfo)
  const attributes = normalizedProperties.length
    ? normalizedProperties
    : normalizeStats(statsSource, propertyInfo)
  const mihomoStats = normalizeMihomoStats(value.statistics).length
    ? normalizeMihomoStats(value.statistics)
    : normalizeMihomoStats(value.attributes)
  const stats = mihomoStats.length ? mihomoStats : attributes
  const relics = relicSource.map(item => normalizeRelic(item, propertyInfo)).filter((item): item is PanelRelic => !!item)
  const normalized: PanelCharacter = {
    id: valueOf(character, ['id', 'avatar_id', 'character_id']),
    name: valueOf(character, ['name', 'avatar_name', 'character_name']) || '未知角色',
    level: valueOf(character, ['level', 'lv']),
    rank: valueOf(character, ['rank', 'constellation', 'eidolon']),
    rarity: valueOf(character, ['rarity', 'star']),
    promotion: valueOf(character, ['promotion', 'promote_level']),
    icon: starRailIcon('character', valueOf(character, ['id', 'avatar_id', 'character_id'])) || mihomoImage(value) || mihomoImage(base),
    image: assetUrl(value.portrait) || assetUrl(value.preview) || assetUrl(base.portrait) || assetUrl(base.preview) || mihomoImage(value) || mihomoImage(base),
    element: valueOf(character, ['element_name', 'attribute_name']) || (isRecord(value.element) ? valueOf(value.element, ['name', 'id']) : valueOf(character, ['element', 'attribute'])),
    elementIcon: isRecord(value.element) ? mihomoImage(value.element) : undefined,
    path: valueOf(character, ['path_name', 'career']) || (isRecord(value.path) ? valueOf(value.path, ['name', 'id']) : valueOf(character, ['path'])),
    pathId: isRecord(value.path) ? valueOf(value.path, ['id']) : undefined,
    pathIcon: isRecord(value.path) ? mihomoImage(value.path) : undefined,
    statsIcon: Object.assign({}, mihomoStatIcons(value.attributes), mihomoStatIcons(value.additions), mihomoStatIcons(value.properties)),
    statDetails: mihomoStatDetails(value.statistics, value.attributes, value.additions),
    lightCone,
    stats,
    traces: normalizeTraces(value.skill_tree || value.skill_tree_list || value.skills || value.traces),
    relics,
  }
  normalized.calculatedStats = calculateStats(normalized)
  if (!normalized.stats.length && normalized.calculatedStats.length) normalized.stats = normalized.calculatedStats
  calculateRelicScores(normalized)
  return normalized
}

function normalizePanel(game: string, account: GameRole, data: unknown): PanelData {
  const propertyInfo = isRecord(data) ? data.property_info : undefined
  const avatars = roleList(data)
  return {
    game,
    uid: account.uid,
    server: account.region,
    characters: avatars.map(character => normalizeCharacter(character, propertyInfo)),
  }
}

async function queryMihomoPanel(account: GameRole, character?: string): Promise<PanelData | string> {
  const response = await fetch(`https://api.mihomo.me/sr_info_parsed/${encodeURIComponent(account.uid)}?lang=chs`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) return `Mihomo 面板接口请求失败（HTTP ${response.status}）。`
  const data = await response.json() as MihomoPlayerData
  const candidates = Array.isArray(data.characters) ? data.characters.filter(isRecord) : []
  if (!candidates.length) return 'Mihomo 未返回公开展示角色，请检查游戏内角色展示设置。'
  const normalized = candidates.map(normalizeCharacter)
  const requested = character?.trim().toLowerCase()
  const selected = character
    ? normalized.find(item => [item.name.toLowerCase(), item.id?.toLowerCase()].includes(requested))
    : normalized[0]
  if (character && !selected) return `Mihomo 展示列表中未找到角色“${character}”。`
  return {
    game: 'sr',
    uid: account.uid,
    server: account.region,
    characters: selected ? [selected] : normalized,
  }
}

function panelRecord(role: Record<string, unknown>, label: string) {
  const lines: string[] = []
  const fields: [string, string[]][] = [
    ['角色', ['name', 'avatar_name']],
    ['等级', ['level']],
    ['稀有度', ['rarity']],
    ['命座', ['rank', 'constellation']],
    ['经验', ['exp']],
    ['突破', ['promote_level', 'promotion']],
  ]
  for (const [label, keys] of fields) {
    const value = keys.map(key => text(role[key])).find(Boolean)
    if (value) lines.push(`${label}：${value}`)
  }
  for (const key of ['weapon', 'equipment', 'light_cone']) {
    if (!isRecord(role[key])) continue
    const item = role[key]
    const name = text(item.name) || text(item.weapon_name) || text(item.light_cone_name)
    const level = text(item.level)
    const rank = text(item.rank) || text(item.refinement)
    if (name) lines.push(`${key === 'light_cone' ? '光锥' : '武器'}：${name}${level ? ` Lv.${level}` : ''}${rank ? ` 精炼${rank}` : ''}`)
  }
  for (const key of ['stats', 'base', 'extra']) {
    if (!isRecord(role[key])) continue
    const stats = role[key]
    for (const [stat, value] of Object.entries(stats)) {
      const parsed = text(value)
      if (parsed && lines.length < 30) lines.push(`${stat}：${parsed}`)
    }
  }
  const relics = role.relic_list || role.relics || role.artifacts
  if (Array.isArray(relics)) {
    lines.push(`遗器数量：${relics.length}`)
    for (const item of relics.slice(0, 6)) {
      if (!isRecord(item)) continue
      const name = text(item.name) || text(item.set_name) || '遗器'
      const level = text(item.level)
      lines.push(`${name}${level ? ` +${level}` : ''}`)
    }
  }
  return lines.length ? `${label}\n${lines.join('\n')}` : `${label}：暂无具体面板数据。`
}

export function formatRecord(label: string, data: unknown) {
  if (!isRecord(data)) return `${label}：暂无可展示的数据。`
  const fields = ['nickname', 'name', 'level', 'active_days', 'achievement_number', 'reliquaries', 'chests', 'total_star', 'max_floor', 'max_score', 'total_battle_times', 'has_data']
  const lines = fields.flatMap(key => {
    const value = text(data[key])
    return value && value !== '[object Object]' ? [`${key}：${value}`] : []
  })
  const roles = roleList(data)
  if (roles.length || Array.isArray(data.avatar_list) || Array.isArray(data.list)) lines.push(`角色数量：${roles.length}`)
  for (const key of ['all_floor', 'floors', 'floor_list']) {
    if (!Array.isArray(data[key])) continue
    const floors = (data[key] as unknown[]).filter(isRecord)
    lines.push(`关卡数量：${floors.length}`)
    for (const floor of floors.slice(0, 12)) {
      const name = text(floor.name) || text(floor.floor_name) || text(floor.index) || text(floor.floor) || '关卡'
      const score = text(floor.star_num) || text(floor.star) || text(floor.score) || text(floor.max_score)
      lines.push(`${name}${score ? `：${score}` : ''}`)
    }
    break
  }
  for (const key of ['stats', 'role', 'data']) {
    if (isRecord(data[key])) {
      for (const field of fields) {
        const value = text((data[key] as Record<string, unknown>)[field])
        if (value && value !== '[object Object]') lines.push(`${field}：${value}`)
      }
    }
  }
  return lines.length ? `${label}\n${lines.slice(0, 22).join('\n')}` : `${label}：接口返回数据，但暂无可展示的摘要。`
}

function lastChallenge(data: unknown, schedule: 1 | 2 | 3 = 1) {
  if (!isRecord(data)) return '挑战数据缺失。'
  if (Array.isArray(data.challenge_peak_records)) {
    const peak = data.challenge_peak_records[schedule === 2 ? 1 : 0]
    if (!isRecord(peak)) return '挑战数据缺失。'
    const latest = (items: unknown[], names: unknown[]) => {
      const candidates: { record: Record<string, unknown>; name: string; time?: number }[] = []
      for (let index = 0; index < items.length; index++) {
        const record = items[index]
        if (!isRecord(record) || record.has_challenge_record !== true && record.is_fast !== true) continue
        const info = names[index]
        const name = isRecord(info) ? text(info.name) : undefined
        candidates.push({ record, name: name || `骑士关卡${index + 1}`, time: Date.parse(String(record.challenge_time || '')) })
      }
      return candidates.reduce((selected, candidate) => candidate.time !== undefined && Number.isFinite(candidate.time) && (selected.time === undefined || !Number.isFinite(selected.time) || candidate.time > selected.time) ? candidate : selected, candidates[0])
    }
    const boss = isRecord(peak.boss_record) ? peak.boss_record : undefined
    const mobs = Array.isArray(peak.mob_records) ? peak.mob_records : []
    const infos = Array.isArray(peak.mob_infos) ? peak.mob_infos : []
    const lines: string[] = []
    if (boss?.has_challenge_record === true) {
      const info = isRecord(peak.boss_info) ? peak.boss_info : undefined
      lines.push(`王棋：${text(info?.name_mi18n) || '未知'}；该关星数：${text(boss.star_num) ?? '未知'}`)
    } else if (boss && boss.has_challenge_record === false) {
      lines.push('王棋：暂无挑战记录。')
    }
    const mob = latest(mobs, infos)
    if (mob) lines.push(`骑士：${mob.name}；该关星数：${text(mob.record.star_num) ?? '未知'}`)
    else if (mobs.length) lines.push('骑士：暂无挑战记录。')
    return lines.length ? lines.join('；') : '挑战数据缺失。'
  }
  const floors = Array.isArray(data.all_floor_detail) ? data.all_floor_detail.filter(isRecord) : []
  const maxFloor = text(data.max_floor)
  const maxFloorNumber = maxFloor ? Number(maxFloor.replace(/[^0-9]/g, '')) : undefined
  const floor = floors.find(item => text(item.name) === maxFloor)
    || floors.find(item => Number(text(item.name)?.replace(/[^0-9]/g, '')) === maxFloorNumber)
  if (!floor) return maxFloor === '0' ? '暂无挑战记录。' : maxFloor ? `最后关：${maxFloor}；该关星数：未知` : floors.length ? '最后关：未知；该关星数：未知' : '挑战数据缺失。'
  return `最后关：${text(floor.name) || maxFloor || '未知'}；该关星数：${text(floor.star_num) ?? '未知'}`
}

function formatChallenge(label: string, data: unknown, schedule: 1 | 2 | 3, type: string) {
  if (!isRecord(data)) return `${label}：暂无挑战记录。`
  const lines: string[] = []
  const peaks = Array.isArray(data.challenge_peak_records) ? data.challenge_peak_records : []
  if (type === 'anomaly') {
    const peak = peaks[schedule === 2 ? 1 : 0]
    if (!isRecord(peak)) return `${label}\n暂无王棋记录。`
    const group = isRecord(peak.group) ? peak.group : {}
    const boss = isRecord(peak.boss_record) ? peak.boss_record : {}
    const bossInfo = isRecord(peak.boss_info) ? peak.boss_info : {}
    const groupName = text(group.name_mi18n) || text(group.name)
    const bossName = text(bossInfo.name_mi18n) || text(bossInfo.name)
    const bossStars = text(peak.boss_stars) || text(boss.star_num)
    const mobStars = text(peak.mob_stars)
    const battleCount = isRecord(data.challenge_peak_best_record_brief) ? text(data.challenge_peak_best_record_brief.total_battle_num) : undefined
    if (groupName) lines.push(`周期：${groupName}`)
    if (bossName || bossStars) lines.push(`王棋：${bossName || '已记录'}${bossStars ? `（${bossStars} 星）` : ''}`)
    if (mobStars) lines.push(`骑士：${mobStars} 星`)
    if (battleCount) lines.push(`战斗次数：${battleCount}`)
    return `${label}\n${lines.length ? lines.join('\n') : '暂无王棋记录。'}`
  }
  const groups = Array.isArray(data.groups) ? data.groups.filter(isRecord) : []
  const group = groups.find(item => item.status === (schedule === 1 ? 'New' : 'End')) || groups[0]
  if (group) {
    const name = text(group.name)
    const begin = text(group.begin_time)
    const end = text(group.end_time)
    if (name) lines.push(`赛季：${name}`)
    if (begin || end) lines.push(`开放时间：${begin || '未知'} 至 ${end || '未知'}`)
  }
  const totalStars = text(data.total_star) || text(group?.total_star)
  const maxScore = text(data.max_score) || text(group?.max_score)
  if (totalStars) lines.push(`总星数：${totalStars}`)
  if (maxScore) lines.push(`总分：${maxScore}`)
  const details = Array.isArray(data.all_floor_detail) ? data.all_floor_detail.filter(isRecord) : []
  if (details.length) {
    const maxFloor = text(data.max_floor)
    const progress = maxFloor ? details.find(item => {
      const name = text(item.name) || text(item.floor) || ''
      return name === maxFloor || name.startsWith(maxFloor) || maxFloor.startsWith(name)
    }) : undefined
    const selected = progress ? [progress] : details.slice(0, 12)
    for (const floor of selected) {
      const name = text(floor.name) || text(floor.floor_name) || text(floor.floor) || text(floor.index) || '关卡'
      const nodes = ['node_1', 'node_2', 'node_3'].map(key => floor[key]).filter(isRecord)
      const scores = nodes.map(node => Number(node.score)).filter(Number.isFinite)
      const score = text(floor.score) || (scores.length ? String(scores.reduce((sum, item) => sum + item, 0)) : undefined)
      const stars = text(floor.star_num) || text(floor.star) || text(floor.total_star)
      lines.push(`${maxFloor ? '最高通关' : '关卡'}：${name}${stars ? `（${stars} 星）` : ''}${score ? `，得分 ${score}` : ''}`)
    }
  } else if (text(data.max_floor)) {
    lines.push(`最高通关：${text(data.max_floor)}`)
  }
  return `${label}${lines.length ? `\n${lines.slice(0, 22).join('\n')}` : ''}`
}

function recordError(result: Result) {
  if (result.retcode === 10102) return '查询失败：该角色的米游社数据未公开。'
  if (result.retcode === 10101) return '查询失败：今日查询次数已达上限。'
  if (result.retcode === 1008) return '查询失败：请先在米游社绑定角色。'
  if ([1034, 10035].includes(result.retcode)) return '查询失败：平台要求验证码，请在官方客户端完成验证。'
  if ([5003, 10041].includes(result.retcode)) return '查询失败：账号或设备状态异常，请在官方客户端检查。'
  if (result.retcode === -10001 || result.retcode === 10001) {
    const message = typeof result.message === 'string' ? result.message : ''
    if (/device|fingerprint|risk|forbidden|风控|设备/i.test(message)) return '查询失败：请求被设备或风控策略拒绝，请先在官方客户端打开对应角色页面后重试。'
    if (/登录|log[ -]?in|not logged in|(?:token|cookie).*(?:expired|invalid)|(?:expired|invalid).*(?:token|cookie)/i.test(message)) return '查询失败：Cookie 或登录状态已失效，请重新绑定米游社凭证。'
    return `查询失败（${result.retcode}）：记录接口拒绝请求，原因未知，请在官方客户端检查账号状态。`
  }
  return `查询失败（${result.retcode}），请检查角色展示权限及官方客户端状态。`
}

export function formatAccountOverview(data: AccountOverview) {
  const lines = [
    `${data.game === 'gs' ? '原神' : '星穹铁道'}账号概览`,
    `UID：${data.uid}`,
    `昵称：${data.nickname}`,
  ]
  lines.push(...data.characters.map(character => character.name))
  return lines.join('\n')
}

export function createRecords(client: ReturnType<typeof createClient>, cache?: StaticCache) {
  const cn = (region: string) => region.startsWith('cn_') || region.endsWith('_cn')
  const host = (region: string) => cn(region) ? 'https://api-takumi-record.mihoyo.com' : 'https://sg-act-public-api.hoyolab.com'

  async function queryAccount(account: GameRole, secret: string, device?: DeviceInfo, includeChallenges = false): Promise<AccountOverview | string> {
    if (account.game !== 'gs' && account.game !== 'sr') return '该游戏不支持账号概览。'
    const owned = await client.discover(secret)
    if (!owned.some(role => role.game === account.game && role.uid === account.uid && role.region === account.region)) {
      return '查询失败：当前凭证未绑定该游戏 UID，拒绝请求。'
    }
    const game = account.game
    const prefix = game === 'gs' ? '/game_record/app/genshin/api/' : '/game_record/app/hkrpg/api/'
    const params = new URLSearchParams({ role_id: account.uid, server: account.region })
    async function section(path: string, extra?: Record<string, string>, body?: object): Promise<{ data?: Record<string, unknown>; error?: string }> {
      try {
        const query = new URLSearchParams(params)
        for (const [key, value] of Object.entries(extra || {})) query.set(key, value)
        const result = await client.record(`${host(account.region)}${prefix}${path}${body ? '' : `?${query}`}`, secret, body, device)
        return result.retcode === 0 ? { data: result.data } : { error: recordError(result) }
      } catch {
        return { error: '查询失败：接口请求异常。' }
      }
    }
    const index = await section('index')
    const data = isRecord(index.data) ? index.data : {}
    const role = isRecord(data.role) ? data.role : {}
    const profile = game === 'sr' ? await section('role/basicInfo') : undefined
    const profileData = isRecord(profile?.data) ? profile.data : {}
    const profileRole = isRecord(profileData.role) ? profileData.role : {}
    const roleSection = game === 'gs'
      ? await section('character/list', undefined, { role_id: account.uid, server: account.region })
      : await section('avatar/basic')
    const characters = roleList(roleSection.data)
    const overview: AccountOverview = {
      game,
      uid: account.uid,
      nickname: text(role.nickname) || text(data.nickname) || text(profileRole.nickname) || text(profileData.nickname) || '未知',
      avatar: accountAvatar(role) || accountAvatar(data) || accountAvatar(profileRole) || accountAvatar(profileData),
      level: text(role.level) || text(data.level) || text(profileRole.level) || text(profileData.level),
      server: text(profileData.region_name) || text(profileRole.region_name) || account.region,
      characters: characters.map(character => {
        const id = valueOf(character, ['id', 'avatar_id', 'character_id']) || '未知ID'
        return {
          id,
          name: valueOf(character, ['name', 'avatar_name', 'character_name']) || '未知昵称',
          avatar: accountCharacterAvatar(game, character, id),
        }
      }),
    }
    if (game === 'sr' && includeChallenges) {
      const challengeTypes = ['forgotten', 'fiction', 'apocalypse', 'anomaly'] as const
      const challengeResults = await Promise.all(challengeTypes.map(async type => {
        const query = new URLSearchParams({ role_id: account.uid, schedule_type: '1', server: account.region })
        try {
          const result = await client.record(`${host(account.region)}${prefix}${recordTypes.sr[type]}?${query}`, secret, undefined, device)
          return result.retcode === 0 && isRecord(result.data) ? [type, result.data] as const : undefined
        } catch {
          return undefined
        }
      }))
      overview.challenges = Object.fromEntries(challengeResults.filter(item => item !== undefined))
    }
    return overview
  }

  async function queryStamina(account: GameRole, secret: string, device?: DeviceInfo) {
    if (account.game !== 'sr') return undefined
    const prefix = '/game_record/app/hkrpg/api/'
    const params = new URLSearchParams({ role_id: account.uid, server: account.region })
    try {
      const result = await client.record(`${host(account.region)}${prefix}note?${params}`, secret, undefined, device)
      if (result.retcode !== 0) return undefined
      return isRecord(result.data) ? result.data : undefined
    } catch {
      return undefined
    }
  }

  async function warmStarRailData(data: unknown) {
    if (!cache || !isRecord(data)) return
    const avatars = roleList(data)
    const ids = new Set<string>()
    const lightCones = new Set<string>()
    for (const avatar of avatars) {
      const id = valueOf(avatar, ['id', 'avatar_id', 'character_id'])
      if (id) ids.add(id)
      const equip = avatar.equip || avatar.light_cone || avatar.weapon || avatar.equipment
      if (isRecord(equip)) {
        const coneId = valueOf(equip, ['id', 'equipment_id', 'light_cone_id', 'weapon_id'])
        if (coneId) lightCones.add(coneId)
      }
    }
    const source = 'https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_new/cn/'
    const resources: [keyof typeof starRailData, string, Set<string>][] = [
      ['characters', 'characters.json', ids],
      ['characterPromotions', 'character_promotions.json', ids],
      ['characterSkillTrees', 'character_skill_trees.json', ids],
      ['lightCones', 'light_cones.json', lightCones],
      ['lightConePromotions', 'light_cone_promotions.json', lightCones],
      ['lightConeRanks', 'light_cone_ranks.json', lightCones],
    ]
    await Promise.all(resources.map(async ([resource, file, wanted]) => {
      const missing = [...wanted].some(id => !(id in (starRailData[resource] as Record<string, unknown>)))
      if (!missing) return
      const id = `starrail:${file}`
      const remote = await cache.getOrFetch(id, async () => {
        const response = await fetch(`${source}${file}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const value = await response.json()
        if (!isRecord(value)) throw new Error('invalid JSON resource')
        return { source: `${source}${file}`, version: 'master', data: value }
      })
      if (remote) mergeStarRailData(resource, remote)
    }))
  }

  async function enrichStarRailPanel(account: GameRole, panel: PanelData) {
    try {
      const response = await fetch(`https://api.mihomo.me/sr_info_parsed/${encodeURIComponent(account.uid)}?lang=chs`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) return panel
      const data = await response.json() as MihomoPlayerData
      const candidates = Array.isArray(data.characters) ? data.characters.filter(isRecord) : []
      return {
        ...panel,
        characters: panel.characters.map(character => {
          const match = candidates.find(item => String(item.id ?? '') === String(character.id ?? ''))
          if (!match) return character
          const supplement = normalizeCharacter(match)
          return {
            ...character,
            image: character.image || supplement.image,
            icon: character.icon || supplement.icon,
            elementIcon: character.elementIcon || supplement.elementIcon,
            pathIcon: character.pathIcon || supplement.pathIcon,
            traces: character.traces.map(trace => ({
              ...trace,
              icon: trace.icon || supplement.traces.find(item => item.id === trace.id)?.icon || assetUrl(mihomoTraceIcons[trace.id || '']),
            })),
            lightCone: character.lightCone ? {
              ...character.lightCone,
              icon: character.lightCone.icon || (character.lightCone.id && character.lightCone.id === supplement.lightCone?.id ? supplement.lightCone.icon : undefined),
            } : character.lightCone,
            relics: character.relics.map(relic => {
              const related = supplement.relics.find(item => item.id === relic.id)
              return { ...relic, icon: relic.icon || related?.icon }
            }),
          }
        }),
      }
    } catch {
      return panel
    }
  }

  async function queryPanel(account: GameRole, secret: string, device?: DeviceInfo, character?: string): Promise<PanelData | string> {
    if (account.game !== 'sr' && account.game !== 'gs') return '该游戏不支持角色面板。'
    const game = account.game
    const owned = await client.discover(secret)
    if (!owned.some(role => role.game === game && role.uid === account.uid && role.region === account.region)) {
      return '查询失败：当前凭证未绑定该游戏 UID，拒绝请求。'
    }
    const path = recordTypes[game].panel
    const prefix = game === 'gs' ? '/game_record/app/genshin/api/' : '/game_record/app/hkrpg/api/'
    const hostUrl = `${host(account.region)}${prefix}${path}`
    const params = new URLSearchParams({ need_wiki: 'true', role_id: account.uid, server: account.region })
    let body: object | undefined
    let url = hostUrl
    if (game === 'gs') {
      body = { role_id: account.uid, server: account.region }
      const list = await client.record(`${host(account.region)}${prefix}${recordTypes.gs.roles}`, secret, body, device)
      if (list.retcode !== 0) return recordError(list)
      const ids = roleList(list.data).map(role => role.id).filter(id => typeof id === 'number' || typeof id === 'string').slice(0, 60)
      if (!ids.length) return '没有可更新的角色面板。'
      body = { ...body, character_ids: ids }
    } else {
      url = `${hostUrl}?${params}`
    }
    const result = await client.record(url, secret, body, device)
    if (result.retcode !== 0) return recordError(result)
    if (game === 'sr') {
      await warmStarRailData(result.data)
      if (cache && isRecord(result.data)) {
        await Promise.all(roleList(result.data).map(async item => {
          const id = valueOf(item, ['id', 'avatar_id', 'character_id'])
          if (id) await ensureFribbelsScoring(id, cache)
        }))
      }
    }
    let panel = normalizePanel(game, account, result.data)
    if (game === 'sr') panel = await enrichStarRailPanel(account, panel)
    if (character) {
      const selected = panel.characters.find(item => [item.name, item.id].some(value => String(value || '').toLowerCase() === character.trim().toLowerCase()))
      if (!selected) return `未找到角色“${character}”，当前接口返回 ${panel.characters.length} 个角色。`
      return { ...panel, characters: [selected] }
    }
    return panel
  }

  async function query(account: GameRole, secret: string, type: string, schedule: 1 | 2 | 3 = 1, device?: DeviceInfo, character?: string) {
    if (!(account.game in recordTypes)) return '该游戏不支持记录查询。'
    const game = account.game as RecordGame
    const paths = recordTypes[game] as Record<string, string>
    if (!Object.hasOwn(paths, type)) return '该游戏不支持此记录类型。'
    const owned = await client.discover(secret)
    if (!owned.some(role => role.game === game && role.uid === account.uid && role.region === account.region)) {
      return '查询失败：当前凭证未绑定该游戏 UID，拒绝请求。'
    }
    const prefix = game === 'gs' ? '/game_record/app/genshin/api/' : game === 'sr' ? '/game_record/app/hkrpg/api/' : '/event/game_record_zzz/api/zzz/'
    const url = `${host(account.region)}${prefix}${paths[type]}`
    const params = new URLSearchParams({ role_id: account.uid, server: account.region })
    if (game === 'sr' && type === 'overview') {
      const index = await client.record(`${url}?${params}`, secret, undefined, device)
      if (index.retcode !== 0) return recordError(index)
      const summary = formatRecord('sr overview', index.data)
      let brief: Result
      try {
        brief = await client.record(`${host(account.region)}${prefix}challenge_brief?${params}`, secret, undefined, device)
      } catch {
        return `${summary}\n挑战摘要：查询失败：接口请求异常。`
      }
      if (brief.retcode !== 0) return `${summary}\n挑战摘要：${recordError(brief)}`
      const schedules = Array.isArray(brief.data?.list) ? brief.data.list.filter(isRecord) : []
      const lines = schedules.slice(0, 3).map(item => {
        const current = isRecord(item.cur_schedule) ? item.cur_schedule : {}
        return `${text(item.challenge_type) || '挑战'}：${text(current.finish_star_count) || '0'}/${text(current.total_star_count) || '-'}`
      })
      return lines.length ? `${summary}\n${lines.join('\n')}` : summary
    }
    let body: object | undefined
    if (game === 'gs' && (type === 'roles' || type === 'panel')) {
      body = { role_id: account.uid, server: account.region }
      if (type === 'panel') {
        const list = await client.record(`${host(account.region)}${prefix}${paths.roles}`, secret, body, device)
        if (list.retcode !== 0) return recordError(list)
        const ids = roleList(list.data).map(role => role.id).filter(id => typeof id === 'number' || typeof id === 'string').slice(0, 60)
        if (!ids.length) return '没有可更新的角色面板。'
        body = { ...body, character_ids: ids }
      }
    } else {
      if (game === 'zzz') params.set('lang', 'zh-cn')
      if (game === 'sr' && type === 'panel') {
        const ordered = new URLSearchParams({ need_wiki: 'true', role_id: account.uid, server: account.region })
        params.delete('role_id')
        params.delete('server')
        for (const [key, value] of ordered) params.set(key, value)
      }
      if (['forgotten', 'fiction', 'apocalypse', 'anomaly', 'abyss'].includes(type)) {
        const ordered = new URLSearchParams({ role_id: account.uid, schedule_type: String(schedule), server: account.region })
        params.delete('role_id')
        params.delete('server')
        for (const [key, value] of ordered) params.set(key, value)
      }
      if (game === 'gs' && ['theater', 'peril'].includes(type)) params.set('need_detail', 'true')
    }
    const result = await client.record(body ? url : `${url}?${params}`, secret, body, device)
    if (result.retcode !== 0) return recordError(result)
    if (type === 'panel' && character) {
      const selected = findRole(result.data, character)
      if (!selected) return `未找到角色“${character}”，请先使用 mys.record ${game} panel 查看角色名称。`
      return panelRecord(selected, `${game} ${character} 面板`)
    }
    const label = `${game} ${type}（${schedule === 2 ? '上期' : schedule === 3 ? '往期' : '本期'}）`
    return game === 'sr' && ['forgotten', 'fiction', 'apocalypse', 'anomaly'].includes(type)
      ? formatChallenge(label, result.data, schedule, type)
      : formatRecord(label, result.data)
  }

  return { query, queryPanel, queryAccount, queryStamina }
}

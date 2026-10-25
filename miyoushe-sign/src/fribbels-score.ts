import { fribbelsPartMainStats, fribbelsScoring, fribbelsScoringSource } from './fribbels-data'
import { starRailData } from './starrail-data'
import { StaticCache } from './data-cache'

export type RelicSlot = 'HEAD' | 'HAND' | 'BODY' | 'FOOT' | 'NECK' | 'OBJECT'

export type FribbelsGrade =
  | '?' | 'F' | 'F+' | 'D' | 'D+' | 'C' | 'C+' | 'B' | 'B+'
  | 'A' | 'A+' | 'S' | 'S+' | 'SS' | 'SS+' | 'SSS' | 'SSS+' | 'WTF' | 'WTF+' | 'AEON'

export const fribbelsScoreMetadata = Object.freeze({
  source: fribbelsScoringSource.repository,
  commit: fribbelsScoringSource.commit,
  license: fribbelsScoringSource.license,
  date: fribbelsScoringSource.extractedAt,
})

export interface FribbelsRelicScore {
  status: 'supported'
  characterId: string
  effectiveRolls: number
  score: number
  grade: FribbelsGrade
  mainOk: boolean
}

export interface FribbelsUnsupportedScore {
  status: 'unsupported'
  characterId: string
  reason: string
  source: string
  date: string
}

export interface FribbelsIncompleteScore {
  status: 'incomplete'
  characterId?: string
  reason: string
  source: string
  date: string
}

export interface FribbelsSetScore {
  status: 'supported'
  characterId: string
  relics: FribbelsRelicScore[]
  averageScore: number
  averageGrade: FribbelsGrade
  effectiveRolls: number
  source: string
  date: string
}

export interface FribbelsRelicInput {
  slot: RelicSlot
  rarity: number
  main: string
  subStats: readonly { type: string; value: number }[]
}

const SLOT_PARTS: Record<RelicSlot, string> = {
  HEAD: 'Head', HAND: 'Hands', BODY: 'Body', FOOT: 'Feet', NECK: 'LinkRope', OBJECT: 'PlanarSphere',
}

const PROPERTY_STATS: Record<string, string> = {
  HPDelta: 'HP', AttackDelta: 'ATK', DefenceDelta: 'DEF',
  HPAddedRatio: 'HP_P', AttackAddedRatio: 'ATK_P', DefenceAddedRatio: 'DEF_P',
  SpeedDelta: 'SPD', CriticalChanceBase: 'CR', CriticalDamageBase: 'CD',
  StatusProbabilityBase: 'EHR', StatusResistanceBase: 'RES', BreakDamageAddedRatioBase: 'BE',
  EnergyRecoveryRateBase: 'ERR', SPRatioBase: 'ERR', HealRatioBase: 'OHB',
  PhysicalAddedRatio: 'Physical_DMG', FireAddedRatio: 'Fire_DMG', IceAddedRatio: 'Ice_DMG',
  ThunderAddedRatio: 'Lightning_DMG', WindAddedRatio: 'Wind_DMG', QuantumAddedRatio: 'Quantum_DMG',
  ImaginaryAddedRatio: 'Imaginary_DMG', ElationDamageAddedRatioBase: 'Elation',
}

const SUBSTATS = ['ATK_P', 'ATK', 'HP_P', 'HP', 'DEF_P', 'DEF', 'SPD', 'CR', 'CD', 'EHR', 'RES', 'BE']
const ALL_STATS = [
  'ATK_P', 'ATK', 'BE', 'CD', 'CR', 'DEF_P', 'DEF', 'EHR', 'ERR', 'Fire_DMG',
  'HP_P', 'HP', 'Ice_DMG', 'Imaginary_DMG', 'Lightning_DMG', 'OHB', 'Physical_DMG',
  'Quantum_DMG', 'RES', 'SPD_P', 'SPD', 'Wind_DMG',
]
const RATING_TIERS: readonly [number, FribbelsGrade][] = [
  [0, 'F'], [5, 'F+'], [10, 'D'], [15, 'D+'], [20, 'C'], [25, 'C+'], [30, 'B'], [35, 'B+'],
  [40, 'A'], [45, 'A+'], [50, 'S'], [55, 'S+'], [60, 'SS'], [65, 'SS+'], [70, 'SSS'],
  [75, 'SSS+'], [80, 'WTF'], [85, 'WTF+'], [90, 'AEON'],
]

const tiers: Record<string, { low: number; high: number }> = {}
for (const affix of Object.values(starRailData.relicSubAffixes['5'].affixes as Record<string, { property: string; base: number; step: number; step_num?: number }>)) {
  tiers[affix.property] = { low: affix.base, high: affix.base + affix.step * (affix.step_num ?? 2) }
}

const unsupported = (characterId: string): FribbelsUnsupportedScore => ({
  status: 'unsupported', characterId,
  reason: `来源中缺少角色 ${characterId} 的评分权重，不提供推测数值`,
  source: fribbelsScoringSource.repository, date: fribbelsScoringSource.extractedAt,
})

const incomplete = (reason: string, characterId?: string): FribbelsIncompleteScore => ({
  status: 'incomplete', characterId, reason,
  source: fribbelsScoringSource.repository, date: fribbelsScoringSource.extractedAt,
})

function clampWeight(value: number | undefined) {
  return Math.min(1, Math.max(0, value ?? 0))
}

function prepareWeights(characterId: string) {
  const meta = fribbelsScoring[characterId]
  if (!meta) return undefined
  const weights: Record<string, number> = {}
  for (const stat of SUBSTATS) weights[stat] = clampWeight(meta.stats[stat])
  weights.HP = weights.HP_P * 0.4
  weights.ATK = weights.ATK_P * 0.4
  weights.DEF = weights.DEF_P * 0.4
  return weights
}

function hasMainStat(part: string) {
  return part === 'Body' || part === 'Feet' || part === 'PlanarSphere' || part === 'LinkRope'
}

function mainStatWeight(part: string, mainStat: string, weights: Record<string, number>, parts: Record<string, string[]>) {
  if (!hasMainStat(part)) return 0
  if ((parts[part] || []).includes(mainStat)) return 1
  return weights[mainStat] ?? 0
}

function resolveOptimalMainstat(part: string, mainStat: string, weights: Record<string, number>, parts: Record<string, string[]>) {
  const ideal = parts[part] || []
  if (ideal.includes(mainStat) || weights[mainStat] === 1 || !hasMainStat(part)) return mainStat
  const entries = ALL_STATS
    .map(stat => [stat, ideal.includes(stat) || weights[stat] === 1 ? 1 : weights[stat] ?? 0] as [string, number])
    .sort((a, b) => b[1] - a[1])
  const possible = fribbelsPartMainStats[part] || []
  const index = entries.findIndex(([name]) => possible.includes(name))
  if (index < 0) return mainStat
  const topWeight = entries[index][1]
  let resolved = entries[index][0]
  let isIdeal = false
  let isSubstat = true
  for (let cursor = index; cursor < entries.length; cursor++) {
    const [name, weight] = entries[cursor]
    if (weight !== topWeight) break
    if (!possible.includes(name)) continue
    const nextIdeal = ideal.includes(name)
    const nextSubstat = SUBSTATS.includes(name)
    if (isIdeal && !nextIdeal) continue
    if (!isSubstat && nextSubstat) continue
    if (isIdeal === nextIdeal && isSubstat === nextSubstat) continue
    resolved = name
    isIdeal = nextIdeal
    isSubstat = nextSubstat
  }
  return resolved
}

function optimalScore(part: string, mainStat: string, weights: Record<string, number>, parts: Record<string, string[]>) {
  const sorted = SUBSTATS.map(stat => [stat, weights[stat] || 0] as [string, number]).sort((a, b) => b[1] - a[1])
  const high = (stat: string) => (weights[stat] || 0) * 6.48
  const none = sorted[0][1] === 0
  if (none) return Infinity
  const single = sorted[1][1] === 0
  const normal = sorted[2][1] > 0
  const pair = (first: string, second: string) =>
    (sorted[0][0] === first && sorted[1][0] === second) || (sorted[0][0] === second && sorted[1][0] === first)
  if (single) {
    const stat = sorted[0][0]
    return stat === mainStat ? Infinity : 6 * high(stat)
  }
  if (!normal && (pair('HP_P', 'HP') || pair('ATK_P', 'ATK') || pair('DEF_P', 'DEF'))) {
    const stat1 = sorted[0][0]
    const stat2 = sorted[1][0]
    const blocked1 = stat1 === mainStat
    const blocked2 = stat2 === mainStat
    if (blocked1 && blocked2) return Infinity
    if (blocked1) return 6 * high(stat2)
    if (blocked2) return 6 * high(stat1)
    return 6 * high(stat1) + high(stat2)
  }
  const resolved = resolveOptimalMainstat(part, mainStat, weights, parts)
  const effective = sorted.filter(([stat]) => stat !== resolved).map(([stat]) => high(stat)).sort((a, b) => b - a)
  return 6 * (effective[0] || 0) + (effective[1] || 0) + (effective[2] || 0) + (effective[3] || 0)
}

function toGrade(score: number, rarityOk: boolean, part: string, mainOk: boolean): FribbelsGrade {
  if (!rarityOk || score <= 0) return '?'
  if (part !== 'Head' && part !== 'Hands' && !mainOk) return '?'
  for (let index = RATING_TIERS.length - 1; index >= 0; index--) {
    if (score >= RATING_TIERS[index][0]) {
      return RATING_TIERS[index][1] === 'AEON' ? 'WTF+' : RATING_TIERS[index][1]
    }
  }
  return '?'
}

const truncateTenth = (value: number) => Math.trunc(value * 10) / 10

export function scoreFribbelsRelic(characterId: string, relic: FribbelsRelicInput): FribbelsRelicScore | FribbelsUnsupportedScore | FribbelsIncompleteScore {
  const prepared = prepareWeights(characterId)
  if (!prepared) return unsupported(characterId)
  const meta = fribbelsScoring[characterId]
  if (relic.rarity !== 5) return incomplete('评分权重与词条档位仅覆盖五星遗器', characterId)
  const part = SLOT_PARTS[relic.slot]
  if (!part) return incomplete('未知遗器部位', characterId)
  const mainStat = PROPERTY_STATS[relic.main]
  if (!mainStat) return incomplete('无法识别主词条类型', characterId)
  let raw = 0
  let effectiveRolls = 0
  for (const sub of relic.subStats) {
    const stat = PROPERTY_STATS[sub.type]
    const tier = tiers[sub.type]
    if (!stat || !tier) return incomplete(`无法识别副词条类型 ${sub.type}`, characterId)
    if (!Number.isFinite(sub.value)) return incomplete('副词条数值无效', characterId)
    const weight = prepared[stat] || 0
    raw += sub.value * weight * (6.48 / tier.high)
    effectiveRolls += (sub.value / tier.low) * weight
  }
  const ideal = optimalScore(part, mainStat, prepared, meta.parts)
  const score = ideal === Infinity ? 0 : truncateTenth(Math.round((raw / ideal) * 100 * 1e10) / 1e10)
  const mainOk = !hasMainStat(part) || mainStatWeight(part, mainStat, prepared, meta.parts) > 0
  return {
    status: 'supported', characterId, effectiveRolls,
    score, grade: toGrade(score, true, part, mainOk), mainOk,
  }
}

export function scoreFribbelsSet(characterId: string, relics: readonly FribbelsRelicInput[]): FribbelsSetScore | FribbelsUnsupportedScore | FribbelsIncompleteScore {
  const prepared = prepareWeights(characterId)
  if (!prepared) return unsupported(characterId)
  if (relics.length !== 6) return incomplete(`整套评分需要六件遗器，当前 ${relics.length} 件`, characterId)
  if (new Set(relics.map(relic => relic.slot)).size !== 6) return incomplete('遗器部位不能重复', characterId)
  const scores: FribbelsRelicScore[] = []
  for (const relic of relics) {
    const result = scoreFribbelsRelic(characterId, relic)
    if (result.status !== 'supported') return result.status === 'incomplete' ? result : unsupported(characterId)
    scores.push(result)
  }
  const averageScore = truncateTenth(scores.reduce((sum, score) => sum + score.score, 0) / scores.length)
  const part = 'Body'
  return {
    status: 'supported', characterId, relics: scores,
    averageScore, averageGrade: toGrade(averageScore, true, part, true),
    effectiveRolls: scores.reduce((sum, score) => sum + score.effectiveRolls, 0),
    source: fribbelsScoringSource.repository, date: fribbelsScoringSource.extractedAt,
  }
}

export function fribbelsSlotOf(slot: string): RelicSlot | undefined {
  return ({ 头部: 'HEAD', 手部: 'HAND', 躯干: 'BODY', 脚部: 'FOOT', 位面球: 'OBJECT', 连结绳: 'NECK' } as Record<string, RelicSlot>)[slot]
}

function parseRemoteScoring(source: string) {
  const statsBlock = source.match(/stats\s*:\s*\{([\s\S]*?)\n\s*\},\s*parts\s*:/)?.[1]
  const partsBlock = source.match(/parts\s*:\s*\{([\s\S]*?)\n\s*\},\s*\}\)/)?.[1]
  if (!statsBlock || !partsBlock) return undefined
  const stats: Record<string, number> = {}
  for (const match of statsBlock.matchAll(/Stats\.([A-Za-z0-9_]+)\s*\]\s*:\s*(-?\d+(?:\.\d+)?)/g)) stats[match[1]] = Number(match[2])
  const parts: Record<string, string[]> = {}
  for (const match of partsBlock.matchAll(/Parts\.([A-Za-z0-9_]+)\s*\]\s*:\s*\[([^\]]*)\]/g)) {
    parts[match[1]] = [...match[2].matchAll(/Stats\.([A-Za-z0-9_]+)/g)].map(item => item[1])
  }
  if (!Object.keys(stats).length || !Object.keys(parts).length) return undefined
  return { stats, parts }
}

export async function ensureFribbelsScoring(characterId: string, cache?: StaticCache) {
  if (fribbelsScoring[characterId] || !cache) return !!fribbelsScoring[characterId]
  const numericId = Number(characterId)
  const group = Number.isFinite(numericId) ? String(Math.floor(numericId / 100) * 100) : characterId.slice(0, -1)
  const id = `fribbels:scoring:${characterId}`
  const value = await cache.getOrFetch(id, async () => {
    const api = `https://api.github.com/repos/fribbels/hsr-optimizer/contents/src/lib/conditionals/character/${group}`
    const listingResponse = await fetch(api, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'koishi-miyoushe-sign' }, signal: AbortSignal.timeout(15000) })
    if (!listingResponse.ok) throw new Error(`HTTP ${listingResponse.status}`)
    const listing = await listingResponse.json() as unknown
    if (!Array.isArray(listing)) throw new Error('invalid character directory')
    const file = listing.find(item => item && typeof item === 'object' && 'name' in item && String((item as { name?: unknown }).name).match(/\.ts$/i)) as { download_url?: string } | undefined
    if (!file?.download_url) throw new Error('character scoring source not found')
    const response = await fetch(file.download_url, { headers: { accept: 'text/plain' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const parsed = parseRemoteScoring(await response.text())
    if (!parsed) throw new Error('invalid scoring source')
    return { source: file.download_url, version: 'main', data: parsed }
  })
  if (!value || typeof value !== 'object') return false
  fribbelsScoring[characterId] = value as typeof fribbelsScoring[string]
  return true
}

import { Context, h } from 'koishi'
import { GameRole } from './accounts'
import { AccountOverview, PanelData, PanelCharacter, PanelRelic, PanelTrace } from './records'
import type {} from 'koishi-plugin-puppeteer'

export interface PanelSnapshot {
  id: string
  platform: string
  userId: string
  game: string
  uid: string
  title: string
  lines: string
  data?: string
  updatedAt: string
}

function recordValue(data: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return undefined
}

function challengeText(data: Record<string, unknown> | undefined, keys: string[]) {
  return recordValue(data, keys)
}

function stars(value: string | undefined, total = 3, extra = false) {
  if (!value) return ''
  const count = Math.max(0, Math.min(total, Number(value) || 0))
  return `<span class="stars" aria-label="${escape(value)}星">${'★'.repeat(count)}${'☆'.repeat(total - count)}${extra ? '<i class="extra-star" title="星启模式">✦</i>' : ''}</span>`
}

function challengeFloor(data: Record<string, unknown>) {
  const details = Array.isArray(data.all_floor_detail) ? data.all_floor_detail.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
  const maxFloor = challengeText(data, ['max_floor'])
  const selected = maxFloor ? details.find(item => {
    const name = challengeText(item, ['name', 'floor']) || ''
    return name === maxFloor || name.startsWith(maxFloor) || maxFloor.startsWith(name)
  }) : details.at(-1)
  const floor = selected || (maxFloor ? { name: maxFloor } : undefined)
  if (!floor) return undefined
  const name = challengeText(floor, ['name', 'floor']) || maxFloor
  const nodes = ['node_1', 'node_2', 'node_3'].map(key => floor[key]).filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  const nodeScores = nodes.map(node => Number(challengeText(node, ['score']))).filter(Number.isFinite)
  const score = challengeText(floor, ['score']) || (nodeScores.length ? String(nodeScores.reduce((sum, item) => sum + item, 0)) : undefined)
  const star = challengeText(floor, ['star_num', 'star', 'total_star']) || challengeText(data, ['star_num', 'total_star'])
  const extraStar = challengeText(floor, ['extra_star_num']) || challengeText(data, ['extra_star_num'])
  return name ? { name, score, star, extraStar } : undefined
}

function challengeRows(data: AccountOverview['challenges']) {
  if (!data) return ''
  const items = [
    ['forgotten', '忘却之庭'],
    ['fiction', '虚构叙事'],
    ['apocalypse', '末日幻影'],
  ].map(([key, label]) => {
    const floor = challengeFloor(data[key] || {})
    if (!floor) return ''
    const baseStars = stars(floor.star)
    const extraStar = Number(floor.extraStar) > 0
    const starDisplay = `<span class="stars" aria-label="${escape(floor.star || '0')}星${extraStar ? '，含星启星' : ''}">${baseStars.replace(/^<span[^>]*>|<\/span>$/g, '')}${extraStar ? '<i class="extra-star" title="星启模式">✦</i>' : ''}</span>`
    return `<div class="challenge-row"><strong>${label}</strong><span class="challenge-floor">${escape(floor.name)}</span><span class="challenge-result">${starDisplay}${floor.score ? `<small>得分 ${escape(floor.score)}</small>` : ''}</span></div>`
  }).filter(Boolean).join('')
  return items ? `<section class="challenge-list"><h2>挑战记录</h2>${items}</section>` : ''
}

function anomalyCard(data: Record<string, unknown> | undefined) {
  if (!data) return ''
  const peaks = Array.isArray(data.challenge_peak_records) ? data.challenge_peak_records : []
  const peak = peaks[0] && typeof peaks[0] === 'object' ? peaks[0] as Record<string, unknown> : undefined
  if (!peak) return ''
  const group = peak.group && typeof peak.group === 'object' ? peak.group as Record<string, unknown> : undefined
  const bossInfo = peak.boss_info && typeof peak.boss_info === 'object' ? peak.boss_info as Record<string, unknown> : undefined
  const bossRecord = peak.boss_record && typeof peak.boss_record === 'object' ? peak.boss_record as Record<string, unknown> : undefined
  const bossName = challengeText(bossInfo, ['name_mi18n', 'name'])
  const bossStars = challengeText(peak, ['boss_stars']) || challengeText(bossRecord, ['star_num'])
  const mobStars = challengeText(peak, ['mob_stars'])
  const battle = challengeText(data.challenge_peak_best_record_brief as Record<string, unknown> | undefined, ['total_battle_num'])
  if (!bossName && !bossStars && !mobStars && !battle) return ''
  return `<section class="anomaly-card"><div class="anomaly-row"><strong>异相仲裁</strong><span class="anomaly-season">${escape(challengeText(group, ['name_mi18n', 'name']) || '本期')}</span><span class="anomaly-extra">${battle ? `挑战 ${escape(battle)} 次` : ''}</span></div><div class="anomaly-grid"><div><label>王棋</label><strong>${escape(bossName || '已记录')}</strong><span>${stars(bossStars, 3)}</span></div><div><label>骑士</label><strong>三关合计</strong><span class="mob-total">${escape(mobStars || '7')} 星</span></div></div></section>`
}

function serverName(region?: string) {
  const names: Record<string, string> = {
    prod_gf_cn: '星穹列车', prod_official_usa: 'America', prod_official_eur: 'Europe',
    prod_official_asia: 'Asia', prod_official_cht: 'TW/HK/MO',
  }
  return region ? names[region] || region : '未知服务器'
}

declare module 'koishi' {
  interface Tables {
    miyoushe_panel: PanelSnapshot
  }
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

function image(value: string | undefined, className: string) {
  if (!value || !/^https:\/\//i.test(value)) return `<div class="${className} placeholder">暂无图片</div>`
  return `<img class="${className}" src="${escape(value)}">`
}

function affixList(items: { name: string; value?: string; count?: string }[]) {
  return items.length
    ? items.map(item => `<div class="affix"><span>${escape(item.name)}</span><b>${escape(item.value || '-')}</b>${item.count ? `<em>×${escape(item.count)}</em>` : ''}</div>`).join('')
    : '<div class="muted">暂无副词条</div>'
}

function scoreHtml(score: PanelRelic['score'] | PanelCharacter['relicScore'], total = false) {
  if (!score) return ''
  const label = total ? '平均评分' : '遗器评分'
  if (score.status !== 'supported') return `<div class="score-note">${label}：${escape(score.status === 'unsupported' ? '该角色暂无评分权重' : '数据不完整')}<small>${escape(score.reason)}</small></div>`
  if (total && 'averageScore' in score) {
    return `<div class="relic-score"><span>${label}</span><b>${score.averageScore.toFixed(1)} <em>${escape(score.averageGrade)}</em></b><small>总有效词条 ${score.effectiveRolls.toFixed(1)}</small></div>`
  }
  if ('score' in score) {
    return `<div class="relic-score"><span>${label}</span><b>${score.score.toFixed(1)} <em>${escape(score.grade)}</em></b><small>有效词条 ${score.effectiveRolls.toFixed(1)}${score.mainOk ? '' : ' · 主词条不匹配'}</small></div>`
  }
  return ''
}

function relicCard(relic: PanelRelic) {
  return `<div class="relic">
    <div class="relic-head">${image(relic.icon, 'relic-icon')}<div><strong>${escape(relic.name)}</strong><small>${escape(relic.slot)}${relic.level ? ` · +${escape(relic.level)}` : ''}${relic.rarity ? ` · ★${escape(relic.rarity)}` : ''}${relic.setName ? ` · ${escape(relic.setName)}` : ''}</small></div></div>
    <div class="main-affix">${relic.mainIcon ? image(relic.mainIcon, 'stat-icon') : ''}<span>${escape(relic.main?.name || '主词条未知')}</span><b>${escape(relic.main?.value || '-')}</b></div>
    <div class="sub-affixes">${affixList(relic.subStats)}</div>
    ${relic.score?.status === 'supported' ? scoreHtml(relic.score) : ''}
  </div>`
}

function traceHtml(trace: PanelTrace, main: boolean) {
  const active = main || trace.active === true
  return `<div class="trace-node ${main ? 'trace-main' : trace.category === 'major' ? 'trace-major' : 'trace-minor'} ${active ? 'is-active' : 'is-inactive'}" title="${escape(trace.name)} · ${active ? '已激活' : '未激活'}"><div class="trace-medallion">${image(trace.icon, 'trace-art')}${main ? `<b class="trace-level">${escape(trace.level || '-')}</b>` : ''}</div>${main ? `<strong class="trace-label">${escape(trace.label || trace.type || '技能')}</strong>` : ''}<span class="trace-name">${escape(trace.name)}</span><span class="trace-status">${active ? '已激活' : '未激活'}</span></div>`
}

function tracesHtml(traces: PanelTrace[]) {
  if (!traces.length) return '<div class="muted">接口未返回行迹数据</div>'
  const main = traces.filter(trace => trace.category === 'main' || (!trace.category && /普攻|战技|终结技|天赋|秘技|欢愉技/.test(trace.type || trace.name)))
  const others = traces.filter(trace => !main.includes(trace))
  const major = others.filter(trace => trace.category === 'major')
  const minor = others.filter(trace => trace.category !== 'major')
  const order = ['普攻', '战技', '终结技', '天赋', '欢愉技', '秘技']
  main.sort((a, b) => {
    const index = (trace: PanelTrace) => { const result = order.indexOf(trace.label || trace.type || trace.name); return result < 0 ? order.length : result }
    return index(a) - index(b)
  })
  return `<div class="trace-skills">${main.map(trace => traceHtml(trace, true)).join('')}</div><div class="trace-branches">${major.length ? `<div class="trace-majors">${major.map(trace => traceHtml(trace, false)).join('')}</div>` : ''}${minor.length ? `<div class="trace-minors">${minor.map(trace => traceHtml(trace, false)).join('')}</div>` : ''}</div><div class="trace-legend"><i></i>已激活 <i class="dim"></i>未激活</div>`
}

function characterHtml(character: PanelCharacter) {
  const stats = character.stats.length
    ? character.stats.map(item => `<div class="stat">${character.statsIcon?.[item.name] ? image(character.statsIcon[item.name], 'stat-icon') : ''}<span>${escape(item.name)}</span><b>${escape(item.value || '-')}</b></div>`).join('')
    : '<div class="muted">接口未返回角色属性</div>'
  const statDetails = character.statDetails?.length
    ? `<div class="stat-details">${character.statDetails.map(item => `<div class="stat-detail"><span>${escape(item.field)}</span><span>基础 ${escape(item.base)}</span><span>加成 ${escape(item.added)}</span><b>${escape(item.display || item.total)}</b></div>`).join('')}</div>`
    : ''
  const traces = tracesHtml(character.traces)
  const relics = character.relics.length
    ? character.relics.slice(0, 6).map(relicCard).join('')
    : '<div class="muted">接口未返回遗器数据</div>'
  const cone = character.lightCone
    ? `<div class="equipment">${image(character.lightCone.icon, 'equipment-icon')}<div><strong>${escape(character.lightCone.name)}</strong><small>${character.lightCone.level ? `Lv.${escape(character.lightCone.level)}` : '等级未知'}${character.lightCone.rank ? ` · 叠影 ${escape(character.lightCone.rank)}` : ''}${character.lightCone.path ? ` · ${escape(character.lightCone.path)}` : ''}</small></div></div>`
    : '<div class="muted">未装备光锥</div>'
  return `<section class="character">
    <div class="hero"><div class="portrait">${image(character.image || character.icon, 'character-image')}</div><div class="hero-info"><h2>${escape(character.name)}</h2><div class="tags">${character.level ? `<span>Lv.${escape(character.level)}</span>` : ''}${character.rank !== undefined ? `<span>星魂 ${escape(character.rank)}</span>` : ''}${character.rarity ? `<span>★${escape(character.rarity)}</span>` : ''}</div><div class="element">${character.elementIcon ? image(character.elementIcon, 'type-icon') : ''}${character.pathIcon ? image(character.pathIcon, 'type-icon') : ''}${escape([character.element, character.path].filter(Boolean).join(' · ') || '属性信息未知')}</div></div></div>
    <div class="block"><h3>光锥</h3>${cone}${character.lightCone?.stats?.length ? `<div class="cone-stats">${affixList(character.lightCone.stats)}</div>` : ''}</div><div class="block trace-block"><h3>行迹</h3>${traces}</div>
    <div class="block"><h3>角色属性</h3><div class="source-note">${character.calculatedStats?.length ? '按米游社装备与行迹计算常驻属性；生命／攻击／防御＝角色与光锥白值之和×（1＋百分比加成）＋固定加成。' : '属性来自面板接口。'}</div><div class="stats">${stats}</div>${statDetails}</div>
    <div class="block"><h3>遗器</h3>${scoreHtml(character.relicScore, true)}${character.relicScore ? '<div class="source-note">评分来源：fribbels hsr-optimizer · 有效词条为加权词条数，评分为该部位理论满值的百分比。</div>' : ''}<div class="relics">${relics}</div></div>
  </section>`
}

function structuredHtml(row: PanelSnapshot, data: PanelData) {
  return `<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:24px;background:#111827;color:#f5f7fb;font-family:Arial,'Microsoft YaHei',sans-serif;width:820px}.sheet{background:linear-gradient(145deg,#1f2937,#111827);border:1px solid #46536b;border-radius:18px;padding:24px;box-shadow:0 14px 36px #0008}header{border-bottom:1px solid #53617a;padding-bottom:18px;margin-bottom:20px}h1{margin:0 0 8px;font-size:28px}h2{margin:0 0 12px;font-size:26px}h3{margin:0 0 14px;font-size:18px;color:#d9e4ff}h4{margin:14px 0 8px;color:#aebbd2;font-size:13px;font-weight:500}.meta,.muted,small{color:#aebbd2}.character{margin-bottom:28px}.hero{display:flex;gap:20px;align-items:center;margin-bottom:18px}.portrait{width:220px;height:220px;border-radius:14px;overflow:hidden;background:#29354a;border:1px solid #7384a7}.character-image{width:100%;height:100%;object-fit:cover}.placeholder{display:flex;align-items:center;justify-content:center;color:#9caac2;font-size:14px}.hero-info{flex:1}.tags{display:flex;gap:8px;flex-wrap:wrap}.tags span{padding:6px 10px;border-radius:999px;background:#3b4964;color:#e9efff}.element{margin-top:16px;color:#b9c8e5}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.block{background:#1b2537;border:1px solid #3a4862;border-radius:12px;padding:16px;margin-top:16px}.source-note{margin:-4px 0 12px;color:#aebbd2;font-size:12px}.equipment{display:flex;gap:12px;align-items:center}.equipment-icon,.relic-icon,.trace-icon{object-fit:cover;background:#2c3951;border-radius:8px}.equipment-icon{width:58px;height:58px}.relic-icon{width:48px;height:48px}.trace-icon{width:32px;height:32px}.stat-icon{width:18px;height:18px;object-fit:contain;flex:none}.type-icon{width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:4px}.equipment strong,.relic-head strong{display:block}.equipment small,.relic-head small{display:block;margin-top:7px}.cone-stats{display:grid;gap:5px;margin-top:10px}.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat,.trace,.affix{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#263149;border-radius:8px}.stat span,.affix span,.trace span{flex:1}.stat b,.affix b,.trace b{color:#f5d78b}.stat-details{display:grid;gap:6px;margin-top:12px}.stat-detail{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;padding:7px 9px;background:#263149;border-radius:6px;color:#aebbd2;font-size:12px}.stat-detail b{color:#f5d78b}.traces{display:grid;gap:8px}.trace{padding:6px 8px}.trace em{font-style:normal;color:#9fb0cf;font-size:12px}.trace.active em{color:#9fe3b1}.relics{display:grid;grid-template-columns:1fr 1fr;gap:12px}.relic{background:#263149;border-radius:10px;padding:12px}.relic-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.main-affix{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #43516b;border-bottom:1px solid #43516b}.main-affix span{flex:1}.main-affix b{color:#f5d78b}.sub-affixes{display:grid;gap:5px;margin-top:8px}.affix{padding:5px 7px;font-size:13px}.affix em{font-style:normal;color:#9fb0cf;font-size:12px}.muted{padding:10px 0}.footer{margin-top:20px;color:#9eabc0;font-size:13px;text-align:right}
  .trace-block{background:radial-gradient(ellipse at 50% 0,#34405a88,transparent 75%),#192235}.trace-skills{display:flex;justify-content:space-around;gap:12px;padding:4px 0 18px;border-bottom:1px solid #43516b}.trace-node{text-align:center;min-width:0}.trace-main{flex:1;max-width:104px}.trace-medallion{position:relative;width:64px;height:64px;margin:0 auto 8px;border:2px solid #a69569;border-radius:50%;background:radial-gradient(circle,#625132,#201e24 76%);box-shadow:inset 0 0 0 4px #242431,0 0 0 1px #bcad7544;display:flex;align-items:center;justify-content:center}.trace-art{width:86%;height:86%;object-fit:contain;border-radius:50%;font-size:10px}.trace-level{position:absolute;right:-5px;bottom:-3px;min-width:25px;height:25px;line-height:25px;border-radius:50%;background:#343944;color:white;font-size:15px;box-shadow:0 0 0 2px #192235}.trace-label{display:block;color:#e7dfcb;font-size:13px;margin-bottom:5px;font-weight:500}.trace-name{display:block;color:#bfc8d9;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.trace-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.trace-branches{display:flex;gap:20px;align-items:flex-start;margin-top:16px}.trace-majors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;flex:0 0 38%}.trace-major .trace-medallion{width:54px;height:54px}.trace-minors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 8px;flex:1}.trace-minor .trace-medallion{width:34px;height:34px;margin-bottom:5px}.trace-minor .trace-name{font-size:10px}.trace-node.is-inactive .trace-medallion{filter:grayscale(1) brightness(.45);opacity:.65;box-shadow:none}.trace-node.is-inactive .trace-name{color:#626e83}.trace-legend{display:flex;align-items:center;justify-content:flex-end;gap:7px;color:#8d9bb4;font-size:10px;margin-top:12px}.trace-legend i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e7d49e}.trace-legend i.dim{background:#4d5668}
  .trace-block{--trace-active:#e7d49e;--trace-inactive:#4d5668}.trace-node.is-active .trace-medallion{border-color:var(--trace-active);background:#4a412e;box-shadow:0 0 0 2px #e7d49e33,inset 0 0 0 2px #e7d49e44}.trace-node.is-active .trace-art{filter:sepia(1) saturate(1.3);opacity:1}.trace-node.is-inactive .trace-medallion{border-color:var(--trace-inactive);background:#303848;filter:none;opacity:1;box-shadow:none}.trace-node.is-inactive .trace-art{filter:grayscale(1) brightness(.5);opacity:.5}.trace-legend i{background:var(--trace-active)}.trace-legend i.dim{background:var(--trace-inactive)}.trace-medallion:after{content:'';position:absolute;right:-2px;top:-2px;width:7px;height:7px;border-radius:50%;background:var(--trace-active);box-shadow:0 0 0 2px #192235}.trace-node.is-inactive .trace-medallion:after{background:var(--trace-inactive)}.relic-score{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 0;color:#bfc8d9;border-top:1px solid #43516b;margin-top:10px}.relic-score b{margin-left:auto;color:#f5d78b;font-size:18px}.relic-score em{font-style:normal;font-size:13px;padding:3px 7px;border-radius:5px;background:#4a412e}.relic-score small{flex-basis:100%;font-size:11px}.score-note{color:#aebbd2;font-size:12px;margin:8px 0 12px}.score-note small{display:block;font-size:10px;margin-top:4px;overflow-wrap:anywhere}
  </style></head><body><div class="sheet"><header><h1>${escape(row.title)}</h1><div class="meta">${escape(data.game.toUpperCase())} · UID ${escape(data.uid)} · ${escape(data.server)}</div></header>${data.characters.map(characterHtml).join('')}<div class="footer">更新时间：${escape(row.updatedAt)}</div></div></body></html>`
}

function renderHtml(ctx: Context, html: string) {
  if (!ctx.puppeteer) throw new Error('需要启用 Koishi puppeteer 服务。')
  return ctx.puppeteer.render(html, async (page, next) => {
    try {
    const failures = await page.evaluate(async () => {
      const images = Array.from(document.images)
      await Promise.all(images.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); resolve() }
          const timer = setTimeout(done, 15000)
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
        })))
      return images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src)
    })
    if (failures.length) throw new Error(`截图图片加载失败：${failures.join('、')}`)
    const body = await page.$('body')
    if (!body) throw new Error('截图结构化渲染失败：未找到 body。')
    return next(body)
    } catch (error) {
      await page.close().catch(() => {})
      throw error
    }
  })
}

function renderAccountHtml(ctx: Context, html: string, selector: string) {
  if (!ctx.puppeteer) throw new Error('需要启用 Koishi puppeteer 服务。')
  return ctx.puppeteer.render(html, async (page, next) => {
    try {
      await page.evaluate(async () => {
        await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})))
      })
      const target = await page.$(selector)
      if (!target) throw new Error('账号概览渲染失败：未找到内容区域。')
      const buffer = await target.screenshot({ type: 'jpeg', quality: 65 })
      return h.image(buffer, 'image/jpeg').toString()
    } catch (error) {
      await page.close().catch(() => {})
      throw error
    }
  })
}

export function createPanel(ctx: Context) {
  ctx.model.extend('miyoushe_panel', {
    id: 'string', platform: 'string', userId: 'string', game: 'string', uid: 'string', title: 'string', lines: 'text', data: 'text', updatedAt: 'string',
  }, { primary: 'id' })
  return {
    async renderAccount(data: AccountOverview, userAvatar?: string) {
      const characters = data.characters.length
        ? data.characters.map(character => `<article class="character-card">${image(character.avatar, 'character-avatar')}<strong>${escape(character.name)}</strong></article>`).join('')
        : '<div class="empty">暂无角色展示数据</div>'
      const avatar = image(data.avatar || (userAvatar ? userAvatar.replace(/^http:\/\//i, 'https://') : undefined), 'account-avatar')
      const title = data.nickname === '未知' ? `${data.game === 'gs' ? '原神' : '星穹铁道'}账号` : data.nickname
      const html = `<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:14px;width:640px;background:#111827;color:#f5f7fb;font-family:Arial,'Microsoft YaHei',sans-serif}.sheet{padding:14px;border:1px solid #46536b;border-radius:12px;background:#1b2537}.account-head{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid #46536b}.account-avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;background:#263149;border:2px solid #7384a7}.account-info{min-width:0}.account-info h1{margin:0 0 4px;font-size:18px;overflow-wrap:anywhere}.account-info small{color:#aebbd2;font-size:10px}.character-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}.character-card{overflow:hidden;border:1px solid #3a4862;border-radius:7px;background:#263149;text-align:center}.character-avatar{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;background:#1b2537}.character-card strong{display:block;padding:5px 3px;font-size:10px;line-height:1.25;overflow-wrap:anywhere}.placeholder{display:flex;align-items:center;justify-content:center;color:#9caac2;font-size:10px}.empty{grid-column:1/-1;padding:20px;text-align:center;color:#aebbd2}</style></head><body><main class="sheet"><header class="account-head">${avatar}<div class="account-info"><h1>${escape(title)}</h1><small>UID ${escape(data.uid)}</small></div></header><section class="character-grid">${characters}</section></main></body></html>`
      return renderAccountHtml(ctx, html, '.sheet')
    },
    async renderRecordOverview(data: AccountOverview, userAvatar?: string) {
      const avatar = image(data.avatar || (userAvatar ? userAvatar.replace(/^http:\/\//i, 'https://') : undefined), 'account-avatar')
      const title = data.nickname === '未知' ? '开拓者' : data.nickname
      const noteData = data.stamina
      const energy = noteData?.energy && typeof noteData.energy === 'object' ? noteData.energy as Record<string, unknown> : undefined
      const current = recordValue(noteData, ['current_stamina']) || recordValue(energy, ['current']) || '暂无数据'
      const max = recordValue(noteData, ['max_stamina']) || recordValue(energy, ['max'])
      const reserve = recordValue(noteData, ['reserve_stamina']) || recordValue(noteData, ['backup_stamina']) || '0'
      const trainValue = noteData?.weekly_train_score || noteData?.current_train_score
      const train = trainValue && typeof trainValue === 'object' ? trainValue as Record<string, unknown> : undefined
      const dailyCurrent = recordValue(train, ['current']) || recordValue(noteData, ['daily_train_score'])
      const dailyMax = recordValue(train, ['max']) || recordValue(noteData, ['daily_train_score_max'])
      const weeklyCurrent = recordValue(noteData, ['weekly_cocoon_cnt', 'weekly_echo_count'])
      const weeklyLimit = recordValue(noteData, ['weekly_cocoon_cnt_max', 'weekly_echo_limit']) || '3'
      const weeklyMax = weeklyCurrent !== undefined ? weeklyLimit : undefined
      const cycleCurrent = recordValue(noteData, ['rogue_score', 'weekly_rogue_score', 'cycle_score'])
      const cycleMax = recordValue(noteData, ['rogue_score_max', 'weekly_rogue_score_max', 'cycle_score_max'])
      const value = (current: string | undefined, maximum?: string) => current ? `${current}${maximum ? `/${maximum}` : ''}` : '暂无数据'
      const daily = dailyCurrent ? `${dailyCurrent}${dailyMax ? `/${dailyMax}` : ''}` : '暂无数据'
      const weekly = weeklyCurrent ? `${weeklyCurrent}${weeklyMax ? `/${weeklyMax}` : ''}` : '暂无数据'
      const cycle = cycleCurrent ? `${cycleCurrent}${cycleMax ? `/${cycleMax}` : ''}` : '暂无数据'
      const rows = [
        dailyCurrent ? `<div class="metric"><span>每日实训</span><b>${escape(daily)}</b></div>` : '',
        weeklyCurrent ? `<div class="metric"><span>历战余响</span><b>${escape(weekly)}</b></div>` : '',
        cycleCurrent ? `<div class="metric"><span>周期积分</span><b>${escape(cycle)}</b></div>` : '',
      ].filter(Boolean).join('')
      const stamina = current !== '暂无数据' ? `<div class="stamina"><strong>${escape(value(current, max))}</strong><small>开拓力${reserve !== '0' ? ` · 备用 ${escape(reserve)}` : ''}</small></div>` : ''
      const metricContent = stamina && rows ? `${stamina}<div class="metrics">${rows}</div>` : stamina || rows
      const note = metricContent ? `<section class="note ${stamina && rows ? '' : 'single'}">${metricContent}</section>` : ''
      const challenges = challengeRows(data.challenges)
      const anomaly = anomalyCard(data.challenges?.anomaly)
      const html = `<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:0;width:800px;background:#121826;color:#f5f7fb;font-family:Arial,'Microsoft YaHei',sans-serif}.overview{display:table;overflow:hidden;border:1px solid #39465d;border-radius:10px;background:#1b2537}.hero{min-height:150px;display:flex;align-items:center;gap:22px;padding:18px 26px;background:linear-gradient(100deg,#74604b,#323d50 68%,#202b40)}.account-avatar{width:104px;height:104px;border:3px solid #e7d49e;border-radius:50%;object-fit:cover;background:#263149}.identity{min-width:0}.nickname{font-size:34px;font-weight:600;overflow-wrap:anywhere}.nickname small{font-size:18px}.details{margin-top:8px;font-size:20px;color:#e3e8f2}.details span{margin-right:16px}.note{display:grid;grid-template-columns:minmax(180px,1fr) minmax(300px,1fr);gap:0;padding:20px 24px;background:#f1f0ed;color:#282a30}.note.single{grid-template-columns:1fr}.stamina{display:flex;flex-direction:column;justify-content:center;padding:4px 24px;border-right:1px dotted #aeb1b8}.note.single .stamina{border-right:0}.stamina strong{font-size:30px;color:#bd8732}.stamina small{margin-top:8px;color:#727780;font-size:15px}.metric{display:flex;justify-content:space-between;align-items:center;padding:13px 22px;border-bottom:1px solid #d8d8d6;font-size:19px}.metric b{font-size:22px}.metric:last-child{border-bottom:0}.challenge-list{padding:18px 24px 8px;background:#f1f0ed;color:#282a30;border-top:1px solid #d8d8d6}.challenge-list h2{margin:0 0 8px;font-size:21px}.challenge-row{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #d8d8d6}.challenge-row:last-child{border-bottom:0}.challenge-row strong{font-size:18px}.challenge-floor{font-size:17px;overflow-wrap:anywhere}.challenge-result{display:flex;flex-direction:column;align-items:flex-end;gap:3px}.stars{color:#d39a2d;font-size:23px;letter-spacing:2px;white-space:nowrap}.stars small{color:#737780;font-size:13px;letter-spacing:0}.extra-star{color:#9a7cff;font-style:normal;font-size:25px;margin-left:4px}.anomaly-card{margin:0;padding:18px 24px 20px;background:#f1f0ed;color:#282a30;border-top:1px solid #d8d8d6}.anomaly-row{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #d8d8d6}.anomaly-row strong{font-size:18px}.anomaly-season{font-size:17px}.anomaly-extra{font-size:14px;color:#737780}.anomaly-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.anomaly-grid>div{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 10px;padding:12px 14px;background:#e7e5e2;border:1px solid #d0ceca;border-radius:8px}.anomaly-grid label{grid-column:1/-1;color:#737780;font-size:14px}.anomaly-grid strong{font-size:17px;overflow-wrap:anywhere}.anomaly-grid .stars{grid-column:1/-1}.mob-total{grid-column:1/-1;color:#bd8732;font-size:20px;font-weight:600}</style></head><body><main class="overview"><header class="hero">${avatar}<div class="identity"><div class="nickname">${escape(title)}${data.level ? ` <small>Lv.${escape(data.level)}</small>` : ''}</div><div class="details"><span>${escape(serverName(data.server))}</span> UID ${escape(data.uid)}</div></div></header>${note}${challenges}${anomaly}</main></body></html>`
      return renderAccountHtml(ctx, html, '.overview')
    },
    async save(role: GameRole, title: string, summary: string, data?: PanelData) {
      const lines = summary.split('\n').slice(0, 30).map(line => line.slice(0, 120))
      const row: PanelSnapshot = { id: role.id, platform: role.platform, userId: role.userId, game: role.game, uid: role.uid, title: title.slice(0, 80), lines: JSON.stringify(lines), data: data ? JSON.stringify(data) : undefined, updatedAt: new Date().toISOString() }
      await ctx.database.upsert('miyoushe_panel', [row])
      return row
    },
    async get(platform: string, userId: string, role: GameRole) {
      const [row] = await ctx.database.get('miyoushe_panel', { id: role.id, platform, userId })
      return row
    },
    async remove(platform: string, userId: string, roles: GameRole[]) {
      for (const role of roles) await ctx.database.remove('miyoushe_panel', { id: role.id, platform, userId })
    },
    async render(row: PanelSnapshot) {
      if (!ctx.puppeteer) throw new Error('需要启用 Koishi puppeteer 服务。')
      if (row.data) {
        const data = JSON.parse(row.data) as PanelData
        return renderHtml(ctx, structuredHtml(row, data))
      }
      const lines = (JSON.parse(row.lines) as string[]).map(line => `<li>${escape(line)}</li>`).join('')
      const html = `<html><head><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#f5f7f8;color:#18252c;font-family:Arial,'Microsoft YaHei',sans-serif;width:680px;box-sizing:border-box}.sheet{background:white;border:1px solid #d9e0e4;padding:28px;border-radius:6px}h1{font-size:25px;margin:0 0 8px}header{border-bottom:2px solid #378e79;padding-bottom:18px}small{color:#53646d;font-size:14px}ul{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}li{border-bottom:1px solid #e8edef;padding:8px 0;font-size:15px;overflow-wrap:anywhere}</style></head><body><div class="sheet"><header><h1>${escape(row.title)}</h1><small>${escape(row.game.toUpperCase())} · UID ${escape(row.uid)} · ${escape(row.updatedAt)}</small></header><ul>${lines}</ul></div></body></html>`
      return renderHtml(ctx, html)
    },
  }
}

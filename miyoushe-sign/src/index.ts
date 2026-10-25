import { Context, Schema, Session } from 'koishi'
import { randomBytes, randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { createAccounts, GameRole, parseCookie } from './accounts'
import { createClient, forums, games, Forum, Game } from './client'
import { createRecords, PanelData, recordTypes } from './records'
import { createVault } from './vault'
import { createPanel } from './panel'
import { runAutoPassport } from './automation'
import { createStaticCache } from './data-cache'

export const name = 'miyoushe-sign'
export const inject = ['database', 'http', 'puppeteer']

export interface Config {
  encryptionKey?: string
  accounts: ConfigAccount[]
  timeout: number
  interval: number
  hour: number
}

export interface ConfigAccount {
  platform: string
  userId: string
  ltuid: string
  cookie?: string
  stoken?: string
}

const ConfigAccount: Schema<ConfigAccount> = Schema.object({
  platform: Schema.string().default('onebot'),
  userId: Schema.string().description('接收签到结果的用户 ID。'),
  ltuid: Schema.string().description('米哈游通行证 ID。'),
  cookie: Schema.string().role('secret').description('游戏 CK，建议填写完整 Cookie。'),
  stoken: Schema.string().role('secret').description('社区 SToken Cookie，需包含 stuid/stoken/ltoken。'),
})

export const Config: Schema<Config> = Schema.object({
  encryptionKey: Schema.string().role('secret').description('凭证加密密钥，需为 32 字节随机密钥的 Base64；留空则仅本次运行随机生成。').default(process.env.MIYOUSHE_SIGN_KEY || ''),
  accounts: Schema.array(ConfigAccount).default([]).description('启动时导入的米游社账号凭证。'),
  timeout: Schema.natural().role('ms').default(12000),
  interval: Schema.natural().role('ms').min(2000).default(3000),
  hour: Schema.number().min(0).max(23).step(1).default(9),
})

const forumNames = Object.keys(forums) as Forum[]
const gameNames = Object.keys(games) as Game[]
const passportId = /^\d{1,20}$/

async function renderQr(ctx: Context, url: string) {
  if (!ctx.puppeteer) return url
  const escaped = url.replace(/[&<>"]/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[value]!)
  const image = await QRCode.toDataURL(url, { width: 360, margin: 0 })
  const html = `<html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f5f7f8;font-family:Arial,'Microsoft YaHei',sans-serif;width:520px;box-sizing:border-box}.card{background:#fff;border:1px solid #d9e0e4;border-radius:12px;padding:24px;text-align:center}.title{font-size:22px;font-weight:700;color:#18252c;margin-bottom:16px}.qr{display:inline-block;padding:18px;background:#fff;border:1px solid #e4e9ec;border-radius:8px}.qr img{display:block;width:360px;height:360px}.url{margin-top:16px;color:#53646d;font-size:12px;line-height:1.5;overflow-wrap:anywhere}</style></head><body><div class="card"><div class="title">米游社扫码登录</div><div class="qr"><img src="${image}"></div><div class="url">${escaped}</div></div></body></html>`
  return ctx.puppeteer.render(html, async (page, next) => {
    return next(await page.$('body'))
  })
}

function identity(session: Session) {
  return session.isDirect && session.platform && session.userId ? [session.platform, session.userId] as const : undefined
}

function day() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const part = (name: string) => parts.find(item => item.type === name)?.value || ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) }
}

export function apply(ctx: Context, config: Config) {
  const key = config.encryptionKey ? (() => {
    if (Buffer.from(config.encryptionKey, 'base64').length !== 32) throw new Error('encryptionKey 必须是 32 字节随机密钥的 Base64。')
    return config.encryptionKey
  })() : randomBytes(32).toString('base64')
  const accounts = createAccounts(ctx, key)
  const legacy = createVault(ctx, key)
  const client = createClient(ctx, config.timeout, config.interval)
  const cache = createStaticCache(ctx)
  const records = createRecords(client, cache)
  const panel = createPanel(ctx)
  const running = new Set<string>()
  const attempted = new Map<string, { date: string; count: number }>()
  const autoRunning = new Set<string>()
  const communityRunning = new Set<string>()
  const qrRunning = new Set<string>()

  function panelSummary(data: PanelData) {
    return data.characters.map(character => [
      `角色：${character.name}`,
      character.level ? `等级：${character.level}` : '',
      character.rank ? `星魂：${character.rank}` : '',
      character.lightCone ? `光锥：${character.lightCone.name}${character.lightCone.level ? ` Lv.${character.lightCone.level}` : ''}` : '',
      ...character.stats.slice(0, 12).map(item => `${item.name}：${item.value || '-'}`),
      ...character.relics.slice(0, 6).map(item => `${item.slot}：${item.name}${item.level ? ` +${item.level}` : ''}`),
    ].filter(Boolean).join('\n')).join('\n\n')
  }

  ctx.on('ready', async () => {
    for (const item of config.accounts || []) {
      if (!item.userId || !/^\d{1,20}$/.test(item.ltuid) || !item.cookie && !item.stoken) {
        ctx.logger.warn('米游社配置账号缺少有效的 userId、ltuid 或凭证，已跳过。')
        continue
      }
      try {
        let ltuid = item.ltuid
        if (item.cookie) {
          const parsed = parseCookie(item.cookie, 'ck')
          if (parsed.ltuid !== ltuid) throw new Error('Cookie 中的通行证 ID 与配置不一致。')
          const roles = await client.discover(parsed.cookie)
          if (!roles.length) throw new Error('Cookie 未查询到游戏角色。')
          await accounts.save(item.platform, item.userId, ltuid, parsed.cookie, roles)
        }
        if (item.stoken) {
          const parsed = parseCookie(item.stoken, 'stoken')
          if (parsed.ltuid !== ltuid) throw new Error('SToken 中的通行证 ID 与配置不一致。')
          await accounts.saveToken(item.platform, item.userId, ltuid, parsed.cookie)
        }
        ctx.logger.info(`米游社配置账号 ${item.platform}:${item.userId}/${ltuid} 已导入。`)
      } catch (error) {
        ctx.logger.warn(`米游社配置账号 ${item.platform}:${item.userId}/${item.ltuid} 导入失败：${error instanceof Error ? error.message : '凭证无效'}。`)
      }
    }
  })

  async function refreshDevice(platform: string, userId: string, ltuid: string, region: string) {
    const row = await accounts.passport(platform, userId, ltuid)
    if (!row) return undefined
    return accounts.device(platform, userId, ltuid, async device => {
      const current = device || { deviceId: randomUUID().replace(/-/g, ''), deviceFp: '' }
      if (current.deviceFp && row.fpExpires && Number(row.fpExpires) > Date.now()) return current
      try {
        const fp = await accounts.use(platform, userId, ltuid, 'ck', cookie => client.fingerprint(current.deviceId, !(region.startsWith('cn_') || region.endsWith('_cn')), cookie))
        const updated = { deviceId: current.deviceId, deviceFp: fp }
        await accounts.saveFingerprint(platform, userId, ltuid, updated)
        if (process.env.MIYOUSHE_DEBUG_RECORD === '1') ctx.logger.info(`[record-debug] fingerprint refreshed region=${region} fp=present`)
        return updated
      } catch (error) {
        if (process.env.MIYOUSHE_DEBUG_RECORD === '1') ctx.logger.warn(`[record-debug] fingerprint refresh failed region=${region}`)
        throw new Error(`设备指纹刷新失败：${error instanceof Error ? error.message : '请重新绑定 Cookie 后重试。'}`)
      }
    })
  }

  async function signRole(role: GameRole) {
    if (running.has(role.id)) return { text: `${role.game} ${role.uid}：正在签到。`, retry: false }
    running.add(role.id)
    try {
      const result = await accounts.use(role.platform, role.userId, role.ltuid, 'ck', async cookie =>
        client.game(role, cookie, role.game as Game, await refreshDevice(role.platform, role.userId, role.ltuid, role.region)))
      if (result.done) await accounts.mark(role, day().date)
      return { text: `${role.game} ${role.uid}：${result.text}`, retry: false }
    } catch {
      return { text: `${role.game} ${role.uid}：请求失败，请检查凭证或网络。`, retry: true }
    } finally {
      running.delete(role.id)
    }
  }

  async function signCommunity(platform: string, userId: string, ltuid: string, all: boolean) {
    try {
      return await accounts.use(platform, userId, ltuid, 'stoken', (token) =>
        accounts.device(platform, userId, ltuid, async device => {
          const output: string[] = []
          for (const forum of all ? forumNames : ['gs'] as Forum[]) {
            try {
              output.push((await client.forum(token, forum, device)).text)
            } catch {
              output.push(`${forum}社区：请求失败。`)
            }
          }
          return output.join('\n')
        }))
    } catch {
      return '社区签到失败，请检查 SToken 或网络。'
    }
  }

  ctx.command('mys.bind <credential:text>', '私聊绑定通行证 Cookie 并自动发现游戏角色').action(async ({ session }, credential) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅允许在私聊中绑定凭证。'
    try {
      const { ltuid, cookie } = parseCookie(credential || '', 'ck')
      const roles = await client.discover(cookie)
      if (!roles.length) return 'Cookie 无效或未查询到已绑定的游戏角色，未保存。'
      await accounts.save(...owner, ltuid, cookie, roles)
      return `通行证 ${ltuid} 已绑定：${roles.map(role => `${role.game} ${role.uid}`).join('、')}。请删除原始私聊消息。`
    } catch {
      return '绑定失败：请检查完整 Cookie、数字通行证 ID 及网络。'
    }
  })

  ctx.command('mys.qr', '私聊扫码登录并绑定通行证').action(async ({ session }) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅支持私聊扫码登录。'
    const ownerKey = `${owner[0]}:${owner[1]}`
    if (qrRunning.has(ownerKey)) return '已有扫码正在等待确认。'
    qrRunning.add(ownerKey)
    try {
      const { url, ticket } = await client.qrCreate()
      const qrMessage = await renderQr(ctx, url)
      await session.send(`${qrMessage}\n请用米游社官方客户端扫描并确认，二维码约 100 秒后失效。`)
      let scanned = false
      for (let count = 0; count < 19; count++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        const result = await client.qrStatus(ticket)
        if (result.retcode !== 0) {
          ctx.logger.warn(`扫码状态查询失败：retcode=${result.retcode} message=${result.message || '-'}`)
          return `扫码状态查询失败（${result.retcode}）：${result.message || '请重新发起。'}`
        }
        if (result.data?.status === 'Scanned') {
          if (!scanned) await session.send('二维码已扫描，请在米游社手机客户端确认登录。')
          scanned = true
          continue
        }
        if (result.data?.status !== 'Confirmed') continue
        const tokens = result.data.tokens
        const info = result.data.user_info
        const stoken = Array.isArray(tokens) && typeof tokens[0]?.token === 'string' ? tokens[0].token : undefined
        const ltuid = info && typeof info === 'object' ? String((info as Record<string, unknown>).aid || '') : ''
        const mid = info && typeof info === 'object' ? String((info as Record<string, unknown>).mid || '') : ''
        if (!stoken || !/^\d{1,20}$/.test(ltuid) || !mid) return '扫码返回的账号信息不完整，未保存。'
        const ltoken = await client.qrExchange(stoken, mid)
        const token = `stuid=${ltuid};stoken=${stoken};mid=${mid};ltoken=${ltoken};`
        const cookie = await client.exchangeCookie(token, ltuid)
        const roles = await client.discover(cookie)
        if (!roles.length) return '已确认扫码，但未查询到游戏角色，未保存凭证。'
        await accounts.save(...owner, ltuid, cookie, roles)
        await accounts.saveToken(...owner, ltuid, token)
        return `通行证 ${ltuid} 已绑定：${roles.map(role => `${role.game} ${role.uid}`).join('、')}。`
      }
      return '扫码超时，请重新发起。'
    } catch (error) {
      ctx.logger.warn(`扫码登录失败：${error instanceof Error ? error.message : '未知错误'}`)
      return `扫码登录失败：${error instanceof Error ? error.message : '请检查平台账号状态后重试。'}`
    } finally {
      qrRunning.delete(ownerKey)
    }
  })

  ctx.command('mys.refresh <ltuid:string>', '使用已绑定 SToken 刷新游戏 CK').action(async ({ session }, ltuid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '')) return '用法：私聊 mys.refresh 通行证ID。'
    try {
      const roles = (await accounts.roles(...owner)).filter(role => role.ltuid === ltuid)
      const biz = roles.some(role => role.region.startsWith('cn_') || role.region.endsWith('_cn')) ? 'hk4e_cn' : 'hk4e_global'
      const cookie = await accounts.use(...owner, ltuid, 'stoken', token => client.exchangeCookie(token, ltuid, biz))
      const discovered = await client.discover(cookie)
      if (!discovered.length) return '新 CK 未通过角色验证，旧 CK 保持不变。'
      await accounts.save(...owner, ltuid, cookie, discovered)
      return `通行证 ${ltuid} 的 CK 已刷新，角色列表已同步。`
    } catch {
      return '刷新失败，原 CK 保持不变；请检查 SToken 是否有效。'
    }
  })

  ctx.command('mys.device.fp <ltuid:string>', '获取并保存通行证设备指纹').action(async ({ session }, ltuid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '')) return '用法：私聊 mys.device.fp 通行证ID。'
    try {
      const roles = (await accounts.roles(...owner)).filter(role => role.ltuid === ltuid)
      const device = await accounts.device(...owner, ltuid, async current => {
        const deviceId = current?.deviceId || randomUUID().replace(/-/g, '')
        const overseas = roles.length ? !(roles[0].region.startsWith('cn_') || roles[0].region.endsWith('_cn')) : false
        const fp = await accounts.use(...owner, ltuid, 'ck', cookie => client.fingerprint(deviceId, overseas, cookie))
        const next = { deviceId, deviceFp: fp }
        await accounts.saveFingerprint(...owner, ltuid, next)
        return next
      })
      return device ? '设备指纹已加密保存并关联到该通行证。' : '获取设备指纹失败。'
    } catch {
      return '设备指纹获取失败，原设备资料保持不变。'
    }
  })

  ctx.command('mys.token <credential:text>', '私聊绑定通行证 SToken').action(async ({ session }, credential) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅允许在私聊中绑定凭证。'
    try {
      const { ltuid, cookie } = parseCookie(credential || '', 'stoken')
      await accounts.saveToken(...owner, ltuid, cookie)
      return `通行证 ${ltuid} 的社区凭证已加密保存。请删除原始私聊消息。`
    } catch {
      return 'SToken 格式无效；需包含 stuid、stoken、ltoken。'
    }
  })

  ctx.command('mys.accounts', '查看已绑定通行证及游戏角色').action(async ({ session }) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅支持私聊。'
    const passports = await accounts.passports(...owner)
    const roles = await accounts.roles(...owner)
    return passports.length ? passports.map(row => `${row.ltuid}（游戏自动${row.enabled ? '开启' : '关闭'} / 米游币定时${row.communityEnabled ? '开启' : '关闭'} / 跟随游戏${row.followMissions ? '开启' : '关闭'}）\n${roles.filter(role => role.ltuid === row.ltuid).map(role => `  ${role.game} ${role.uid} ${role.region}${role.current ? ' 当前' : ''}`).join('\n')}`).join('\n') : '尚未绑定通行证。'
  })

  ctx.command('mys.uid <game:string> <uid:string>', '切换当前游戏 UID').action(async ({ session }, game, uid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !gameNames.includes(game as Game) || !passportId.test(uid || '')) return '用法：私聊 mys.uid 游戏代号 UID。'
    return await accounts.choose(...owner, game, uid) ? `${game} 当前 UID 已切换为 ${uid}。` : '该 UID 不属于你已绑定的通行证。'
  })

  ctx.command('mys.remove <ltuid:string>', '删除通行证及其游戏角色').action(async ({ session }, ltuid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '')) return '用法：私聊 mys.remove 通行证ID。'
    const roles = (await accounts.roles(...owner)).filter(role => role.ltuid === ltuid)
    if (!await accounts.remove(...owner, ltuid)) return '未找到游戏 CK。'
    await panel.remove(...owner, roles)
    return '游戏 CK、设备、角色及面板快照已删除；独立绑定的 SToken 不受影响。'
  })

  ctx.command('mys.token.remove <ltuid:string>', '删除通行证的社区 SToken').action(async ({ session }, ltuid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '')) return '用法：私聊 mys.token.remove 通行证ID。'
    return await accounts.removeToken(...owner, ltuid) ? 'SToken 已删除，游戏 CK 不受影响。' : '未找到该 SToken。'
  })

  ctx.command('mys.auto <ltuid:string> <state:string>', '启停当前通行证游戏自动签到').action(async ({ session }, ltuid, state) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '') || !['on', 'off'].includes(state)) return '用法：私聊 mys.auto 通行证ID on|off。'
    return await accounts.setEnabled(...owner, ltuid, state === 'on') ? '自动签到设置已更新。' : '未找到该通行证。'
  })

  ctx.command('mys.community.auto <ltuid:string> <state:string>', '启停独立定时社区签到').action(async ({ session }, ltuid, state) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '') || !['on', 'off'].includes(state)) return '用法：私聊 mys.community.auto 通行证ID on|off。'
    return await accounts.setCommunityEnabled(...owner, ltuid, state === 'on') ? `社区独立定时签到已${state === 'on' ? '开启，跟随模式已关闭' : '关闭'}。` : '未找到该通行证的 SToken。'
  })

  ctx.command('mys.community.follow <ltuid:string> <state:string>', '启停跟随游戏签到的社区签到').action(async ({ session }, ltuid, state) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '') || !['on', 'off'].includes(state)) return '用法：私聊 mys.community.follow 通行证ID on|off。'
    return await accounts.setFollowMissions(...owner, ltuid, state === 'on') ? `跟随游戏的社区签到已${state === 'on' ? '开启，独立定时已关闭' : '关闭'}。` : '未找到该通行证的 SToken。'
  })

  ctx.command('mys.device.bind <ltuid:string> <deviceId:string> <deviceFp:string>', '绑定当前通行证的设备资料').action(async ({ session }, ltuid, deviceId, deviceFp) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '') || !/^[a-zA-Z0-9_-]{8,128}$/.test(deviceId || '') || !/^[a-zA-Z0-9_-]{8,128}$/.test(deviceFp || '')) return '用法：私聊 mys.device.bind 通行证ID 设备ID 设备指纹。'
    return await accounts.setDevice(...owner, ltuid, { deviceId, deviceFp }) ? '设备资料已加密绑定到通行证，供所属角色请求复用。请删除原始消息。' : '未找到该通行证。'
  })

  ctx.command('mys.device.remove <ltuid:string>', '删除通行证的设备资料').action(async ({ session }, ltuid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !passportId.test(ltuid || '')) return '用法：私聊 mys.device.remove 通行证ID。'
    return await accounts.setDevice(...owner, ltuid) ? '本地设备资料已删除。' : '未找到该通行证。'
  })

  ctx.command('mys.sign [game:string]', '为自己的所有游戏角色签到，可限定游戏').action(async ({ session }, game) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅支持私聊。'
    if (game && !gameNames.includes(game as Game)) return `游戏代号：${gameNames.join('、')}。`
    const roles = (await accounts.roles(...owner)).filter(role => !game || role.game === game)
    if (!roles.length) return '没有已绑定的游戏角色。'
    const output: string[] = []
    for (const role of roles) output.push((await signRole(role)).text)
    return output.join('\n')
  })

  ctx.command('mys.community [forum:string]', '社区签到，默认原神分区').action(async ({ session }, forum) => {
    if (!session) return
    const owner = identity(session)
    if (!owner) return '仅支持私聊。'
    const passports = (await accounts.passports(...owner)).filter(row => row.stoken)
    if (!passports.length) return '尚未绑定 SToken。'
    if (forum && forum !== 'all' && !Object.hasOwn(forums, forum)) return `社区代号：${forumNames.join('、')}、all。`
    const output: string[] = []
    for (const row of passports) {
      try {
        if (forum && forum !== 'all') {
          output.push(await accounts.use(...owner, row.ltuid, 'stoken', secret => accounts.device(...owner, row.ltuid, device => client.forum(secret, forum as Forum, device).then(result => result.text))))
        } else output.push(await signCommunity(...owner, row.ltuid, forum === 'all'))
      } catch {
        output.push(`通行证 ${row.ltuid}：社区签到失败，请检查官方客户端账号状态。`)
      }
    }
    return output.join('\n')
  })

  ctx.command('mys.record <game:string> <type:string> [uid:string] [period:string]', '查询当前游戏 UID 的记录').action(async ({ session }, game, type, uid, period) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !(game in recordTypes) || !type || !['1', '2', '3', undefined].includes(period)) return '用法：私聊 mys.record 游戏代号 类型 [UID] [1|2|3]。'
    const roles = (await accounts.roles(...owner)).filter(role => role.game === game)
    if (['1', '2', '3'].includes(uid || '') && !period) {
      period = uid
      uid = undefined
    }
    const role = uid ? roles.find(role => role.uid === uid) : roles.find(role => role.current)
    if (!role) return '没有此游戏的当前 UID 或指定 UID 未绑定。'
    if (!Object.hasOwn(recordTypes[game as keyof typeof recordTypes], type)) return `可用类型：${Object.keys(recordTypes[game as keyof typeof recordTypes]).join('、')}。`
    try {
      const summary = await accounts.use(...owner, role.ltuid, 'ck', async cookie => records.query(role, cookie, type, period === '2' ? 2 : period === '3' ? 3 : 1, await refreshDevice(...owner, role.ltuid, role.region)))
      if (type !== 'panel' || /失败|无法|未能|没有|不支持/.test(summary)) return summary
      const structured = await accounts.use(...owner, role.ltuid, 'ck', async cookie => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region)))
      if (typeof structured === 'string') return structured
      const snapshot = await panel.save(role, `${game === 'gs' ? '原神' : '星穹铁道'}角色面板`, panelSummary(structured), structured)
      try {
        return await panel.render(snapshot)
      } catch {
        return `${summary}\n面板快照已保存，但 Puppeteer 渲染不可用。`
      }
    } catch (error) {
      return `记录查询失败：${error instanceof Error ? error.message : '请检查凭证、网络与数据公开权限。'}`
    }
  })

  ctx.command('mys.character <game:string> <character:text> [uid:string]', '查询指定角色的详细面板').action(async ({ session }, game, character, uid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !['gs', 'sr'].includes(game) || !character?.trim()) return '用法：私聊 mys.character gs|sr 角色名 [UID]。'
    const roles = (await accounts.roles(...owner)).filter(role => role.game === game)
    const role = uid ? roles.find(item => item.uid === uid) : roles.find(item => item.current)
    if (!role) return '没有此游戏的当前 UID 或指定 UID 未绑定。'
    try {
      const structured = await accounts.use(...owner, role.ltuid, 'ck', async cookie => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region), character.trim()))
      if (typeof structured === 'string') return structured
      const snapshot = await panel.save(role, `${game === 'gs' ? '原神' : '星穹铁道'} ${character.trim()} 角色面板`, panelSummary(structured), structured)
      return await panel.render(snapshot)
    } catch (error) {
      return `角色面板查询失败：${error instanceof Error ? error.message : '请检查凭证、网络与数据公开权限。'}`
    }
  })

  ctx.command('mys.panel <game:string> [uid:string]', '查看已保存的图片面板').action(async ({ session }, game, uid) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !['gs', 'sr'].includes(game)) return '用法：私聊 mys.panel gs|sr [UID]。'
    const roles = (await accounts.roles(...owner)).filter(role => role.game === game)
    const role = uid ? roles.find(role => role.uid === uid) : roles.find(role => role.current)
    if (!role) return '没有已绑定的游戏角色。'
    try {
      let snapshot = await panel.get(...owner, role)
      if (!snapshot) {
        const structured = await accounts.use(...owner, role.ltuid, 'ck', async cookie => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region)))
        if (typeof structured === 'string') return structured
        snapshot = await panel.save(role, `${game === 'gs' ? '原神' : '星穹铁道'}角色面板`, panelSummary(structured), structured)
      }
      return await panel.render(snapshot)
    } catch (error) {
      return `首次查询或面板渲染失败：${error instanceof Error ? error.message : '请检查凭证、网络、数据公开权限及 Puppeteer 服务。'}`
    }
  })

  ctx.command('mys.migrate <slot:string>', '显式迁移旧版槽位凭证').action(async ({ session }, slot) => {
    if (!session) return
    const owner = identity(session)
    if (!owner || !/^[a-zA-Z0-9_-]{1,32}$/.test(slot || '')) return '用法：私聊 mys.migrate 旧槽位。'
    try {
      return await legacy.use(...owner, slot, async (cookie, row) => {
        if (row.kind === 'community') return '旧社区槽位不能自动确认通行证，请使用 mys.token 重新绑定。'
        const { ltuid } = parseCookie(cookie, 'ck')
        const roles = await client.discover(cookie)
        if (!roles.some(role => role.game === row.kind && role.uid === row.uid && role.region === row.region)) return '旧槽位与官方角色列表不符，未迁移。'
        await accounts.save(...owner, ltuid, cookie, roles)
        await legacy.useDevice(...owner, slot, async device => {
          if (device) await accounts.setDevice(...owner, ltuid, device)
        })
        return `已迁移通行证 ${ltuid}；旧槽位仍保留，检查后可手动清理。`
      })
    } catch {
      return '迁移失败：旧凭证不可读、无效或尚未绑定。'
    }
  })

  ctx.setInterval(async () => {
    const now = day()
    if (now.hour < config.hour) return
    try {
      for (const passport of await accounts.all()) {
        if (passport.enabled && passport.cookie) {
          const roles = (await accounts.roles(passport.platform, passport.userId)).filter(role => role.ltuid === passport.ltuid)
          await runAutoPassport(passport, roles, now.date, accounts, attempted, autoRunning, signRole, async role => {
            try {
              await accounts.use(passport.platform, passport.userId, passport.ltuid, 'stoken', token => accounts.device(passport.platform, passport.userId, passport.ltuid, device => client.forum(token, role.game as Forum, device)))
            } catch {
              ctx.logger.warn('跟随模式社区签到未完成。')
            }
          })
        }
        if (passport.communityEnabled && !passport.followMissions && passport.stoken && !communityRunning.has(passport.id)) {
          communityRunning.add(passport.id)
          try {
            if (await accounts.markMissionDay(passport.platform, passport.userId, passport.ltuid, now.date, 'scheduled')) {
              await accounts.use(passport.platform, passport.userId, passport.ltuid, 'stoken', token => accounts.device(passport.platform, passport.userId, passport.ltuid, device => client.forum(token, 'gs', device)))
            }
          } catch {
            ctx.logger.warn('独立定时社区签到未完成。')
          } finally {
            communityRunning.delete(passport.id)
          }
        }
      }
    } catch {
      ctx.logger.warn('自动签到扫描失败。')
    }
  }, 60 * 60 * 1000)
}

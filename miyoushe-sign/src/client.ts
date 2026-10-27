import { createHash, randomInt, randomUUID } from 'node:crypto'
import { Context } from 'koishi'
import { DeviceInfo } from './vault'
import { DiscoveredRole, GameRole, gameBiz } from './accounts'

export const games = {
  gs: { name: '原神', cn: ['hk4e', 'e202311201442471'], os: ['sol', 'e202102251931481'] },
  sr: { name: '星穹铁道', cn: ['hkrpg', 'e202304121516551'], os: ['luna/hkrpg/os', 'e202303301540311'] },
  zzz: { name: '绝区零', cn: ['zzz', 'e202406242138391'], os: ['luna/zzz/os', 'e202406031448091'] },
  bh3: { name: '崩坏3', cn: ['bh3', 'e202306201626331'], os: ['mani', 'e202110291205111'] },
  bh2: { name: '崩坏学园2', cn: ['bh2', 'e202203291431091'] },
  wd: { name: '未定事件簿', cn: ['nxx', 'e202202251749321'], os: ['luna/nxx/os', 'e202202281857121'] },
} as const

export const forums = { bh3: 1, gs: 2, bh2: 3, wd: 4, dby: 5, sr: 6, zzz: 8, hna: 9, planet: 10 } as const
export type Game = keyof typeof games
export type Forum = keyof typeof forums
export type SignResult = { text: string; done: boolean }

export type Result = { retcode: number; message?: string; data?: Record<string, unknown> }

function ds(salt: string, body?: string) {
  const time = Math.floor(Date.now() / 1000)
  const random = body ? String(randomInt(100001, 200001)) : Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]).join('')
  const input = body ? `salt=${salt}&t=${time}&r=${random}&b=${body}&q=` : `salt=${salt}&t=${time}&r=${random}`
  const hash = createHash('md5').update(input).digest('hex')
  return `${time},${random},${hash}`
}

function recordDs(query: string, body: string, cn: boolean) {
  const time = Math.floor(Date.now() / 1000)
  const random = String(randomInt(100000, 1000000))
  const salt = cn ? 'xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs' : 'okr4obncj8bw5a65hbnn5oo6ixjc3l9w'
  const hash = createHash('md5').update(`salt=${salt}&t=${time}&r=${random}&b=${body}&q=${query}`).digest('hex')
  return `${time},${random},${hash}`
}

export function createClient(ctx: Context, timeout: number, interval: number) {
  let next = 0
  let queue: Promise<unknown> = Promise.resolve()
  const qrDeviceId = randomUUID()
  const qrLifecycleId = randomUUID()
  const recordDeviceId = randomUUID().replace(/-/g, '')

  async function request(url: string, secret: string, method: 'GET' | 'POST', body?: object, community = false, device?: DeviceInfo): Promise<Result> {
    const hostname = new URL(url).hostname
    if (!['api-takumi.mihoyo.com', 'sg-act-public-api.hoyolab.com', 'bbs-api.miyoushe.com', 'api-takumi-record.mihoyo.com', 'sg-public-api.hoyolab.com', 'passport-api.miyoushe.com', 'public-data-api.mihoyo.com', 'sg-public-data-api.hoyoverse.com'].includes(hostname)) {
      throw new Error('请求地址不在允许列表。')
    }
    const task = queue.catch(() => {}).then(async () => {
      const delay = Math.max(0, next - Date.now())
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      next = Date.now() + interval
      const overseas = hostname.endsWith('hoyolab.com')
      const headers: Record<string, string> = {
        'User-Agent': community ? 'okhttp/4.9.3' : `Mozilla/5.0 (Linux; Android 13; XQ-BC52 Build/61.2.A.0.472A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.5563.116 Mobile Safari/537.36 ${overseas ? 'miHoYoBBSOversea/2.57.1' : 'miHoYoBBS/2.73.1'}`,
        Accept: 'application/json',
        Referer: community ? 'https://app.mihoyo.com/' : overseas ? 'https://act.hoyolab.com/' : 'https://act.mihoyo.com/',
        Cookie: secret,
      }
      headers['x-rpc-app_version'] = overseas ? '2.57.1' : '2.73.1'
      headers['x-rpc-client_type'] = community || overseas ? '2' : '5'
      if (community) {
        headers['x-rpc-channel'] = 'miyousheluodi'
        headers['x-rpc-device_model'] = 'XQ-BC52'
        headers['x-rpc-device_name'] = 'Sony XQ-BC52'
        headers['x-rpc-sys_version'] = '12'
      } else if (hostname === 'passport-api.miyoushe.com') {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
        headers['x-rpc-device_os'] = 'Windows 10 64-bit'
        headers['x-rpc-client_type'] = '4'
        headers['x-rpc-app_id'] = 'bll8iq97cem8'
        headers['x-rpc-game_biz'] = 'bbs_cn'
        headers['x-rpc-device_id'] = qrDeviceId
        headers['x-rpc-device_name'] = 'Chrome'
        headers['x-rpc-device_model'] = 'Chrome 149.0.0.0'
        headers['x-rpc-device_fp'] = '38d805974f6af'
        headers['x-rpc-sdk_version'] = '2.54.0'
        headers['x-rpc-lifecycle_id'] = qrLifecycleId
        headers.Connection = 'keep-alive'
      } else if (url.includes('/event/') && !url.includes('/game_record/')) {
        const game = /\/event\/(?:luna\/)?([^/]+)/.exec(url)?.[1]
        const signgame = { hk4e: 'hk4e', sol: 'hk4e', hkrpg: 'hkrpg', zzz: 'zzz', mani: 'bh3', bh3: 'bh3', bh2: 'bh2', nxx: 'nxx' }[game || '']
        if (signgame) headers['x-rpc-signgame'] = signgame
        headers['x-rpc-platform'] = 'android'
        headers['x-rpc-channel'] = overseas ? 'google' : 'miyousheluodi'
        headers['X-Requested-With'] = overseas ? 'com.mihoyo.hoyolab' : 'com.mihoyo.hyperion'
      }
      if (body) headers['Content-Type'] = 'application/json'
      if (hostname === 'api-takumi-record.mihoyo.com' || hostname === 'sg-act-public-api.hoyolab.com' && url.includes('/game_record/') || hostname.includes('public-data-api.')) {
        const signgame = url.includes('/hkrpg/') ? 'hkrpg' : url.includes('/genshin/') ? 'hk4e' : url.includes('/zzz/') ? 'zzz' : undefined
        if (signgame) headers['x-rpc-signgame'] = signgame
        headers['x-rpc-device_name'] = 'Sony XQ-BC52'
        headers['x-rpc-device_model'] = 'XQ-BC52'
        headers['x-rpc-csm_source'] = 'myself'
        headers['x-rpc-platform'] = 'android'
        headers['x-rpc-channel'] = overseas ? 'google' : 'miyousheluodi'
        headers['x-rpc-sys_version'] = '12'
        headers.DS = recordDs(new URL(url).search.slice(1), body ? JSON.stringify(body) : '', hostname.endsWith('mihoyo.com'))
      } else if (community) {
        headers.DS = method === 'POST' && body
          ? ds('t0qEgfub6cvueAPgR5m9aQWWVciEer7v', JSON.stringify(body))
          : ds('WGtruoQrwczmsjLOPXzJLnaAYycsLavx')
      } else if (hostname !== 'passport-api.miyoushe.com') {
        headers.DS = ds('jEpJb9rRARU2rXDA9qYbZ3selxkuct9a')
      }
      if (device?.deviceId) headers['x-rpc-device_id'] = device.deviceId
      else if (hostname === 'api-takumi-record.mihoyo.com' || hostname === 'sg-act-public-api.hoyolab.com' && url.includes('/game_record/')) headers['x-rpc-device_id'] = recordDeviceId
      if (device?.deviceFp) headers['x-rpc-device_fp'] = device.deviceFp
      if (device && (hostname === 'api-takumi-record.mihoyo.com' || hostname.includes('public-data-api.'))) {
        headers['x-rpc-device_name'] ||= 'Sony XQ-BC52'
        headers['x-rpc-device_model'] ||= 'XQ-BC52'
        headers['x-rpc-platform'] ||= 'android'
        headers['x-rpc-sys_version'] ||= '12'
      }
      // #region debug-point A:record-request
      const recordTraceId = randomUUID()
      if (hostname.includes('record') || hostname.includes('public-data')) {
        const query = new URL(url).searchParams
        ctx.logger?.info(`[record-debug] trace=${recordTraceId} stage=request method=${method} path=${new URL(url).pathname} schedule=${query.get('schedule_type') || '-'} isPrev=${query.has('isPrev')} needAll=${query.get('need_all') || '-'} deviceId=${headers['x-rpc-device_id'] ? 'present' : 'missing'} deviceFp=${headers['x-rpc-device_fp'] ? 'present' : 'missing'} sys=${headers['x-rpc-sys_version'] || '-'} signgame=${headers['x-rpc-signgame'] || '-'} queueWaitMs=${delay}`)
      }
      // #endregion
      const response = await ctx.http(url, { method, headers, data: body, timeout, redirect: 'error' })
      if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`)
      const result = response.data as Result
      if (!result || typeof result.retcode !== 'number') throw new Error('接口响应格式错误')
      // #region debug-point B:record-response
      if (hostname.includes('record') || hostname.includes('public-data')) {
        const message = result.message || ''
        const messageClass = /cookie|token|login|auth/i.test(message) ? 'auth' : /device|fingerprint|设备/i.test(message) ? 'device' : /captcha|verify|验证|验证码/i.test(message) ? 'verification' : message ? 'other' : 'none'
        ctx.logger?.info(`[record-debug] trace=${recordTraceId} stage=response path=${new URL(url).pathname} status=${response.status} retcode=${result.retcode} messageClass=${messageClass}`)
      }
      // #endregion
      return result
    })
    queue = task.then(() => {}, () => {})
    return task
  }

  return {
    async qrCreate() {
      const result = await request('https://passport-api.miyoushe.com/account/ma-cn-passport/app/createQRLogin', '', 'POST', {})
      const url = result.data?.url
      const ticket = result.data?.ticket
      if (result.retcode !== 0 || typeof url !== 'string' || typeof ticket !== 'string' || !ticket || ticket.length > 1024) throw new Error('二维码生成失败。')
      const target = new URL(url)
      if (target.protocol !== 'https:' || !['miyoushe.com', 'mihoyo.com'].some(domain => target.hostname === domain || target.hostname.endsWith(`.${domain}`))) throw new Error('扫码链接域名无效。')
      return { url, ticket }
    },
    async qrStatus(ticket: string) {
      return request('https://passport-api.miyoushe.com/account/ma-cn-passport/app/queryQRLoginStatus', '', 'POST', { ticket })
    },
    async qrExchange(stoken: string, mid: string | number) {
      const result = await request('https://passport-api.miyoushe.com/account/ma-cn-session/app/exchange', '', 'POST', { src_token: { token: stoken, token_type: 1 }, mid, dst_token_type: 4 })
      const token = (result.data?.token as Record<string, unknown> | undefined)?.token
      if (result.retcode !== 0 || typeof token !== 'string' || !/^[^;\s\x00-\x1f]{1,2048}$/.test(token)) throw new Error('LToken 换取失败。')
      return token
    },
    async exchangeCookie(secret: string, ltuid: string, gameBiz = 'hk4e_cn') {
      if (secret.length > 4096 || /[\r\n\x00-\x1f]/.test(secret) || !/^\d{1,20}$/.test(ltuid)) throw new Error('SToken 数据不完整。')
      const fields = new Map(secret.split(';').flatMap(segment => {
        const index = segment.indexOf('=')
        return index < 1 ? [] : [[segment.slice(0, index).trim(), segment.slice(index + 1).trim()] as const]
      }))
      const stoken = fields.get('stoken') || fields.get('stoken_v2')
      const ltoken = fields.get('ltoken')
      const ltokenV2 = fields.get('ltoken_v2')
      const ltmidV2 = fields.get('ltmid_v2')
      const accountMidV2 = fields.get('account_mid_v2')
      const identities = ['ltuid', 'login_uid', 'stuid', 'account_id', 'ltuid_v2', 'account_id_v2'].map(name => fields.get(name)).filter((value): value is string => Boolean(value))
      const validToken = (value?: string) => Boolean(value && /^[^;\s\x00-\x1f]{1,2048}$/.test(value))
      if (!validToken(stoken) || !validToken(ltoken) && !validToken(ltokenV2) || !identities.length || identities.some(value => value !== ltuid)) throw new Error('SToken 数据不完整。')
      if ((ltokenV2 && !validToken(ltokenV2)) || (ltmidV2 && !validToken(ltmidV2)) || (accountMidV2 && !validToken(accountMidV2))) throw new Error('SToken 数据不完整。')
      const overseas = gameBiz.endsWith('_global')
      const host = overseas ? 'https://sg-public-api.hoyolab.com' : 'https://api-takumi.mihoyo.com'
      const result = await request(`${host}/auth/api/getCookieAccountInfoBySToken?game_biz=${encodeURIComponent(gameBiz)}`, secret, overseas ? 'POST' : 'GET')
      if (result.retcode !== 0) throw new Error('CK 换取失败。')
      const token = result.data?.cookie_token
      const tokenV2 = result.data?.cookie_token_v2
      if (tokenV2 !== undefined) {
        if (typeof tokenV2 !== 'string' || !validToken(tokenV2) || !ltokenV2 || !ltmidV2 || !accountMidV2) throw new Error('CK 换取失败。')
        return `ltuid=${ltuid};account_mid_v2=${accountMidV2};cookie_token_v2=${tokenV2};ltoken_v2=${ltokenV2};ltmid_v2=${ltmidV2};`
      }
      if (typeof token !== 'string' || !/^[^;\s\x00-\x1f]{1,2048}$/.test(token)) throw new Error('CK 换取失败。')
      if (!validToken(ltoken) && !validToken(ltokenV2)) throw new Error('CK 换取失败。')
      return `${ltoken ? `ltoken=${ltoken};` : ''}${ltokenV2 ? `ltoken_v2=${ltokenV2};` : ''}${ltmidV2 ? `ltmid_v2=${ltmidV2};` : ''}${accountMidV2 ? `account_mid_v2=${accountMidV2};` : ''}ltuid=${ltuid};cookie_token=${token};account_id=${ltuid};`
    },
    async fingerprint(deviceId: string, overseas: boolean, secret: string) {
      if (!/^[a-zA-Z0-9_-]{8,128}$/.test(deviceId)) throw new Error('设备 ID 无效。')
      const seed = randomUUID()
      const body = {
        app_name: overseas ? 'bbs_oversea' : 'bbs_cn',
        device_fp: overseas ? '38d7f4c72b736' : '38d805c20d53d',
        device_id: deviceId,
        ext_fields: JSON.stringify({ deviceName: 'Sony XQ-BC52', model: 'XQ-BC52', brand: 'Sony', osVersion: '13', packageName: overseas ? 'com.mihoyo.hoyolab' : 'com.mihoyo.hyperion' }),
        ...(overseas ? { hoyolab_device_id: deviceId } : { bbs_device_id: deviceId }),
        platform: '2', seed_id: seed, seed_time: String(Date.now()),
      }
      const host = overseas ? 'https://sg-public-data-api.hoyoverse.com' : 'https://public-data-api.mihoyo.com'
      const result = await request(`${host}/device-fp/api/getFp`, secret, 'POST', body, false, { deviceId, deviceFp: '' })
      const fp = result.data?.device_fp
      if (result.retcode !== 0 || typeof fp !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(fp)) throw new Error('获取设备指纹失败。')
      return fp
    },
    async discover(secret: string): Promise<DiscoveredRole[]> {
      for (const host of ['https://api-takumi.mihoyo.com', 'https://sg-public-api.hoyolab.com']) {
        try {
          const result = await request(`${host}/binding/api/getUserGameRolesByCookie`, secret, 'GET')
          if (result.retcode !== 0 || !Array.isArray(result.data?.list)) continue
          const roles = (result.data.list as unknown[]).flatMap(role => {
            if (!role || typeof role !== 'object') return []
            const item = role as Record<string, unknown>
            const game = gameBiz[String(item.game_biz)]
            const uid = String(item.game_uid || '')
            const region = String(item.region || '')
            return game && /^\d{1,20}$/.test(uid) && /^[a-zA-Z0-9_-]{2,40}$/.test(region) ? [{ game, uid, region }] : []
          })
          if (!roles.length) continue
          return roles.filter((role, index) => roles.findIndex(other => other.game === role.game && other.uid === role.uid && other.region === role.region) === index)
        } catch {
          continue
        }
      }
      return []
    },
    async record(url: string, secret: string, body?: object, device?: DeviceInfo) {
      return request(url, secret, body ? 'POST' : 'GET', body, false, device)
    },
    async game(account: GameRole, secret: string, game: Game, device?: DeviceInfo) {
      const config = games[game]
      const cn = account.region.startsWith('cn_') || account.region.endsWith('_cn')
      const spec = cn ? config.cn : 'os' in config ? config.os : undefined
      if (!spec) return { text: '该游戏暂不支持所选区服。', done: false }
      const host = cn ? 'https://api-takumi.mihoyo.com' : 'https://sg-act-public-api.hoyolab.com'
      const path = cn ? `luna/${spec[0]}` : spec[0]
      const base = `${host}/event/${path}`
      const language = game === 'wd' && account.region === 'tw_prod_wd01' ? 'zh-tw' : 'zh-cn'
      const activity = game === 'wd' && account.region === 'tw_prod_wd01' ? 'e202308141137581' : spec[1]
      const params = new URLSearchParams({ act_id: activity, lang: language })
      if (cn) {
        params.set('region', account.region)
        params.set('uid', account.uid)
      }
      const info = await request(`${base}/info?${params}`, secret, 'GET', undefined, false, device)
      if (info.retcode !== 0) return { text: `${config.name}：状态查询失败（${info.retcode}）。`, done: false }
      if (info.data?.is_sign === true) return { text: `${config.name}：今日已签。`, done: true }
      if (info.data?.first_bind || info.data?.send_first) return { text: `${config.name}：首次绑定需在官方客户端手动签到。`, done: false }
      const body: Record<string, string> = { act_id: activity, lang: language }
      if (cn) Object.assign(body, { region: account.region, uid: account.uid })
      const signed = await request(`${base}/sign`, secret, 'POST', body, false, device)
      if (signed.retcode === -5003) return { text: `${config.name}：今日已签。`, done: true }
      if (signed.retcode !== 0) return { text: `${config.name}：签到失败（${signed.retcode}），请在官方客户端检查账号状态。`, done: false }
      const confirmed = await request(`${base}/info?${params}`, secret, 'GET', undefined, false, device)
      return confirmed.retcode === 0 && confirmed.data?.is_sign === true
        ? { text: `${config.name}：签到成功。`, done: true }
        : { text: `${config.name}：接口已接受请求，但状态尚未确认，请到官方客户端核实。`, done: false }
    },
    async forum(secret: string, forum: Forum, device?: DeviceInfo) {
      const id = forums[forum]
      const host = 'https://bbs-api.miyoushe.com/apihub'
      const status = await request(`${host}/sapi/querySignInStatus?gids=${id}`, secret, 'GET', undefined, true, device)
      if (status.retcode !== 0) return { text: `${forum}社区：状态查询失败（${status.retcode}）。`, done: false }
      if (status.data?.is_signed === true) return { text: `${forum}社区：今日已签。`, done: true }
      const signed = await request(`${host}/app/api/signIn`, secret, 'POST', { gids: String(id) }, true, device)
      if (signed.retcode !== 0) return { text: `${forum}社区：签到失败（${signed.retcode}），请在官方客户端检查账号状态。`, done: false }
      const confirmed = await request(`${host}/sapi/querySignInStatus?gids=${id}`, secret, 'GET', undefined, true, device)
      return confirmed.retcode === 0 && confirmed.data?.is_signed === true
        ? { text: `${forum}社区：签到成功。`, done: true }
        : { text: `${forum}社区：接口已接受请求，但状态尚未确认，请到官方客户端核实。`, done: false }
    },
  }
}

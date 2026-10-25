import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Context } from 'koishi'
import { DeviceInfo } from './vault'
import { Game } from './client'

export interface Passport {
  id: string
  platform: string
  userId: string
  ltuid: string
  cookie: string
  stoken: string
  device: string
  enabled: boolean
  communityEnabled: boolean
  followMissions: boolean
  fpExpires: string
  lastMissionDay: string
}

export interface GameRole {
  id: string
  platform: string
  userId: string
  ltuid: string
  game: string
  uid: string
  region: string
  current: boolean
  lastDay: string
}

declare module 'koishi' {
  interface Tables {
    miyoushe_passport: Passport
    miyoushe_role: GameRole
  }
}

export const gameBiz: Record<string, Game> = {
  hk4e_cn: 'gs', hk4e_global: 'gs', hkrpg_cn: 'sr', hkrpg_global: 'sr',
  nap_cn: 'zzz', nap_global: 'zzz', nxx_cn: 'wd', nxx_global: 'wd', nxx_tw: 'wd',
  bh3_cn: 'bh3', bh3_global: 'bh3', bh2_cn: 'bh2',
}

export type DiscoveredRole = { game: Game; uid: string; region: string }

export function parseCookie(cookie: string, kind: 'ck' | 'stoken') {
  if (cookie.length > 4096 || /[\r\n\x00-\x1f]/.test(cookie)) throw new Error('凭证格式无效。')
  const fields = new Map<string, string>()
  for (const segment of cookie.split(';')) {
    const index = segment.indexOf('=')
    if (index < 1) continue
    const name = segment.slice(0, index).trim()
    const value = segment.slice(index + 1).trim()
    if (name && value) fields.set(name, value)
  }
  const ltuid = fields.get('ltuid') || fields.get('login_uid') || fields.get('stuid') || fields.get('account_id') || fields.get('ltuid_v2')
  if (!ltuid || !/^\d{1,20}$/.test(ltuid)) throw new Error('缺少数字通行证 ID。')
  const identities = ['ltuid', 'login_uid', 'stuid', 'account_id', 'ltuid_v2', 'account_id_v2'].map(name => fields.get(name)).filter(Boolean)
  if (identities.some(value => value !== ltuid)) throw new Error('通行证 ID 字段不一致。')
  if (kind === 'ck' && !(fields.get('cookie_token') || fields.get('cookie_token_v2'))) throw new Error('缺少 cookie_token。')
  if (kind === 'stoken' && !(fields.get('stoken') || fields.get('stoken_v2')) || kind === 'stoken' && !(fields.get('ltoken') || fields.get('ltoken_v2'))) throw new Error('SToken 须包含 stoken 与 ltoken。')
  return { ltuid, cookie: cookie.trim() }
}

export function createAccounts(ctx: Context, keyText: string) {
  const key = Buffer.from(keyText, 'base64')
  if (key.length !== 32 || key.toString('base64') !== keyText) throw new Error('MIYOUSHE_SIGN_KEY 必须是 32 字节随机密钥的标准 base64 编码。')
  ctx.model.extend('miyoushe_passport', {
    id: 'string', platform: 'string', userId: 'string', ltuid: 'string', cookie: 'text', stoken: 'text', device: 'text', enabled: 'boolean', communityEnabled: 'boolean', followMissions: 'boolean', fpExpires: 'string', lastMissionDay: 'string',
  }, { primary: 'id' })
  ctx.model.extend('miyoushe_role', {
    id: 'string', platform: 'string', userId: 'string', ltuid: 'string', game: 'string', uid: 'string', region: 'string', current: 'boolean', lastDay: 'string',
  }, { primary: 'id' })

  const id = (...parts: string[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')
  const seal = (value: string, aad: string[]) => {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(Buffer.from(JSON.stringify(aad)))
    return Buffer.concat([nonce, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64')
  }
  const open = (value: string, aad: string[]) => {
    const bytes = Buffer.from(value, 'base64')
    if (bytes.length < 29) throw new Error('加密数据损坏。')
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
    decipher.setAAD(Buffer.from(JSON.stringify(aad)))
    decipher.setAuthTag(bytes.subarray(-16))
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8')
  }
  const passport = async (platform: string, userId: string, ltuid: string) => {
    const [row] = await ctx.database.get('miyoushe_passport', { id: id(platform, userId, ltuid) })
    return row?.platform === platform && row.userId === userId && row.ltuid === ltuid ? row : undefined
  }
  return {
    id,
    passport,
    passports: (platform: string, userId: string) => ctx.database.get('miyoushe_passport', { platform, userId }),
    all: () => ctx.database.get('miyoushe_passport', {}),
    roles: (platform: string, userId: string) => ctx.database.get('miyoushe_role', { platform, userId }),
    async save(platform: string, userId: string, ltuid: string, cookie: string, roles: DiscoveredRole[]) {
      const previous = await passport(platform, userId, ltuid)
      const existing = await ctx.database.get('miyoushe_role', { platform, userId })
      const selectedGames = new Set(existing.filter(role => role.current && role.ltuid !== ltuid).map(role => role.game))
      const newRoles = roles.map(role => {
        const old = existing.find(item => item.game === role.game && item.uid === role.uid && item.region === role.region && item.ltuid === ltuid)
        const current = old?.current || !selectedGames.has(role.game) && !existing.some(item => item.game === role.game && item.current && item.ltuid === ltuid && roles.some(next => next.game === role.game && next.uid === item.uid && next.region === item.region))
        if (current) selectedGames.add(role.game)
        return { id: id(platform, userId, ltuid, role.game, role.uid, role.region), platform, userId, ltuid,
          game: role.game, uid: role.uid, region: role.region, current: !!current, lastDay: old?.lastDay || '' }
      })
      await ctx.database.upsert('miyoushe_passport', [{ id: id(platform, userId, ltuid), platform, userId, ltuid,
        cookie: seal(cookie, [platform, userId, ltuid, 'ck']), stoken: previous?.stoken || '', device: previous?.device || '', enabled: previous?.enabled || false, communityEnabled: previous?.communityEnabled || false, followMissions: previous?.followMissions || false, fpExpires: previous?.fpExpires || '', lastMissionDay: previous?.lastMissionDay || '' }])
      for (const old of existing.filter(item => item.ltuid === ltuid && !newRoles.some(role => role.id === item.id))) {
        await ctx.database.remove('miyoushe_role', { id: old.id })
      }
      if (newRoles.length) await ctx.database.upsert('miyoushe_role', newRoles)
      const remaining = await ctx.database.get('miyoushe_role', { platform, userId })
      const chosen = new Set(remaining.filter(role => role.current).map(role => role.game))
      for (const role of remaining.filter(role => !role.current && !chosen.has(role.game))) {
        await ctx.database.set('miyoushe_role', { id: role.id }, { current: true })
        chosen.add(role.game)
      }
      return newRoles
    },
    async saveToken(platform: string, userId: string, ltuid: string, token: string) {
      const row = await passport(platform, userId, ltuid)
      if (!row) {
        await ctx.database.upsert('miyoushe_passport', [{ id: id(platform, userId, ltuid), platform, userId, ltuid, cookie: '', stoken: seal(token, [platform, userId, ltuid, 'stoken']), device: '', enabled: false, communityEnabled: false, followMissions: false, fpExpires: '', lastMissionDay: '' }])
        return true
      }
      await ctx.database.set('miyoushe_passport', { id: row.id }, { stoken: seal(token, [platform, userId, ltuid, 'stoken']) })
      return true
    },
    async removeToken(platform: string, userId: string, ltuid: string) {
      const row = await passport(platform, userId, ltuid)
      if (!row?.stoken) return false
      if (!row.cookie) await ctx.database.remove('miyoushe_passport', { id: row.id })
      else await ctx.database.set('miyoushe_passport', { id: row.id }, { stoken: '', communityEnabled: false, followMissions: false })
      return true
    },
    async use<T>(platform: string, userId: string, ltuid: string, kind: 'ck' | 'stoken', callback: (secret: string, row: Passport) => Promise<T>) {
      const row = await passport(platform, userId, ltuid)
      if (!row || !row[kind === 'ck' ? 'cookie' : 'stoken']) throw new Error('未绑定该凭证。')
      return callback(open(row[kind === 'ck' ? 'cookie' : 'stoken'], [platform, userId, ltuid, kind]), row)
    },
    async device<T>(platform: string, userId: string, ltuid: string, callback: (device?: DeviceInfo) => Promise<T>) {
      const row = await passport(platform, userId, ltuid)
      if (!row) throw new Error('未绑定该通行证。')
      return callback(row.device ? JSON.parse(open(row.device, [platform, userId, ltuid, 'device'])) as DeviceInfo : undefined)
    },
    async setDevice(platform: string, userId: string, ltuid: string, device?: DeviceInfo) {
      const row = await passport(platform, userId, ltuid)
      if (!row) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { device: device ? seal(JSON.stringify(device), [platform, userId, ltuid, 'device']) : '', fpExpires: '' })
      return true
    },
    async saveFingerprint(platform: string, userId: string, ltuid: string, device: DeviceInfo) {
      const row = await passport(platform, userId, ltuid)
      if (!row) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { device: seal(JSON.stringify(device), [platform, userId, ltuid, 'device']), fpExpires: String(Date.now() + 7 * 86400000) })
      return true
    },
    async setEnabled(platform: string, userId: string, ltuid: string, enabled: boolean) {
      const row = await passport(platform, userId, ltuid)
      if (!row?.cookie) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { enabled })
      return true
    },
    async setCommunityEnabled(platform: string, userId: string, ltuid: string, enabled: boolean) {
      const row = await passport(platform, userId, ltuid)
      if (!row?.stoken) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { communityEnabled: enabled, ...(enabled ? { followMissions: false } : {}) })
      return true
    },
    async setFollowMissions(platform: string, userId: string, ltuid: string, enabled: boolean) {
      const row = await passport(platform, userId, ltuid)
      if (!row?.stoken) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { followMissions: enabled, ...(enabled ? { communityEnabled: false } : {}) })
      return true
    },
    async markMissionDay(platform: string, userId: string, ltuid: string, day: string, mode: 'follow' | 'scheduled') {
      const row = await passport(platform, userId, ltuid)
      if (!row?.stoken || row.lastMissionDay === day || (mode === 'follow' ? !row.enabled || !row.cookie || !row.followMissions : !row.communityEnabled || row.followMissions)) return false
      await ctx.database.set('miyoushe_passport', { id: row.id }, { lastMissionDay: day })
      return true
    },
    async choose(platform: string, userId: string, game: string, uid: string) {
      const roles = (await ctx.database.get('miyoushe_role', { platform, userId })).filter(role => role.game === game)
      const selected = roles.find(role => role.uid === uid)
      if (!selected) return false
      for (const role of roles) await ctx.database.set('miyoushe_role', { id: role.id }, { current: role.id === selected.id })
      return true
    },
    async mark(role: GameRole, day: string) {
      const [current] = await ctx.database.get('miyoushe_role', { id: role.id })
      if (current) await ctx.database.set('miyoushe_role', { id: role.id }, { lastDay: day })
    },
    async remove(platform: string, userId: string, ltuid: string) {
      const row = await passport(platform, userId, ltuid)
      if (!row?.cookie) return false
      if (row.stoken) await ctx.database.set('miyoushe_passport', { id: row.id }, { cookie: '', device: '', enabled: false })
      else await ctx.database.remove('miyoushe_passport', { id: row.id })
      const roles = await ctx.database.get('miyoushe_role', { platform, userId, ltuid })
      for (const role of roles) await ctx.database.remove('miyoushe_role', { id: role.id })
      const remaining = await ctx.database.get('miyoushe_role', { platform, userId })
      const chosen = new Set(remaining.filter(role => role.current).map(role => role.game))
      for (const role of remaining.filter(role => !role.current && !chosen.has(role.game))) {
        await ctx.database.set('miyoushe_role', { id: role.id }, { current: true })
        chosen.add(role.game)
      }
      return true
    },
  }
}

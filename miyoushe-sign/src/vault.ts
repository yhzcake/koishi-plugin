import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Context } from 'koishi'

export interface SignAccount {
  id: string
  platform: string
  userId: string
  slot: string
  kind: string
  uid: string
  region: string
  enabled: boolean
  ciphertext: string
  lastDay: string
}

export interface SignDevice {
  id: string
  platform: string
  userId: string
  slot: string
  ciphertext: string
}

export interface DeviceInfo {
  deviceId: string
  deviceFp: string
}

declare module 'koishi' {
  interface Tables {
    miyoushe_sign_account: SignAccount
    miyoushe_sign_device: SignDevice
  }
}

export function accountId(platform: string, userId: string, slot: string) {
  return createHash('sha256').update(JSON.stringify([platform, userId, slot])).digest('hex')
}

export function createVault(ctx: Context, keyText: string) {
  const key = Buffer.from(keyText, 'base64')
  if (key.length !== 32 || key.toString('base64') !== keyText) {
    throw new Error('MIYOUSHE_SIGN_KEY 必须是 32 字节随机密钥的标准 base64 编码。')
  }

  ctx.model.extend('miyoushe_sign_account', {
    id: 'string', platform: 'string', userId: 'string', slot: 'string',
    kind: 'string', uid: 'string', region: 'string', enabled: 'boolean',
    ciphertext: 'text', lastDay: 'string',
  }, { primary: 'id' })
  ctx.model.extend('miyoushe_sign_device', {
    id: 'string', platform: 'string', userId: 'string', slot: 'string', ciphertext: 'text',
  }, { primary: 'id' })

  function encrypt(value: string, aad: string[]) {
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(Buffer.from(JSON.stringify(aad)))
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64')
  }

  function decrypt(ciphertext: string, aad: string[]) {
    const payload = Buffer.from(ciphertext, 'base64')
    if (payload.length < 29) throw new Error('加密数据损坏。')
    const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12))
    decipher.setAAD(Buffer.from(JSON.stringify(aad)))
    decipher.setAuthTag(payload.subarray(12, 28))
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8')
  }

  const owned = async (platform: string, userId: string, slot: string) => {
    const rows = await ctx.database.get('miyoushe_sign_account', { id: accountId(platform, userId, slot) })
    const row = rows[0]
    return row?.platform === platform && row.userId === userId && row.slot === slot ? row : undefined
  }

  return {
    owned,
    async list(platform: string, userId: string) {
      return ctx.database.get('miyoushe_sign_account', { platform, userId })
    },
    async all() {
      return ctx.database.get('miyoushe_sign_account', { enabled: true })
    },
    async put(platform: string, userId: string, slot: string, kind: string, uid: string, region: string, secret: string) {
      const id = accountId(platform, userId, slot)
      const ciphertext = encrypt(secret, [platform, userId, slot, kind, uid, region])
      await ctx.database.remove('miyoushe_sign_device', { id })
      await ctx.database.upsert('miyoushe_sign_account', [{
        id, platform, userId, slot, kind, uid, region, enabled: false, ciphertext, lastDay: '',
      }])
    },
    async use<T>(platform: string, userId: string, slot: string, callback: (secret: string, account: SignAccount) => Promise<T>) {
      const row = await owned(platform, userId, slot)
      if (!row) throw new Error('未绑定该账号。')
      const secret = decrypt(row.ciphertext, [platform, userId, slot, row.kind, row.uid, row.region])
      return callback(secret, row)
    },
    async putDevice(platform: string, userId: string, slot: string, device: DeviceInfo) {
      if (!await owned(platform, userId, slot)) return false
      const id = accountId(platform, userId, slot)
      const ciphertext = encrypt(JSON.stringify(device), ['device', platform, userId, slot])
      await ctx.database.upsert('miyoushe_sign_device', [{ id, platform, userId, slot, ciphertext }])
      return true
    },
    async useDevice<T>(platform: string, userId: string, slot: string, callback: (device?: DeviceInfo) => Promise<T>) {
      if (!await owned(platform, userId, slot)) throw new Error('未绑定该账号。')
      const [row] = await ctx.database.get('miyoushe_sign_device', { id: accountId(platform, userId, slot) })
      if (!row) return callback()
      if (row.platform !== platform || row.userId !== userId || row.slot !== slot) throw new Error('设备不属于该用户。')
      const device = JSON.parse(decrypt(row.ciphertext, ['device', platform, userId, slot])) as DeviceInfo
      return callback(device)
    },
    async removeDevice(platform: string, userId: string, slot: string) {
      if (!await owned(platform, userId, slot)) return false
      await ctx.database.remove('miyoushe_sign_device', { id: accountId(platform, userId, slot) })
      return true
    },
    async enable(platform: string, userId: string, slot: string, enabled: boolean) {
      const row = await owned(platform, userId, slot)
      if (!row) return false
      await ctx.database.set('miyoushe_sign_account', { id: row.id }, { enabled })
      return true
    },
    async mark(platform: string, userId: string, slot: string, day: string) {
      const row = await owned(platform, userId, slot)
      if (row) await ctx.database.set('miyoushe_sign_account', { id: row.id }, { lastDay: day })
    },
    async remove(platform: string, userId: string, slot: string) {
      const row = await owned(platform, userId, slot)
      if (!row) return false
      await ctx.database.remove('miyoushe_sign_account', { id: row.id })
      await ctx.database.remove('miyoushe_sign_device', { id: row.id })
      return true
    },
  }
}

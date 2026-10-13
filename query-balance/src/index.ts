import { Context, Schema } from 'koishi'

export const name = 'query-balance'
export const inject = ['http']

export interface AccountConfig {
  name: string
  type: 'usage' | 'deepseek'
  baseUrl: string
  apiKey?: string
  proxy?: string
  noProxy?: string[]
}

export interface Config {
  accounts: AccountConfig[]
  timeout: number
  timezone: string
}

const AccountConfig: Schema<AccountConfig> = Schema.object({
  name: Schema.string().default('默认账号').description('API 账号昵称。'),
  type: Schema.union(['usage', 'deepseek']).role('radio').default('usage').description('接口类型。usage 为 /v1/usage，中转站；deepseek 为 DeepSeek 官方余额接口。'),
  baseUrl: Schema.string().default('https://api.777358.xyz').description('API 基础地址。'),
  apiKey: Schema.string().role('secret').description('API 密钥。'),
  proxy: Schema.string().description('该账号使用的代理地址。'),
  noProxy: Schema.array(String).default([]).description('该账号不使用代理的主机名或地址。'),
})

export const Config: Schema<Config> = Schema.object({
  accounts: Schema.array(AccountConfig).default([{
    name: '默认账号',
    type: 'usage',
    baseUrl: 'https://api.777358.xyz',
    apiKey: process.env.OPENAI_API_KEY || '',
    proxy: '',
    noProxy: [],
  }]).description('可查询的 API 账号列表。'),
  timeout: Schema.natural().role('ms').default(15000).description('请求超时时间。'),
  timezone: Schema.string().default('Asia/Shanghai').description('月度统计使用的时区。'),
})

type RecordValue = Record<string, unknown>
type CommandSession = {
  send: (value: string) => Promise<unknown>
  prompt?: (timeout?: number) => Promise<string | undefined>
}

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function buildUsageUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/`/g, '').replace(/\/+$/, '')
  return `${normalized.endsWith('/v1') ? normalized.slice(0, -3).replace(/\/+$/, '') : normalized}/v1/usage`
}

function buildDeepSeekBalanceUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/`/g, '').replace(/\/+$/, '')
  return `${normalized.replace(/\/v1$/, '')}/user/balance`
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function getBalance(data: RecordValue) {
  const quota = isRecord(data.quota) ? data.quota : undefined
  const remaining = getNumber(quota?.remaining) ?? getNumber(quota?.balance) ?? getNumber(data.remaining) ?? getNumber(data.balance)
  const unit = String(quota?.unit ?? data.unit ?? 'USD')
  return { remaining, unit }
}

function getDeepSeekBalances(data: RecordValue) {
  return Array.isArray(data.balance_infos) ? data.balance_infos.filter(isRecord) : []
}

function formatNumber(value: unknown) {
  const number = getNumber(value)
  if (number === undefined) return value == null ? '-' : String(value)
  return Number.isInteger(number) ? number.toLocaleString('en-US') : number.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function formatUsage(value: unknown, unit: string) {
  if (!isRecord(value)) return `用量：${formatNumber(value)}${unit ? ` ${unit}` : ''}`
  const lines = Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null)
    .map(([key, item]) => `${key}：${formatNumber(item)}${['cost', 'actual_cost', 'amount', 'total_cost'].includes(key) ? ` ${unit}` : ''}`)
  return lines.length ? lines.join('\n') : '用量：-'
}

function getDateKey(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

function getMonthKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const year = parts.find(item => item.type === 'year')?.value
  const month = parts.find(item => item.type === 'month')?.value
  return year && month ? `${year}-${month}` : undefined
}

function aggregateMonth(items: unknown[], timezone: string) {
  const month = getMonthKey(new Date(), timezone)
  const result: RecordValue = {}
  for (const item of items) {
    if (!isRecord(item)) continue
    const date = getDateKey(item.date ?? item.day ?? item.timestamp)
    if (!date || getMonthKey(date, timezone) !== month) continue
    for (const [key, value] of Object.entries(item)) {
      if (['date', 'day', 'timestamp'].includes(key)) continue
      const number = getNumber(value)
      if (number !== undefined) result[key] = (getNumber(result[key]) ?? 0) + number
    }
  }
  return result
}

function getMonthlyUsage(data: RecordValue, timezone: string) {
  const usage = isRecord(data.usage) ? data.usage : undefined
  if (usage?.month !== undefined) return usage.month
  const daily = Array.isArray(data.daily_usage) ? data.daily_usage : []
  return aggregateMonth(daily, timezone)
}

function isNoProxy(url: string, noProxy: string[]) {
  const hostname = new URL(url).hostname
  return noProxy.some(pattern => {
    const value = pattern.trim().toLowerCase()
    if (!value) return false
    if (value === '*') return true
    const host = hostname.toLowerCase()
    return host === value || (value.startsWith('.') ? host.endsWith(value) : host.endsWith(`.${value}`))
  })
}

function errorText(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') return '请求超时，请稍后重试。'
  if (isRecord(error) && isRecord(error.response)) {
    const status = getNumber(error.response.status)
    return status ? `接口请求失败（HTTP ${status}）。` : '接口请求失败。'
  }
  if (error instanceof Error && /timeout|ETIMEDOUT/i.test(error.message)) return '请求超时，请稍后重试。'
  return '无法连接余额接口，请检查地址、网络和配置。'
}

function getAccounts(config: Config) {
  return (config.accounts || []).filter(account => account && account.baseUrl?.trim())
}

function resolveAccount(accounts: AccountConfig[], input?: string) {
  const value = input?.trim()
  if (!value && accounts.length === 1) return accounts[0]
  if (!value) return undefined
  const index = Number(value)
  if (Number.isInteger(index) && index >= 1 && index <= accounts.length) return accounts[index - 1]
  const exact = accounts.find(account => account.name === value)
  if (exact) return exact
  const matched = accounts.filter(account => account.name.includes(value))
  return matched.length === 1 ? matched[0] : undefined
}

function accountList(accounts: AccountConfig[]) {
  return accounts.map((account, index) => `${index + 1}. ${account.name || `账号${index + 1}`}`).join('\n')
}

export function apply(ctx: Context, config: Config) {
  const request = async (account: AccountConfig) => {
    const apiKey = account.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('未配置 API 密钥。')
    const url = account.type === 'deepseek' ? buildDeepSeekBalanceUrl(account.baseUrl || 'https://api.deepseek.com') : buildUsageUrl(account.baseUrl)
    const requestConfig: Record<string, unknown> = {
      timeout: config.timeout,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    }
    if (account.proxy && !isNoProxy(url, account.noProxy || [])) requestConfig.proxyAgent = account.proxy
    return ctx.http.get<RecordValue>(url, requestConfig as never)
  }

  const chooseAccounts = async (session: CommandSession | undefined, input?: string) => {
    const accounts = getAccounts(config)
    if (!accounts.length) throw new Error('未配置 API 账号。')
    if (!input?.trim()) return accounts
    const account = resolveAccount(accounts, input)
    if (account) return [account]
    if (!session?.prompt) throw new Error(`未找到账号，请使用账号序号或昵称。\n${accountList(accounts)}`)
    await session.send(`请选择 API 账号：\n${accountList(accounts)}`)
    const answer = await session.prompt(30000)
    const selected = resolveAccount(accounts, answer)
    if (selected) return [selected]
    throw new Error(`未选择有效账号，请使用账号序号或昵称。\n${accountList(accounts)}`)
  }

  const queryAccount = async (account: AccountConfig, monthly: boolean) => {
    try {
      const data = await request(account)
      if (account.type === 'deepseek') {
        const balances = getDeepSeekBalances(data)
        const lines = balances.length
          ? balances.flatMap(balance => [
            `${String(balance.currency || '未知币种')} 总余额：${formatNumber(balance.total_balance)}`,
            `${String(balance.currency || '未知币种')} 赠金余额：${formatNumber(balance.granted_balance)}`,
            `${String(balance.currency || '未知币种')} 充值余额：${formatNumber(balance.topped_up_balance)}`,
          ])
          : ['余额信息：-']
        return [
          `账号：${account.name || '-'}`,
          `状态：${data.is_available === false ? '不可用' : '可用'}`,
          ...lines,
          `用量：DeepSeek 官方余额接口未提供${monthly ? '本月' : '今日'}累计用量。`,
        ].join('\n')
      }
      const { remaining, unit } = getBalance(data)
      const usage = monthly ? getMonthlyUsage(data, config.timezone) : isRecord(data.usage) ? data.usage.today : undefined
      const label = monthly ? '本月用量' : '今日用量'
      const status = data.isValid ?? data.is_active
      return [
        `账号：${account.name || '-'}`,
        `余额：${formatNumber(remaining)} ${unit}`,
        `状态：${status === false ? '无效' : '有效'}`,
        `${label}：`,
        formatUsage(usage, unit),
      ].join('\n')
    } catch (error) {
      const message = error instanceof Error && error.message === '未配置 API 密钥。' ? error.message : errorText(error)
      return `账号：${account.name || '-'}\n余额查询失败：${message}`
    }
  }

  const report = async (session: CommandSession | undefined, monthly: boolean, input?: string) => {
    try {
      const accounts = await chooseAccounts(session, input)
      const reports = await Promise.all(accounts.map(account => queryAccount(account, monthly)))
      return [monthly ? 'API 月度余额查询' : 'API 今日余额查询', ...reports].join('\n\n')
    } catch (error) {
      const message = error instanceof Error && ['未配置 API 密钥。', '未配置 API 账号。'].includes(error.message)
        ? error.message
        : error instanceof Error && error.message.includes('未找到账号') || error instanceof Error && error.message.includes('未选择有效账号')
          ? error.message
          : errorText(error)
      return `余额查询失败：${message}`
    }
  }

  ctx.command('api.day [account:text]', '查询今日 API 余额与用量').action(({ session }, account) => report(session, false, account))
  ctx.command('api.month [account:text]', '查询本月 API 余额与用量').action(({ session }, account) => report(session, true, account))
}

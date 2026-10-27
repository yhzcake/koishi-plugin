import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { App, Argv } from 'koishi'
import { apply } from '../src/index'
import { createAccounts } from '../src/accounts'

type SessionInput = { platform: string; userId: string; isDirect: boolean; guildId?: string; author?: { avatar?: string }; event?: { user?: { avatar?: string } }; send?: (message: unknown) => Promise<void> }
type CommandAction = (argv: { session?: SessionInput }, ...args: any[]) => unknown
type HttpCall = { url: string; options: any }

function context(respond: (url: string, options: any) => unknown = () => ({ retcode: 0, data: {} })) {
  const app = new App()
  const tables = new Map<string, Map<string, any>>()
  const actions = new Map<string, CommandAction>()
  const calls: HttpCall[] = []
  const html: string[] = []
  const timers: ((...args: any[]) => void)[] = []
  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, new Map())
    return tables.get(table)!
  }
  const ctx = {
    model: { extend() {} },
    database: {
      async get(table: string, query: Record<string, unknown>) {
        return [...rows(table).values()].filter(row => Object.entries(query).every(([field, value]) => row[field] === value))
      },
      async upsert(table: string, items: any[]) { items.forEach(item => rows(table).set(item.id, item)) },
      async set(table: string, query: Record<string, unknown>, changes: object) {
        for (const row of await this.get(table, query)) Object.assign(row, changes)
      },
      async remove(table: string, query: Record<string, unknown>) {
        for (const row of await this.get(table, query)) rows(table).delete(row.id)
      },
    },
    command(definition: string) {
      const command = app.command(definition)
      const name = definition.split(' ')[0]
      return {
        action(action: CommandAction) {
          command.action(action as never)
          actions.set(name, action)
          return this
        },
      }
    },
    on() {},
    setInterval(callback: (...args: any[]) => void) { timers.push(callback) },
    logger: { info() {}, warn() {} },
    puppeteer: {
      async render(content: string, callback: (page: any, next: (value: unknown) => unknown) => unknown) {
        html.push(content)
        return callback({ evaluate: async () => [], $: async () => ({ screenshot: async () => Buffer.from('jpeg') }), close: async () => {} }, async () => 'image')
      },
    },
    async http(url: string, options: any) {
      calls.push({ url, options })
      return { status: 200, data: await respond(url, options) }
    },
  }
  const key = randomBytes(32).toString('base64')
  apply(ctx as never, { encryptionKey: key, accounts: [], timeout: 5000, interval: 0, hour: 9 })
  return { app, ctx, key, actions, calls, timers, html }
}

function invoke(harness: ReturnType<typeof context>, command: string, session: SessionInput, ...args: any[]) {
  const action = harness.actions.get(command)
  assert.ok(action, `未注册命令 ${command}`)
  return Promise.resolve(action({ session }, ...args))
}

async function seedAccount(accounts: ReturnType<typeof createAccounts>, userId: string, ltuid: string, uid: string) {
  await accounts.save('onebot', userId, ltuid, `ltuid=${ltuid};cookie_token=cookie-${ltuid}`, [
    { game: 'gs', uid, region: 'cn_gf01' },
  ])
  await accounts.saveToken('onebot', userId, ltuid, `stuid=${ltuid};stoken=stoken-${ltuid};ltoken=ltoken-${ltuid}`)
}

function direct(userId: string): SessionInput {
  return { platform: 'onebot', userId, isDirect: true, author: { avatar: 'https://assets.example.test/user.png' } }
}

function group(userId: string): SessionInput {
  return { platform: 'onebot', userId, isDirect: false, guildId: 'group-1', author: { avatar: 'https://assets.example.test/user.png' } }
}

function parseCommand(harness: ReturnType<typeof context>, source: string) {
  const argv = Argv.parse(source)
  argv.session = {
    ...direct('alice'),
    stripped: { prefix: '', appel: false },
    resolve: (value: unknown) => value,
  } as never
  const command = harness.app.$commander.resolveCommand(argv)
  assert.ok(command, `未解析到命令 ${source}`)
  assert.ok(!argv.error, argv.error)
  assert.equal(argv.tokens?.length || 0, 0)
  assert.deepEqual(argv.options, {})
  return { command, argv }
}

for (const [source, name, args] of [
  ['mys.auto on', 'mys.auto', ['on']],
  ['mys.auto 123 on', 'mys.auto', ['123', 'on']],
  ['mys.record sr', 'mys.record', ['sr']],
  ['mys.record sr apocalypse 2', 'mys.record', ['sr', 'apocalypse', '2']],
  ['mys.panel', 'mys.panel', []],
  ['mys.character sr 大黑塔 123456789', 'mys.character', ['sr', '大黑塔', '123456789']],
] as const) {
  test(`真实 Koishi parser：${source}`, () => {
    const harness = context()
    const { command, argv } = parseCommand(harness, source)
    assert.equal(command.name, name)
    assert.deepEqual(argv.args, args)
  })
}

function panelContext() {
  let version = 0
  return context((url, options) => {
    const cookie = options.headers.Cookie as string
    assert.equal(cookie, 'ltuid=111;cookie_token=cookie-111')
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) return { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: '100', region: 'cn_gf01' }] } }
    if (url.includes('/character/list')) return { retcode: 0, data: { list: [{ id: 1, name: '旅行者', icon: 'https://assets.example.test/traveler.png' }] } }
    if (url.includes('/character/detail')) return { retcode: 0, data: { list: [{ id: 1, name: '旅行者', level: 90, rarity: 5, stats: { 攻击力: 1000 }, equip: { name: '测试装备', level: 80 }, skills: [{ name: '测试行迹', type_text: '普攻', level: 6 }] }] } }
    if (url.includes('/index?')) return { retcode: 0, data: { nickname: `Alice-${++version}`, level: 60, stats: { avatar_number: 1 } } }
    if (url.includes('/game_record/')) return { retcode: 0, data: { nickname: cookie.includes('cookie-111') ? 'Alice' : 'Other' } }
    return { retcode: 0, data: { list: [] } }
  })
}

test('auto 和 follow 单参数按唯一通行证启用，数据库默认均关闭', async () => {
  const harness = context()
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '123', '100')

  const initial = await accounts.passport('onebot', 'alice', '123')
  assert.equal(initial?.enabled, false)
  assert.equal(initial?.communityEnabled, false)
  assert.equal(initial?.followMissions, false)
  assert.equal(await invoke(harness, 'mys.auto', direct('alice'), 'on'), '自动签到设置已更新。')
  assert.equal(await invoke(harness, 'mys.community.follow', direct('alice'), 'on'), '跟随游戏的社区签到已开启，独立定时已关闭。')

  const updated = await accounts.passport('onebot', 'alice', '123')
  assert.equal(updated?.enabled, true)
  assert.equal(updated?.followMissions, true)
  assert.equal(updated?.communityEnabled, false)
})

test('auto 和 follow 仍兼容“通行证 ID on|off”旧语法', async () => {
  const harness = context()
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '123', '100')

  assert.equal(await invoke(harness, 'mys.auto', direct('alice'), '123', 'on'), '自动签到设置已更新。')
  assert.equal(await invoke(harness, 'mys.community.follow', direct('alice'), '123', 'on'), '跟随游戏的社区签到已开启，独立定时已关闭。')
  assert.equal(await invoke(harness, 'mys.auto', direct('alice'), '123', 'off'), '自动签到设置已更新。')
  assert.equal(await invoke(harness, 'mys.community.follow', direct('alice'), '123', 'off'), '跟随游戏的社区签到已关闭。')

  const updated = await accounts.passport('onebot', 'alice', '123')
  assert.equal(updated?.enabled, false)
  assert.equal(updated?.followMissions, false)
})

test('多通行证时 auto 和 follow 的单参数用法拒绝歧义且不修改账号', async () => {
  const harness = context()
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '123', '100')
  await seedAccount(accounts, 'alice', '456', '200')

  assert.equal(await invoke(harness, 'mys.auto', direct('alice'), 'on'), '存在多个通行证，请指定：123、456。')
  assert.equal(await invoke(harness, 'mys.community.follow', direct('alice'), 'on'), '存在多个通行证，请指定：123、456。')
  for (const passport of await accounts.passports('onebot', 'alice')) {
    assert.equal(passport.enabled, false)
    assert.equal(passport.followMissions, false)
  }
})

test('群聊记录查询只使用发起者账号，且不读取其他成员的角色', async () => {
  const harness = context((url, options) => {
    const cookie = options.headers.Cookie as string
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) {
      const uid = cookie.includes('cookie-111') ? '101' : '202'
      return { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: uid, region: 'cn_gf01' }] } }
    }
    if (url.includes('/game_record/')) {
      return { retcode: 0, data: { nickname: cookie.includes('cookie-111') ? 'Alice' : 'Bob' } }
    }
    return { retcode: 0, data: { list: [] } }
  })
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '111', '101')
  await seedAccount(accounts, 'bob', '222', '202')

  const response = await invoke(harness, 'mys.record', group('alice'), 'gs')
  assert.match(String(response), /Alice/)
  const recordCalls = harness.calls.filter(call => call.url.includes('/game_record/'))
  assert.equal(recordCalls.length, 2)
  assert.match(recordCalls[0].url, /role_id=101/)
  assert.doesNotMatch(recordCalls[0].url, /role_id=202/)

  const before = harness.calls.length
  assert.equal(await invoke(harness, 'mys.record', group('mallory'), 'gs'), '没有此游戏的当前 UID 或指定 UID 未绑定。')
  assert.equal(harness.calls.length, before)
})

test('没有 current 角色时记录查询回退到该游戏的首个角色', async () => {
  const harness = context((url) => {
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) return { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: '303', region: 'cn_gf01' }] } }
    return { retcode: 0, data: { nickname: 'Fallback' } }
  })
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '333', '303')
  const [role] = await accounts.roles('onebot', 'alice')
  await harness.ctx.database.set('miyoushe_role', { id: role.id }, { current: false })

  const response = await invoke(harness, 'mys.record', direct('alice'), 'gs')
  assert.match(String(response), /Fallback/)
  const recordCall = harness.calls.find(call => call.url.includes('/game_record/'))
  assert.ok(recordCall)
  assert.match(recordCall.url, /role_id=303/)
})

test('记录查询发现缺失角色后同步数据库并继续查询', async () => {
  const harness = context(url => {
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) return { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: '404', region: 'cn_gf01' }] } }
    return { retcode: 0, data: { nickname: 'Synced' } }
  })
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await accounts.save('onebot', 'alice', '444', 'ltuid=444;cookie_token=cookie-444', [])

  const response = await invoke(harness, 'mys.record', direct('alice'), 'gs')
  assert.match(String(response), /Synced/)
  const roles = await accounts.roles('onebot', 'alice')
  assert.deepEqual(roles.map(role => ({ game: role.game, uid: role.uid, current: role.current })), [
    { game: 'gs', uid: '404', current: true },
  ])
  assert.ok(harness.calls.some(call => call.url.includes('/game_record/app/genshin/api/index')))
})

test('群聊 panel 和 character 使用发起者账号成功，并拒绝他人 UID', async () => {
  const harness = panelContext()
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '111', '100')
  await seedAccount(accounts, 'bob', '222', '999')

  const panel = await invoke(harness, 'mys.record', group('alice'), 'gs', 'panel')
  assert.match(String(panel), /img/)
  assert.match(String(await invoke(harness, 'mys.panel', group('alice'), 'gs')), /img/)
  const character = await invoke(harness, 'mys.character', group('alice'), 'gs', '旅行者')
  assert.equal(character, 'image')
  const before = { calls: harness.calls.length, html: harness.html.length }
  assert.equal(await invoke(harness, 'mys.record', group('alice'), 'gs', 'panel', '999'), '没有此游戏的当前 UID 或指定 UID 未绑定。')
  assert.equal(await invoke(harness, 'mys.character', group('alice'), 'gs', '旅行者', '999'), '没有此游戏的当前 UID 或指定 UID 未绑定。')
  assert.equal(await invoke(harness, 'mys.panel', group('alice'), 'gs', '999'), '没有已绑定的游戏角色。')
  assert.equal(harness.calls.length, before.calls)
  assert.equal(harness.html.length, before.html)
  assert.equal(await invoke(harness, 'mys.panel', group('mallory'), 'gs'), '没有已绑定的游戏角色。')
  assert.equal(harness.calls.length, before.calls)
  assert.equal(harness.html.length, before.html)
  assert.ok(harness.calls.some(call => call.url.includes('/character/detail')))
})

test('character 后 panel 和 record panel 每次查询账号概览，不显示装备行迹也不覆盖角色快照', async () => {
  const harness = panelContext()
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await seedAccount(accounts, 'alice', '111', '100')
  assert.equal(await invoke(harness, 'mys.character', group('alice'), 'gs', '旅行者'), 'image')
  assert.match(harness.html.at(-1)!, /测试装备/)
  assert.match(harness.html.at(-1)!, /测试行迹/)
  const snapshots = structuredClone(await harness.ctx.database.get('miyoushe_panel', {}))
  assert.equal(snapshots.length, 1)
  assert.match(snapshots[0].data, /测试装备/)

  const queries = [
    ['mys.panel', ['gs']],
    ['mys.panel', ['gs']],
    ['mys.record', ['gs', 'panel']],
  ] as const
  for (const [index, [command, args]] of queries.entries()) {
    const start = harness.calls.length
    const renders = harness.html.length
    assert.match(String(await invoke(harness, command, group('alice'), ...args)), /img/)
    assert.equal(harness.html.length, renders + 1)
    const body = harness.html.at(-1)!.match(/<body>[\s\S]*<\/body>/)![0]
    assert.match(body, new RegExp(`Alice-${index + 1}`))
    assert.match(body, /UID 100/)
    assert.match(body, /https:\/\/assets\.example\.test\/user\.png/)
    assert.match(body, /https:\/\/assets\.example\.test\/traveler\.png/)
    assert.match(body, /<strong>旅行者<\/strong>/)
    assert.match(body, /character-grid/)
    assert.match(harness.html.at(-1)!, /repeat\(5,minmax\(0,1fr\)\)/)
    assert.doesNotMatch(body, /角色数|挑战|区服|角色列表|cn_gf01/)
    assert.doesNotMatch(body, /测试装备|测试行迹|光锥|遗器|行迹|角色属性|攻击力/)
    const calls = harness.calls.slice(start)
    assert.equal(calls.filter(call => call.url.includes('/index?')).length, 1)
    assert.equal(calls.filter(call => call.url.includes('/character/list')).length, 1)
    assert.ok(calls.every(call => !call.url.includes('/character/detail')))
    assert.deepEqual(await harness.ctx.database.get('miyoushe_panel', {}), snapshots)
  }

  const renders = harness.html.length
  const start = harness.calls.length
  const overview = await invoke(harness, 'mys.record', group('alice'), 'gs', 'overview')
  assert.match(String(overview), /原神账号概览/)
  assert.match(String(overview), /Alice-4/)
  assert.match(String(overview), /旅行者/)
  assert.doesNotMatch(String(overview), /角色数|区服|挑战/)
  assert.doesNotMatch(String(overview), /测试装备|测试行迹|光锥|遗器|攻击力/)
  assert.equal(harness.html.length, renders)
  assert.equal(harness.calls.slice(start).filter(call => call.url.includes('/index?')).length, 1)
  assert.deepEqual(await harness.ctx.database.get('miyoushe_panel', {}), snapshots)

  const fallbackSession = { ...group('alice'), author: {}, event: { user: { avatar: 'https://assets.example.test/event-user.png' } } }
  assert.match(String(await invoke(harness, 'mys.panel', fallbackSession, 'gs')), /img/)
  assert.match(harness.html.at(-1)!, /https:\/\/assets\.example\.test\/event-user\.png/)
})

test('群聊星铁账号概览图片只保留已获取的数据且裁切到内容边界', async () => {
  const harness = context((url, options) => {
    assert.equal(options.headers.Cookie, 'ltuid=123;cookie_token=cookie-123')
    const path = new URL(url).pathname
    if (path.endsWith('/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (path.endsWith('/getUserGameRolesByCookie')) return { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } }
    if (path.endsWith('/index')) return { retcode: 0, data: { role: { nickname: '星铁玩家', level: 70, game_head_icon: 'https://assets.example.test/player.png' } } }
    if (path.endsWith('/role/basicInfo')) return { retcode: 0, data: { region_name: '星穹列车' } }
    if (path.endsWith('/avatar/basic')) return { retcode: 0, data: { avatar_list: [{ id: 1001, name: '三月七' }, { id: 1002, name: '丹恒' }] } }
    if (path.endsWith('/note')) return { retcode: 0, data: { current_stamina: 204, max_stamina: 300, reserve_stamina: 0, weekly_cocoon_cnt: 2 } }
    if (path.endsWith('/challenge')) return { retcode: 0, data: { max_floor: '混沌回忆·第12层', all_floor_detail: [{ name: '混沌回忆·第12层', star_num: 3, extra_star_num: 1 }] } }
    if (path.endsWith('/challenge_story')) return { retcode: 0, data: { max_floor: '虚构叙事·第4关', all_floor_detail: [{ name: '虚构叙事·第4关', star_num: 2, extra_star_num: 1, score: 10241 }] } }
    if (path.endsWith('/challenge_boss')) return { retcode: 0, data: { max_floor: '末日幻影·难度04', all_floor_detail: [{ name: '末日幻影·难度04', star_num: 3, extra_star_num: 1, score: 10241 }] } }
    if (path.endsWith('/challenge_peak')) return { retcode: 0, data: { challenge_peak_records: [{ group: { name_mi18n: '王棋赛季' }, boss_stars: 2, mob_stars: 7, boss_info: { name_mi18n: '末日兽' } }], challenge_peak_best_record_brief: { total_battle_num: 5 } } }
    assert.fail(`未预期的请求：${url}`)
  })
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await accounts.save('onebot', 'alice', '123', 'ltuid=123;cookie_token=cookie-123', [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }])
  for (const [command, args] of [
    ['mys.panel', []],
    ['mys.record', ['sr', 'overview']],
  ] as const) {
    const start = harness.calls.length
    const response = await invoke(harness, command, group('alice'), ...args)
    const output = command === 'mys.panel' || args[1] === 'overview' ? harness.html.at(-1)! : String(response)
    if (command === 'mys.panel') assert.match(String(response), /img/)
    if (command === 'mys.panel') {
      assert.match(output, /星铁玩家/)
      assert.match(output, /UID 200/)
      assert.match(output, /三月七/)
      assert.match(output, /丹恒/)
      assert.match(output, /image\/character\/1001_Splash\.png/)
      assert.match(output, /repeat\(5,minmax\(0,1fr\)\)/)
      assert.doesNotMatch(output, /忘却之庭|虚构叙事|末日幻影|异相仲裁|挑战|角色数|区服|prod_gf_cn/)
    } else {
      assert.match(String(response), /img/)
      assert.match(output, /星铁玩家/)
      assert.match(output, /Lv\.70/)
      assert.match(output, /星穹列车/)
      assert.match(output, /UID 200/)
      assert.match(output, /204\/300/)
      assert.match(output, /历战余响/)
      assert.match(output, /<b>2\/3<\/b>/)
      assert.match(output, /挑战记录/)
      assert.match(output, /混沌回忆·第12层/)
      assert.match(output, /虚构叙事·第4关/)
      assert.match(output, /末日幻影·难度04/)
      assert.match(output, /王棋赛季/)
      assert.match(output, /末日兽/)
      assert.match(output, /extra-star/)
      assert.match(output, /★★☆/)
      assert.match(output, /7 星/)
      assert.doesNotMatch(output, /每日实训|周期积分|暂无数据/)
      assert.doesNotMatch(output, /500\/500|18000\/18000/)
      assert.match(output, /width:800px/)
      assert.doesNotMatch(output, /body\{margin:0;padding:10px/)
    }
    const paths = harness.calls.slice(start).map(call => new URL(call.url).pathname)
    for (const suffix of ['/index', '/role/basicInfo', '/avatar/basic']) assert.equal(paths.filter(path => path.endsWith(suffix)).length, 1)
    if (command === 'mys.record') {
      assert.equal(paths.filter(path => path.endsWith('/note')).length, 1)
      assert.equal(paths.filter(path => path.includes('/challenge')).length, 4)
    } else assert.ok(paths.every(path => !path.includes('/challenge')))
  }
  assert.deepEqual(await harness.ctx.database.get('miyoushe_panel', {}), [])
})

test('apocalypse 省略 UID 时使用当前角色，并允许指定上期期数', async () => {
  const harness = context(url => {
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) return { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } }
    if (url.includes('/challenge_boss')) return { retcode: 0, data: { groups: [{ status: 'End', name: '上期末日幻影' }] } }
    return { retcode: 0, data: {} }
  })
  const accounts = createAccounts(harness.ctx as never, harness.key)
  await accounts.save('onebot', 'alice', '123', 'ltuid=123;cookie_token=cookie-123', [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }])

  const response = await invoke(harness, 'mys.record', direct('alice'), 'sr', 'apocalypse', '2')
  assert.match(String(response), /上期末日幻影/)
  const call = harness.calls.find(item => item.url.includes('/challenge_boss'))
  assert.ok(call)
  assert.match(call.url, /role_id=200/)
  assert.match(call.url, /schedule_type=2/)
})

test('二维码确认后保存凭证并处理无角色账号的稍后同步', async () => {
  let discoverCount = 0
  let statusCount = 0
  const sent: unknown[] = []
  const harness = context(url => {
    if (url.includes('/device-fp/api/getFp')) return { retcode: 0, data: { device_fp: 'fingerprint-123456' } }
    if (url.includes('createQRLogin')) return { retcode: 0, data: { url: 'https://www.miyoushe.com/scan', ticket: 'ticket-1' } }
    if (url.includes('queryQRLoginStatus')) {
      statusCount++
      return statusCount === 1
        ? { retcode: 0, data: { status: 'Scanned' } }
        : { retcode: 0, data: { status: 'Confirmed', tokens: [{ token: 'stoken-1' }], user_info: { aid: 789, mid: 'mid-1' } } }
    }
    if (url.includes('/exchange')) return { retcode: 0, data: { token: { token: 'ltoken-1' } } }
    if (url.includes('getCookieAccountInfoBySToken')) return { retcode: 0, data: { cookie_token: 'cookie-1' } }
    if (url.includes('/binding/api/getUserGameRolesByCookie')) {
      discoverCount++
      return discoverCount < 3 ? { retcode: 0, data: { list: [] } } : { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: '7890', region: 'cn_gf01' }] } }
    }
    return { retcode: 0, data: { nickname: 'Synced later' } }
  })
  const session = { ...direct('alice'), send: async (message: unknown) => { sent.push(message) } }
  const originalSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = ((callback: (...args: any[]) => void) => { callback(); return 0 as any }) as typeof setTimeout
  try {
    const result = await invoke(harness, 'mys.qr', session)
    assert.equal(result, '通行证 789 的凭证已保存，暂未发现游戏角色；下次面板或记录查询会重新同步。')
    assert.equal(statusCount, 2)
    assert.equal(sent.length, 2)
    const accounts = createAccounts(harness.ctx as never, harness.key)
    assert.equal((await accounts.passport('onebot', 'alice', '789'))?.cookie.length! > 0, true)
    assert.deepEqual(await accounts.roles('onebot', 'alice'), [])
    assert.match(String(await invoke(harness, 'mys.record', direct('alice'), 'gs')), /Synced later/)
    assert.equal((await accounts.roles('onebot', 'alice'))[0]?.uid, '7890')
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }
})

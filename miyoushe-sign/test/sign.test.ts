import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { createAccounts, GameRole, parseCookie } from '../src/accounts'
import { createClient } from '../src/client'
import { createRecords } from '../src/records'
import { createPanel } from '../src/panel'
import { runAutoPassport } from '../src/automation'
import { scoreFribbelsRelic, scoreFribbelsSet, FribbelsRelicInput } from '../src/fribbels-score'

function database() {
  const tables = new Map<string, Map<string, any>>()
  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, new Map())
    return tables.get(table)!
  }
  return {
    tables,
    model: { extend() {} },
    database: {
      async get(table: string, query: Record<string, unknown>) {
        return [...rows(table).values()].filter(row => Object.entries(query).every(([field, value]) => row[field] === value))
      },
      async upsert(table: string, items: any[]) { items.forEach(item => rows(table).set(item.id, item)) },
      async set(table: string, query: { id: string }, changes: object) { Object.assign(rows(table).get(query.id), changes) },
      async remove(table: string, query: { id: string }) { rows(table).delete(query.id) },
    },
  }
}

test('CK and SToken require complete credentials', () => {
  assert.equal(parseCookie('ltuid=123;ltoken=abc;cookie_token=def', 'ck').ltuid, '123')
  assert.equal(parseCookie('stuid=123;stoken=abc;ltoken=def', 'stoken').ltuid, '123')
  assert.throws(() => parseCookie('ltuid=123;ltoken=abc', 'ck'))
  assert.throws(() => parseCookie('stuid=123;stoken=abc', 'stoken'))
  assert.throws(() => parseCookie('ltuid=123;account_id=456;cookie_token=abc', 'ck'))
})

test('one passport shares encrypted CK and device among roles; current UID is per game', async () => {
  const ctx = database()
  const accounts = createAccounts(ctx as never, randomBytes(32).toString('base64'))
  const discovered = [{ game: 'gs' as const, uid: '100', region: 'cn_gf01' }, { game: 'gs' as const, uid: '101', region: 'cn_qd01' }, { game: 'sr' as const, uid: '200', region: 'prod_gf_cn' }]
  await accounts.save('qq', 'alice', '123', 'ltuid=123;cookie_token=secret', discovered)
  assert.equal((await accounts.roles('qq', 'alice')).length, 3)
  assert.equal((await accounts.roles('qq', 'alice')).filter(role => role.current).length, 2)
  assert.equal(await accounts.choose('qq', 'alice', 'gs', '101'), true)
  assert.equal((await accounts.roles('qq', 'alice')).find(role => role.uid === '101')?.current, true)
  assert.equal(await accounts.choose('qq', 'bob', 'gs', '101'), false)
  assert.equal(await accounts.setDevice('qq', 'alice', '123', { deviceId: 'device-12345', deviceFp: 'fingerprint-12345' }), true)
  assert.equal(await accounts.device('qq', 'alice', '123', async device => device?.deviceId), 'device-12345')
  assert.equal(await accounts.setDevice('qq', 'bob', '123'), false)
  assert.equal(await accounts.use('qq', 'alice', '123', 'ck', async secret => secret), 'ltuid=123;cookie_token=secret')
  await assert.rejects(accounts.use('qq', 'bob', '123', 'ck', async secret => secret))
  assert.ok(!JSON.stringify([...ctx.tables.values()].flatMap(table => [...table.values()])).includes('cookie_token=secret'))
  assert.ok(!JSON.stringify([...ctx.tables.values()].flatMap(table => [...table.values()])).includes('fingerprint-12345'))
  await accounts.save('qq', 'alice', '123', 'ltuid=123;cookie_token=new', discovered)
  assert.equal((await accounts.roles('qq', 'alice')).find(role => role.uid === '101')?.current, true)
  await accounts.save('qq', 'alice', '123', 'ltuid=123;cookie_token=refreshed', discovered.filter(role => role.uid !== '101'))
  assert.equal((await accounts.roles('qq', 'alice')).find(role => role.uid === '100')?.current, true)
  await accounts.remove('qq', 'alice', '123')
  assert.equal((await accounts.roles('qq', 'alice')).length, 0)
})

test('CK and SToken can be bound, enabled and removed independently', async () => {
  const ctx = database()
  const accounts = createAccounts(ctx as never, randomBytes(32).toString('base64'))
  assert.equal(await accounts.saveToken('qq', 'alice', '123', 'stuid=123;stoken=secret;ltoken=token'), true)
  assert.equal(await accounts.setCommunityEnabled('qq', 'alice', '123', true), true)
  assert.equal(await accounts.setEnabled('qq', 'alice', '123', true), false)
  await accounts.save('qq', 'alice', '123', 'ltuid=123;cookie_token=ck', [{ game: 'gs', uid: '100', region: 'cn_gf01' }])
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.communityEnabled, true)
  assert.equal(await accounts.setEnabled('qq', 'alice', '123', true), true)
  assert.equal(await accounts.remove('qq', 'alice', '123'), true)
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.cookie, '')
  assert.equal(await accounts.use('qq', 'alice', '123', 'stoken', async secret => secret), 'stuid=123;stoken=secret;ltoken=token')
  assert.equal(await accounts.removeToken('qq', 'alice', '123'), true)
  assert.equal(await accounts.passport('qq', 'alice', '123'), undefined)
})

test('automatic missions follow the first scheduled game sign once per day, including after restart', async () => {
  const ctx = database()
  const key = randomBytes(32).toString('base64')
  const accounts = createAccounts(ctx as never, key)
  await accounts.save('qq', 'alice', '123', 'ltuid=123;cookie_token=ck', [
    { game: 'sr', uid: '200', region: 'prod_gf_cn' },
    { game: 'gs', uid: '100', region: 'cn_gf01' },
  ])
  await accounts.saveToken('qq', 'alice', '123', 'stuid=123;stoken=sk;ltoken=lt')
  await accounts.setCommunityEnabled('qq', 'alice', '123', true)
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.communityEnabled, true)
  assert.equal(await accounts.setFollowMissions('qq', 'alice', '123', true), true)
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.communityEnabled, false)
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.followMissions, true)
  const roles = await accounts.roles('qq', 'alice')
  const signed: string[] = []
  const forums: string[] = []
  const run = async (enabled: boolean, attempted = new Map<string, { date: string; count: number }>()) => {
    await accounts.setEnabled('qq', 'alice', '123', enabled)
    await runAutoPassport((await accounts.passport('qq', 'alice', '123'))!, roles, '2026-10-13', createAccounts(ctx as never, key), attempted, new Set(),
      async role => { signed.push(role.game); return { retry: false } },
      async role => { forums.push(role.game) })
  }
  await run(false)
  assert.deepEqual(signed, [])
  await run(true)
  assert.deepEqual(signed, ['sr', 'gs'])
  assert.deepEqual(forums, ['sr'])
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.lastMissionDay, '2026-10-13')
  await run(true)
  assert.deepEqual(forums, ['sr'])
  assert.equal(await accounts.setCommunityEnabled('qq', 'alice', '123', true), true)
  assert.equal((await accounts.passport('qq', 'alice', '123'))?.followMissions, false)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-13', 'scheduled'), false)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-14', 'scheduled'), true)
  assert.equal(await accounts.setFollowMissions('qq', 'alice', '123', true), true)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-14', 'follow'), false)
})

test('independent scheduled missions remain available without a game CK', async () => {
  const ctx = database()
  const accounts = createAccounts(ctx as never, randomBytes(32).toString('base64'))
  await accounts.saveToken('qq', 'alice', '123', 'stuid=123;stoken=sk;ltoken=lt')
  await accounts.setCommunityEnabled('qq', 'alice', '123', true)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-13', 'scheduled'), true)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-13', 'scheduled'), false)
  assert.equal(await accounts.setFollowMissions('qq', 'alice', '123', true), true)
  assert.equal(await accounts.markMissionDay('qq', 'alice', '123', '2026-10-14', 'follow'), false)
})

test('role discovery uses official list and filters unknown games', async () => {
  const calls: string[] = []
  const ctx = { http: async (url: string) => {
    calls.push(url)
    return { status: 200, data: { retcode: 0, data: { list: [
      { game_biz: 'hk4e_cn', game_uid: '100', region: 'cn_gf01' },
      { game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' },
      { game_biz: 'unknown', game_uid: '300', region: 'cn_gf01' },
    ] } } }
  } }
  const roles = await createClient(ctx as never, 5000, 0).discover('ltuid=123;cookie_token=secret')
  assert.deepEqual(roles, [{ game: 'gs', uid: '100', region: 'cn_gf01' }, { game: 'sr', uid: '200', region: 'prod_gf_cn' }])
  assert.equal(calls.length, 1)
})

test('game sign uses discovered region and attached device', async () => {
  const calls: { url: string; options: any }[] = []
  let signed = false
  const ctx = { http: async (url: string, options: any) => {
    calls.push({ url, options })
    if (url.endsWith('/sign')) signed = true
    return { status: 200, data: { retcode: 0, data: { is_sign: signed } } }
  } }
  const role = { game: 'sr', region: 'prod_gf_cn', uid: '200' } as GameRole
  const result = await createClient(ctx as never, 5000, 0).game(role, 'ck', 'sr', { deviceId: 'device-12345', deviceFp: 'fingerprint-12345' })
  assert.equal(result.done, true)
  assert.ok(calls[0].url.includes('/event/luna/hkrpg/info?'))
  assert.equal(calls[1].options.headers['x-rpc-device_fp'], 'fingerprint-12345')
  assert.equal(calls[1].options.headers['x-rpc-signgame'], 'hkrpg')
  assert.match(calls[1].options.headers['User-Agent'], /miHoYoBBS\/2\.73\.1/)
})

test('record requires ownership and queries SR challenge types', async () => {
  const calls: string[] = []
  let owned = false
  const ctx = { http: async (url: string) => {
    calls.push(url)
    return { status: 200, data: url.includes('/binding/')
      ? { retcode: 0, data: { list: owned ? [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] : [] } }
      : { retcode: 0, data: { total_star: 36 } } }
  } }
  const records = createRecords(createClient(ctx as never, 5000, 0))
  const role = { game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole
  assert.match(await records.query(role, 'ck', 'forgotten'), /未绑定该游戏 UID/)
  assert.equal(calls.length, 2)
  owned = true
  for (const [type, path] of [['forgotten', 'challenge'], ['fiction', 'challenge_story'], ['apocalypse', 'challenge_boss'], ['anomaly', 'challenge_peak']] as const) {
    const output = await records.query(role, 'ck', type, 2)
    assert.match(output, type === 'anomaly' ? /暂无王棋记录/ : /总星数：36/)
    assert.ok(calls.at(-1)!.includes(`/hkrpg/api/${path}?`))
  }
})

test('SR forgotten formats max floor and stars without exposing API field names', async () => {
  const ctx = { http: async (url: string) => ({ status: 200, data: url.includes('/binding/')
    ? { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } }
    : { retcode: 0, data: { max_floor: '混沌回忆·第12层', all_floor_detail: [{ name: '混沌回忆·第12层', star_num: 3 }] } } }) }
  const records = createRecords(createClient(ctx as never, 5000, 0))
  const output = await records.query({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, 'ck', 'forgotten')
  assert.match(output, /最高通关：混沌回忆·第12层（3 星）/)
  assert.doesNotMatch(output, /max_floor|all_floor_detail/)
})

test('SR challenge selects active group and combines floor node scores', async () => {
  const calls: string[] = []
  const ctx = { http: async (url: string) => {
    calls.push(url)
    if (url.includes('/binding/')) return { status: 200, data: { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } } }
    if (url.includes('challenge_brief')) return { status: 200, data: { retcode: 0, data: { list: [{ challenge_type: 'Story', cur_schedule: { finish_star_count: 10, total_star_count: 12 } }] } } }
    if (url.includes('/index?')) return { status: 200, data: { retcode: 0, data: { active_days: 100 } } }
    return { status: 200, data: { retcode: 0, data: { groups: [{ status: 'New', name: '新一期' }, { status: 'End', name: '旧一期' }], all_floor_detail: [{ name: '第一关', node_1: { score: 100 }, node_2: { score: 200 } }] } } }
  } }
  const records = createRecords(createClient(ctx as never, 5000, 0))
  const role = { game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole
  assert.match(await records.query(role, 'ck', 'fiction', 1), /新一期/)
  assert.match(await records.query(role, 'ck', 'fiction', 2), /旧一期/)
  assert.match(await records.query(role, 'ck', 'fiction', 1), /关卡：第一关，得分 300/)
  assert.match(await records.query(role, 'ck', 'overview'), /Story：10\/12/)
  assert.ok(calls.some(url => url.includes('/challenge_brief?')))
})

test('SR challenge_peak formats the group and boss and knight stars', async () => {
  const ctx = { http: async (url: string) => {
    if (url.includes('/binding/')) return { status: 200, data: { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } } }
    return { status: 200, data: { retcode: 0, data: { challenge_peak_records: [
      { group: { name_mi18n: '王棋赛季', begin_time: '2026-10-01' }, boss_stars: 3, mob_stars: 6, boss_record: { has_challenge_record: true }, boss_info: { name_mi18n: '末日兽' } },
      { group: { name_mi18n: '上期王棋' }, boss_stars: 1, mob_stars: 2 },
    ], challenge_peak_best_record_brief: { total_battle_num: 4 } } } }
  } }
  const records = createRecords(createClient(ctx as never, 5000, 0))
  const role = { game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole
  const output = await records.query(role, 'ck', 'anomaly')
  assert.match(output, /周期：王棋赛季/)
  assert.match(output, /王棋：末日兽（3 星）/)
  assert.match(output, /骑士：6 星/)
  assert.match(output, /战斗次数：4/)
  assert.doesNotMatch(output, /challenge_peak_records|boss_stars/)
})

test('SR apocalypse formats floor progress in readable labels', async () => {
  const ctx = { http: async (url: string) => {
    if (url.includes('/binding/')) return { status: 200, data: { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }] } } }
    return { status: 200, data: { retcode: 0, data: {
      groups: [{ status: 'New', name: '本期末日幻影', total_star: 4 }],
      max_floor: '支配遗忘·难度04',
      all_floor_detail: [{ name: '支配遗忘·难度04星启模式', star_num: 4, score: 10241 }],
    } } }
  } }
  const records = createRecords(createClient(ctx as never, 5000, 0))
  const role = { game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole
  const output = await records.query(role, 'ck', 'apocalypse')
  assert.match(output, /赛季：本期末日幻影/)
  assert.match(output, /最高通关：支配遗忘·难度04星启模式（4 星），得分 10241/)
  assert.doesNotMatch(output, /max_floor|total_star|关卡数量/)
})

test('QR exchange and CK refresh never expose tokens in URL', async () => {
  const calls: { url: string; options: any }[] = []
  const ctx = { http: async (url: string, options: any) => {
    calls.push({ url, options })
    if (url.includes('createQRLogin')) return { status: 200, data: { retcode: 0, data: { url: 'https://passport-api.miyoushe.com/scan', ticket: 'ticket' } } }
    if (url.includes('queryQRLoginStatus')) return { status: 200, data: { retcode: 0, data: { status: 'Confirmed' } } }
    if (url.includes('/exchange')) return { status: 200, data: { retcode: 0, data: { token: { token: 'ltoken-value' } } } }
    return { status: 200, data: { retcode: 0, data: { cookie_token: 'cookie-value' } } }
  } }
  const client = createClient(ctx as never, 5000, 0)
  assert.equal((await client.qrCreate()).ticket, 'ticket')
  assert.equal((await client.qrStatus('ticket')).data?.status, 'Confirmed')
  assert.equal(await client.qrExchange('stoken-value', 123456789), 'ltoken-value')
  assert.match(await client.exchangeCookie('stuid=123;stoken=stoken-value;ltoken=ltoken-value', '123'), /cookie_token=cookie-value/)
  assert.ok(calls.every(call => !call.url.includes('stoken-value')))
  assert.equal(calls[2].options.data.src_token.token, 'stoken-value')
  assert.equal(calls[2].options.data.mid, 123456789)
})

test('v2 CK 换取保留完整认证字段并用于后续请求', async () => {
  const calls: { url: string; options: any }[] = []
  const secret = 'stuid=123;stoken_v2=stoken-v2;ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;account_mid_v2=account-mid-v2;'
  const ctx = { http: async (url: string, options: any) => {
    calls.push({ url, options })
    if (url.includes('getCookieAccountInfoBySToken')) {
      assert.equal(options.headers.Cookie, secret)
      return { status: 200, data: { retcode: 0, data: { cookie_token_v2: 'cookie-v2==' } } }
    }
    assert.equal(options.headers.Cookie, 'ltuid=123;account_mid_v2=account-mid-v2;cookie_token_v2=cookie-v2==;ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;')
    return { status: 200, data: { retcode: 0, data: {} } }
  } }
  const client = createClient(ctx as never, 5000, 0)
  const cookie = await client.exchangeCookie(secret, '123')
  assert.equal(cookie, 'ltuid=123;account_mid_v2=account-mid-v2;cookie_token_v2=cookie-v2==;ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;')
  await client.record('https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index', cookie)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => !call.url.includes('stoken-v2') && !call.url.includes('cookie-v2')))
})

test('传统 CK 响应仍保留 v2 LToken 与 mid 认证字段', async () => {
  const calls: { url: string; options: any }[] = []
  const secret = 'stuid=123;stoken_v2=stoken-v2;ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;account_mid_v2=account-mid-v2;'
  const ctx = { http: async (url: string, options: any) => {
    calls.push({ url, options })
    if (url.includes('getCookieAccountInfoBySToken')) return { status: 200, data: { retcode: 0, data: { cookie_token: 'cookie-value' } } }
    assert.equal(options.headers.Cookie, 'ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;account_mid_v2=account-mid-v2;ltuid=123;cookie_token=cookie-value;account_id=123;')
    return { status: 200, data: { retcode: 0, data: {} } }
  } }
  const client = createClient(ctx as never, 5000, 0)
  const cookie = await client.exchangeCookie(secret, '123')
  assert.equal(cookie, 'ltoken_v2=ltoken-v2==;ltmid_v2=mid-v2;account_mid_v2=account-mid-v2;ltuid=123;cookie_token=cookie-value;account_id=123;')
  await client.record('https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index', cookie)
  assert.equal(calls.length, 2)
})

test('device fingerprint uses scoped host and preserves device ID', async () => {
  const ctx = { http: async (url: string, options: any) => {
    assert.match(url, /^https:\/\/public-data-api\.mihoyo\.com\/device-fp\/api\/getFp$/)
    assert.equal(options.data.device_id, 'device-12345')
    return { status: 200, data: { retcode: 0, data: { device_fp: 'fingerprint-12345' } } }
  } }
  assert.equal(await createClient(ctx as never, 5000, 0).fingerprint('device-12345', false, 'ck'), 'fingerprint-12345')
})

test('Star Rail panel uses MiYouShe data and calculates True Pearl stats from relics', async () => {
  const longImage = `https://assets.example.test/${'character-art/'.repeat(10)}portrait.png`
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new Error('面板不应依赖 Mihomo 展示列表') }) as typeof fetch
  const calls: { url: string; options: any }[] = []
  const relics = [
    { id: 61011, rarity: 5, type: 1, level: 15, set_id: '101', name: '头部', main_property: { property_type: 'HPDelta' }, properties: [{ property_type: 'DefenceAddedRatio', times: 3, value: '16.2%' }] },
    { id: 61012, rarity: 5, type: 2, level: 15, set_id: '101', name: '手部', main_property: { property_type: 'AttackDelta' }, properties: [{ property_type: 'SpeedDelta', times: 3, value: '6' }] },
    { id: 61013, rarity: 5, type: 3, level: 15, set_id: '101', name: '躯干', main_property: { property_type: 'HealRatioBase' }, properties: [{ property_type: 'AttackAddedRatio', times: 4, value: '17.2％' }] },
    { id: 61014, rarity: 5, type: 4, level: 15, set_id: '101', name: '脚部', main_property: { property_type: 'DefenceAddedRatio' }, properties: [{ property_type: 'CriticalChanceBase', times: 2, value: '6.4%' }] },
    { id: 63015, rarity: 5, type: 5, level: 15, set_id: '301', name: '位面球', main_property: { property_type: 'DefenceAddedRatio' }, properties: [{ property_type: 'CriticalDamageBase', times: 2, value: '12.9%' }] },
    { id: 63016, rarity: 5, type: 6, level: 15, set_id: '301', name: '连结绳', main_property: { property_type: 'EnergyRecoveryRateBase' }, properties: [{ property_type: 'StatusResistanceBase', times: 2, value: '8.6%' }] },
  ]
  const character = { id: 1503, name: '真珠', rarity: 5, rank: 0, level: 80, portrait: longImage, icon: 'icon/character/1503.png', skills: [
    { point_id: '150301', type_text: '普攻', level: 6 },
    ...Object.keys({ '1503201': 1, '1503202': 1, '1503203': 1, '1503204': 1, '1503205': 1, '1503206': 1, '1503207': 1, '1503208': 1, '1503209': 1, '1503210': 1 }).map(point_id => ({ point_id, type_text: '行迹', is_activated: true })),
  ], equip: { id: 21064, name: '菇菇嘎嘎历险记', level: 80, promote_level: 6, rank: 1 }, relics }
  let sourceCharacter = character
  const client = {
    discover: async () => [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }],
    record: async (url: string, _secret: string, _body?: object) => {
      calls.push({ url, options: {} })
    return { retcode: 0, data: { avatar_list: [
      sourceCharacter,
      { id: 1301, name: '非展示角色', rarity: 5, level: 80, attributes: [{ name: '生命值', value: '4,000' }] },
    ] } }
    },
  }
  try {
    const records = createRecords(client as never)
    globalThis.fetch = (async () => new Response(JSON.stringify({ characters: [{
      id: '1503', name: '真珠', level: 80, promotion: 6, portrait: 'image/character_portrait/1503.png',
      statistics: [{ field: 'hp', name: '生命值', value: 3873.2, display: '3873' }],
      attributes: [{ field: 'hp', value: 2212.05 }],
      additions: [{ field: 'hp', value: 1661.2 }],
      skills: [{ id: '150301', name: '普攻', level: 6 }],
    }] }), { status: 200 })) as typeof fetch
    const panel = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
    assert.equal(typeof panel, 'object')
    if (typeof panel === 'string') throw new Error(panel)
    const character = panel.characters[0]
    assert.ok(calls.some(call => call.url.includes('/avatar/info?')))
    assert.equal(character.image, longImage)
    assert.equal(character.icon, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/character/1503.png')
    assert.equal(character.stats.find(item => item.name === '生命值')?.value, '2755')
    assert.equal(character.calculatedStats?.find(item => item.name === '生命值')?.value, '2755')
    assert.equal(character.traces[0].icon, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/skill/1503_basic_atk.png')
    assert.equal(character.calculatedStats?.find(item => item.name === '速度')?.value, '114')
    assert.equal(character.calculatedStats?.find(item => item.name === '效果抵抗')?.value, '18.6%')
    assert.equal(character.calculatedStats?.find(item => item.name === '欢愉度')?.value, '22.0%')
    assert.equal(character.calculatedStats?.find(item => item.name === '能量恢复效率')?.value, '119.4%')
    assert.equal(character.calculatedStats?.find(item => item.name === '治疗量加成')?.value, '44.5%')
    assert.equal(character.calculatedStats?.find(item => item.name === '暴击率')?.value, '11.4%')
    assert.equal(character.calculatedStats?.length, 13)
    assert.equal(character.lightCone?.icon, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/light_cone/21064.png')
    assert.equal(character.relics[0].icon, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/relic/101_0.png')
    assert.ok(Math.abs(character.relics[0].mainValue! - 705.6) < 1e-8)
    assert.ok(Math.abs(character.relics[1].mainValue! - 352.8) < 1e-8)
    assert.ok(Math.abs((character.relics[0].subProperties?.[0].value || 0) - 0.162) < 1e-9)
    assert.deepEqual(character.statDetails, [])
    globalThis.fetch = (async () => { throw new Error('Mihomo unavailable') }) as typeof fetch
    const offline = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
    assert.notEqual(typeof offline, 'string')
    if (typeof offline !== 'string') assert.deepEqual(offline.characters[0].stats, character.stats)
    const completeSource = sourceCharacter
    sourceCharacter = { ...completeSource, relics: completeSource.relics.map((relic, index) => index ? relic : { ...relic, properties: [{ property_type: 'DefenceAddedRatio', times: 3 }] }) }
    const incomplete = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
    assert.notEqual(typeof incomplete, 'string')
    if (typeof incomplete !== 'string') assert.deepEqual(incomplete.characters[0].calculatedStats, [])
    sourceCharacter = { ...completeSource, skills: [{ point_id: '150301', type_text: '普攻', level: 6 }] }
    const inactive = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
    assert.notEqual(typeof inactive, 'string')
    if (typeof inactive !== 'string') assert.equal(inactive.characters[0].stats.find(item => item.name === '欢愉度')?.value, '12.0%')
    sourceCharacter = completeSource
    globalThis.fetch = (async () => new Response(JSON.stringify({ characters: [{ id: '1503', statistics: [] }] }), { status: 200 })) as typeof fetch
    const hidden = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '非展示角色')
    assert.equal(typeof hidden, 'object')
    if (typeof hidden !== 'string') assert.equal(hidden.characters[0].name, '非展示角色')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('MiYouShe numeric property_info resolves relic affixes and keeps character plus cone white stats', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('面板不应依赖 Mihomo 展示列表') })
  const property_info = {
    1: { property_name: '生命值', property_name_filter: '生命值', is_percent: false },
    2: { property_name: '攻击力', property_name_filter: '攻击力', is_percent: false },
    3: { property_name: '防御力', property_name_filter: '防御力', is_percent: false },
    4: { property_name: '速度', property_name_filter: '速度', is_percent: false },
    5: { property_name: '暴击率', property_name_filter: '暴击率', is_percent: true },
    6: { property_name: '暴击伤害', property_name_filter: '暴击伤害', is_percent: true },
    7: { property_name: '治疗量加成', property_name_filter: '治疗量加成', is_percent: true },
    8: { property_name: '能量恢复效率', property_name_filter: '能量恢复效率', is_percent: true },
    19: { property_name: '生命值', property_name_filter: '生命值百分比', is_percent: true },
    20: { property_name: '攻击力', property_name_filter: '攻击力百分比', is_percent: true },
    21: { property_name: '防御力', property_name_filter: '防御力百分比', is_percent: true },
    99: { property_name: '未知属性', property_name_filter: '未知属性', is_percent: false },
  }
  const relics = [
    { id: 61011, type: 1, main_property: { property_type: 1, value: '705' }, properties: [{ property_type: 21, value: '16.2%' }, { property_type: 19, value: '10.0%' }] },
    { id: 61012, type: 2, main_property: { property_type: 2, value: '352' }, properties: [{ property_type: 4, value: 6 }, { property_type: 3, value: 40 }] },
    { id: 61013, type: 3, main_property: { property_type: 7, value: '34.5%' }, properties: [{ property_type: 20, value: '17.2%' }, { property_type: 1, value: 100 }] },
    { id: 61014, type: 4, main_property: { property_type: 21, value: '54.0%' }, properties: [{ property_type: 5, value: '6.4%' }, { property_type: 2, value: 20 }] },
    { id: 63015, type: 5, main_property: { property_type: 21 }, properties: [{ property_type: 6, value: '12.9%' }] },
    { id: 63016, type: 6, main_property: { property_type: 8 }, properties: [{ property_type: 4, value: 0 }, { property_type: 4, value: 99, is_preview: true }] },
  ].map(relic => ({ ...relic, rarity: 5, level: 15 }))
  const avatar = { id: 1503, name: '真珠', level: 80, promote_level: 6, equip: { id: 21064, name: '菇菇嘎嘎历险记', level: 80, promote_level: 6, rank: 1 }, relics }
  const records = createRecords({
    discover: async () => [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }],
    record: async () => ({ retcode: 0, data: { avatar_list: [avatar], property_info } }),
  } as never)
  const query = async () => {
    const panel = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
    if (typeof panel === 'string') throw new Error(panel)
    return panel.characters[0]
  }
  const character = await query()
  assert.deepEqual(character.relics.map(relic => relic.mainFinalPropertyType), ['HPDelta', 'AttackDelta', 'HealRatioBase', 'DefenceAddedRatio', 'DefenceAddedRatio', 'SPRatioBase'])
  assert.ok(character.relics.every(relic => relic.mainComplete && relic.subComplete))
  assert.ok(Math.abs(character.relics[0].mainValue! - 705.6) < 1e-8)
  assert.ok(Math.abs(character.relics[1].mainValue! - 352.8) < 1e-8)
  assert.deepEqual(character.relics[0].subProperties, [{ type: 'DefenceAddedRatio', value: 0.162, exact: true }, { type: 'HPAddedRatio', value: 0.1, exact: true }])
  assert.deepEqual(character.relics[5].subProperties, [{ type: 'SpeedDelta', value: 0, exact: true }])
  const stats = Object.fromEntries(character.stats.map(stat => [stat.name, stat.value]))
  const hpWhite = (556.512 + 8.184 * 79) + (391.68 + 5.76 * 79)
  const atkWhite = (215.424 + 3.168 * 79) + (220.32 + 3.24 * 79)
  const defWhite = (336.6 + 4.95 * 79) + (183.6 + 2.7 * 79)
  assert.equal(stats['生命值'], String(Math.floor(hpWhite * 1.1 + 705.6 + 100)))
  assert.equal(stats['攻击力'], String(Math.floor(atkWhite * (1 + 0.172 + 0.12) + 352.8 + 20)))
  assert.equal(stats['防御力'], String(Math.floor(defWhite * (1 + 0.54 * 2 + 0.162) + 40)))
  assert.equal(stats['速度'], '105')
  assert.equal(stats['治疗量加成'], '44.5%')
  assert.equal(stats['能量恢复效率'], '119.4%')
  assert.equal(stats['暴击率'], '11.4%')
  assert.equal(stats['暴击伤害'], '62.9%')
  property_info[19].property_name_filter = '生命值'
  property_info[20].property_name_filter = '攻击力'
  property_info[21].property_name_filter = '防御力'
  assert.deepEqual((await query()).stats, character.stats)
  relics[0].main_property.property_type = 99
  const unknownMain = await query()
  assert.equal(unknownMain.relics[0].mainComplete, false)
  assert.deepEqual(unknownMain.calculatedStats, [])
  relics[0].main_property.property_type = 1
  relics[0].properties.push({ property_type: 99, value: 10 })
  assert.deepEqual((await query()).calculatedStats, [])
})

test('records integrates parsed relic scores for supported characters and exposes unavailable reasons', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('不应请求展示面板') })
  const inputs: FribbelsRelicInput[] = [
    { slot: 'HEAD', main: 'HPDelta' },
    { slot: 'HAND', main: 'AttackDelta' },
    { slot: 'BODY', main: 'CriticalChanceBase' },
    { slot: 'FOOT', main: 'SpeedDelta' },
    { slot: 'OBJECT', main: 'ImaginaryAddedRatio' },
    { slot: 'NECK', main: 'SPRatioBase' },
  ].map(input => ({ ...input, rarity: 5, subStats: [{ type: 'CriticalDamageBase', value: 0.19439 }] }))
  const relics = inputs.map((input, index) => ({
    id: index < 4 ? 61011 + index : 63011 + index, type: index + 1, rarity: 5, level: 15,
    main_property: { property_type: index + 1 },
    properties: [{ property_type: 7, value: '19.439%' }, { property_type: 8, value: '99%', is_preview: true }],
  }))
  const property_info = {
    1: { property_name: '生命值', is_percent: false },
    2: { property_name: '攻击力', is_percent: false },
    3: { property_name: '暴击率', is_percent: true },
    4: { property_name: '速度', is_percent: false },
    5: { property_name: 'ImaginaryAddedRatio', is_percent: true },
    6: { property_name: '能量恢复效率', is_percent: true },
    7: { property_name: '暴击伤害', is_percent: true },
    8: { property_name: '攻击力百分比', is_percent: true },
  }
  let avatar: Record<string, unknown> = { id: 1213, name: '丹恒·饮月', relics }
  const records = createRecords({
    discover: async () => [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }],
    record: async () => ({ retcode: 0, data: { avatar_list: [avatar], property_info } }),
  } as never)
  const query = async () => {
    const panel = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined)
    if (typeof panel === 'string') throw new Error(panel)
    return panel.characters[0]
  }
  const character = await query()
  assert.deepEqual(character.relicScore, scoreFribbelsSet('1213', inputs))
  character.relics.forEach((relic, index) => assert.deepEqual(relic.score, scoreFribbelsRelic('1213', inputs[index])))
  assert.equal(character.relicScore?.status, 'supported')
  let rendered = ''
  const panel = createPanel({ ...database(), puppeteer: { render: async (html: string, callback: any) => {
    rendered = html
    return callback({ evaluate: async () => [], $: async () => ({}), close: async () => {} }, async () => 'image')
  } } } as never)
  const render = async (result: typeof character) => {
    const saved = await panel.save({ id: 'score-panel', platform: 'qq', userId: 'alice', game: 'sr', uid: '200' } as GameRole, '评分面板', '摘要', {
      game: 'sr', uid: '200', server: 'prod_gf_cn', characters: [result],
    })
    assert.equal(await panel.render(saved), 'image')
    return rendered.match(/<body>[\s\S]*<\/body>/)![0]
  }
  const supportedHtml = await render(character)
  const scores = [...supportedHtml.matchAll(/<div class="relic-score">([\s\S]*?)<\/div>/g)].map(match => match[1])
  assert.equal(scores.length, 7)
  assert.equal(character.relicScore.status, 'supported')
  if (character.relicScore.status !== 'supported') throw new Error(character.relicScore.reason)
  assert.ok(scores[0].includes(`<span>平均评分</span><b>${character.relicScore.averageScore.toFixed(1)} <em>${character.relicScore.averageGrade}</em></b>`))
  assert.ok(scores[0].includes(`总有效词条 ${character.relicScore.effectiveRolls.toFixed(1)}`))
  character.relicScore.relics.forEach((relic, index) => {
    assert.ok(scores[index + 1].includes('<span>遗器评分</span>'))
    assert.ok(scores[index + 1].includes(`<b>${relic.score.toFixed(1)} <em>${relic.grade}</em></b>`))
    assert.ok(scores[index + 1].includes(`有效词条 ${relic.effectiveRolls.toFixed(1)}`))
  })
  assert.match(supportedHtml, /评分来源：fribbels hsr-optimizer/)
  assert.doesNotMatch(supportedHtml, /class="score-note"/)
  const unavailableHtml = (html: string, status: string, count: number) => {
    const notes = [...html.matchAll(/<div class="score-note">([\s\S]*?)<\/div>/g)].map(match => match[1])
    assert.equal(notes.length, count)
    for (const note of notes) {
      assert.ok(note.includes(status))
      assert.doesNotMatch(note, /<b>|<em>|(?:主词条|副词条)\s*\d|(?:^|[^\d])0(?:\.0)?\s*(?:分|<)/)
    }
    return notes
  }
  const unavailable = (result: { status: string; reason?: string } | undefined, reason: RegExp, status = 'incomplete') => {
    assert.equal(result?.status, status)
    assert.match(result?.reason || '', reason)
    assert.equal(Object.hasOwn(result!, 'totalScore'), false)
    assert.equal(Object.hasOwn(result!, 'grade'), false)
  }
  for (const broken of [
    { ...relics[0], properties: [{ property_type: 7, times: 3 }] },
    { ...relics[0], main_property: { property_type: 999 } },
    { ...relics[0], properties: undefined },
    { ...relics[0], rarity: 1 },
  ]) {
    avatar = { id: 1213, relics: [broken, ...relics.slice(1)] }
    const incomplete = await query()
    unavailable(incomplete.relics[0].score, /不完整|五星|重复/)
    unavailable(incomplete.relicScore, /不完整|五星|重复/)
    assert.equal(incomplete.relics[1].score?.status, 'supported')
    const html = await render(incomplete)
    unavailableHtml(html, '数据不完整', 1)
    assert.equal(html.match(/class="relic-score"/g)?.length, 5)
    assert.doesNotMatch(html, /<span>平均评分<\/span><b>/)
  }
  for (const partial of [[], relics.slice(0, 5)]) {
    avatar = { id: 1213, relics: partial }
    unavailable((await query()).relicScore, /六个不同部位|六件遗器/)
  }
  avatar = { id: 1213, relics: [relics[0], relics[0], ...relics.slice(2)] }
  unavailable((await query()).relicScore, /部位不能重复/)
  avatar = { id: 9999, name: '未知角色', relics }
  const unsupported = await query()
  unavailable(unsupported.relicScore, /9999.*评分权重/, 'unsupported')
  unsupported.relics.forEach(relic => unavailable(relic.score, /9999.*评分权重/, 'unsupported'))
  assert.ok(JSON.stringify(unsupported).includes('不提供推测数值'))
  const unsupportedHtml = await render(unsupported)
  const unsupportedNotes = unavailableHtml(unsupportedHtml, '该角色暂无评分权重', 1)
  assert.match(unsupportedNotes[0], /^平均评分：/)
  assert.doesNotMatch(unsupportedHtml, /class="relic-score"|<em>E<\/em>|主词条 0\.0|副词条 0\.0/)
  avatar = { relics }
  const missingId = await query()
  unavailable(missingId.relicScore, /缺少角色 ID/)
  missingId.relics.forEach(relic => unavailable(relic.score, /缺少角色 ID/))
  const incompleteHtml = await render(missingId)
  unavailableHtml(incompleteHtml, '数据不完整', 1)
  assert.doesNotMatch(incompleteHtml, /class="relic-score"|<em>E<\/em>|主词条 0\.0|副词条 0\.0/)
})

test('fribbels scoring computes weighted effective rolls and relative piece score', () => {
  const piece: FribbelsRelicInput = {
    slot: 'HEAD',
    rarity: 5,
    main: 'HPDelta',
    subStats: [
      { type: 'HPAddedRatio', value: 0.16416 },
      { type: 'DefenceAddedRatio', value: 0.0432 },
      { type: 'CriticalChanceBase', value: 0.09396 },
      { type: 'CriticalDamageBase', value: 0.0648 },
    ],
  }
  const relic = scoreFribbelsRelic('1501', piece)
  assert.equal(relic.status, 'supported')
  if (relic.status !== 'supported') throw new Error(relic.reason)
  assert.ok(Math.abs(relic.effectiveRolls - 4.875) < 1e-9)
  assert.equal(relic.score, 44.5)
  assert.equal(relic.grade, 'A')
  assert.equal(relic.mainOk, true)

  const wrongMain = scoreFribbelsRelic('1501', { ...piece, slot: 'BODY', main: 'DefenceAddedRatio' })
  assert.equal(wrongMain.status, 'supported')
  if (wrongMain.status === 'supported') {
    assert.equal(wrongMain.mainOk, false)
    assert.equal(wrongMain.grade, '?')
    assert.equal(wrongMain.score, 48.4)
  }

  assert.equal(scoreFribbelsRelic('9999', piece).status, 'unsupported')
  assert.equal(scoreFribbelsRelic('1501', { ...piece, rarity: 4 }).status, 'incomplete')
  assert.equal(scoreFribbelsRelic('1501', { ...piece, main: 'NotAStat' }).status, 'incomplete')
  assert.equal(scoreFribbelsRelic('1501', { ...piece, subStats: [{ type: 'NotAStat', value: 1 }] }).status, 'incomplete')

  const pieces: FribbelsRelicInput[] = [
    piece,
    { ...piece, slot: 'HAND', main: 'AttackDelta' },
    { ...piece, slot: 'BODY', main: 'HealRatioBase' },
    { ...piece, slot: 'FOOT', main: 'SpeedDelta' },
    { ...piece, slot: 'OBJECT', main: 'AttackAddedRatio' },
    { ...piece, slot: 'NECK', main: 'EnergyRecoveryRateBase' },
  ]
  const set = scoreFribbelsSet('1501', pieces)
  assert.equal(set.status, 'supported')
  if (set.status !== 'supported') throw new Error(set.reason)
  const individual = pieces.map(input => {
    const result = scoreFribbelsRelic('1501', input)
    if (result.status !== 'supported') throw new Error(result.reason)
    return result
  })
  assert.deepEqual(set.relics, individual)
  assert.ok(Math.abs(set.effectiveRolls - individual.reduce((sum, item) => sum + item.effectiveRolls, 0)) < 1e-9)
  assert.equal(set.averageScore, Math.trunc((individual.reduce((sum, item) => sum + item.score, 0) / 6) * 10) / 10)
  assert.equal(scoreFribbelsSet('1501', pieces.slice(0, 5)).status, 'incomplete')
  assert.equal(scoreFribbelsSet('1501', [pieces[0], pieces[0], ...pieces.slice(2)]).status, 'incomplete')
})

test('Star Rail trace names resolve skill and tree IDs without using type labels as names', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ characters: [] }), { status: 200 }))
  const skills = [
    { id: '150301', type_text: '普攻', name: '接口技能名称', level: 6, is_activated: true },
    { point_id: '1503001', type_text: '普攻', level: 6, is_activated: true },
    { point_id: '1503002', type_text: '战技', level: 10, is_activated: true },
    { point_id: '1503003', type_text: '终结技', level: 10, is_activated: true },
    { point_id: '1503004', type_text: '天赋', level: 10, is_activated: true },
    { point_id: '1503007', level: 1, is_activated: false },
    { id: '150307', type: 'Maze', level: 1, is_activated: true },
    { id: '150320', type: 'ElationDamage', level: 10, is_activated: true },
    { point_id: '1503420', type_text: '欢愉技', level: 10, is_activated: false },
    { point_id: '1503101', type_text: '行迹', is_activated: true },
    { point_id: '1503102', type_text: '行迹', is_activated: false },
    { point_id: '1503103', type_text: '行迹', is_activated: true },
    { point_id: '1503201', type_text: '行迹', is_activated: false },
    { point_id: '1503204', type_text: '行迹', is_activated: true },
    { id: 'unknown', type_text: '秘技', skill_name: '未知技能真实名称', is_activated: false },
    { id: 'unnamed', type_text: '天赋' },
  ]
  const records = createRecords({
    discover: async () => [{ game: 'sr', uid: '200', region: 'prod_gf_cn' }],
    record: async () => ({ retcode: 0, data: { avatar_list: [{ id: 1503, name: '真珠', skill_tree: [{ skills }] }] } }),
  } as never)
  const panel = await records.queryPanel({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
  if (typeof panel === 'string') throw new Error(panel)
  const traces = panel.characters[0].traces
  assert.deepEqual(traces.map(trace => trace.name), [
    '接口技能名称', '行笔，临摹断水', '补缀生命的柔光', '鉴映灵魂的底色', '吞纳沙砾，重塑生机',
    '凝润珠光，复刻真迹', '凝润珠光，复刻真迹', '渲染理性，解构欢愉', '渲染理性，解构欢愉',
    '洞察万物', '感知容差', '艺术壁垒', '防御强化', '欢愉度强化', '未知技能真实名称', '行迹',
  ])
  assert.deepEqual(traces.map(trace => trace.category), [
    'main', 'main', 'main', 'main', 'main', 'main', 'main', 'main', 'main',
    'major', 'major', 'major', 'minor', 'minor', 'main', 'main',
  ])
  assert.deepEqual(traces.map(trace => trace.label), [
    '普攻', '普攻', '战技', '终结技', '天赋', '秘技', '秘技', '欢愉技', '欢愉技',
    '额外能力', '额外能力', '额外能力', '属性加成', '属性加成', '秘技', '天赋',
  ])
  assert.deepEqual(traces.map(trace => trace.active), skills.map(skill => skill.is_activated === true))
  assert.equal(traces[1].level, '6')
  assert.match(traces[8].icon!, /1503_elation\.png$/)
  assert.match(traces[9].icon!, /1503_skilltree1\.png$/)
})

test('panel snapshot is scoped and HTML-escaped', async () => {
  const ctx = database()
  let rendered = ''
  const panel = createPanel({ ...ctx, puppeteer: { render: async (html: string) => { rendered = html; return 'image' } } } as never)
  const role = { id: 'role', platform: 'qq', userId: 'alice', game: 'gs', uid: '100' } as GameRole
  const saved = await panel.save(role, '原神面板', '角色：<script>alert(1)</script>')
  assert.equal(await panel.get('qq', 'bob', role), undefined)
  assert.equal(await panel.render(saved), 'image')
  assert.ok(!rendered.includes('<script>'))
  assert.match(rendered, /&lt;script&gt;/)
  await panel.remove('qq', 'alice', [role])
  assert.equal(await panel.get('qq', 'alice', role), undefined)
})

test('structured panel shows every trace and propagates image failures', async () => {
  const ctx = database()
  let rendered = ''
  let failed = false
  const panel = createPanel({ ...ctx, puppeteer: { render: async (html: string, callback: any) => {
    rendered = html
    return callback({ evaluate: async () => failed ? ['https://example.test/broken.png'] : [], $: async () => ({}), close: async () => {} }, async () => 'image')
  } } } as never)
  const role = { id: 'sr', platform: 'qq', userId: 'alice', game: 'sr', uid: '200' } as GameRole
  const saved = await panel.save(role, '真珠面板', '摘要', { game: 'sr', uid: '200', server: 'prod_gf_cn', characters: [{
    id: '1503', name: '真珠', stats: [{ name: '生命值', value: '2755' }], calculatedStats: [{ name: '生命值', value: '2755' }], relics: [],
    traces: Array.from({ length: 19 }, (_, index) => ({ name: `节点${index}`, active: index % 2 === 0, category: index === 0 ? 'main' as const : index < 4 ? 'major' as const : 'minor' as const, label: index === 0 ? '普攻' : undefined, level: index === 0 ? '6' : '1' })),
  }] })
  assert.equal(await panel.render(saved), 'image')
  assert.match(rendered, /节点18/)
  assert.match(rendered, /已激活/)
  assert.match(rendered, /未激活/)
  assert.match(rendered, /class="trace-level">6<\/b>/)
  assert.equal(rendered.match(/class="trace-level"/g)?.length, 1)
  assert.match(rendered, /trace-major is-inactive/)
  assert.match(rendered, /trace-minor is-active/)
  assert.match(rendered, /class="trace-label">普攻<\/strong>/)
  assert.equal(rendered.match(/2755/g)?.length, 1)
  assert.match(rendered, /class="trace-legend"><i><\/i>已激活 <i class="dim"><\/i>未激活<\/div>/)
  const css = rendered.match(/<style>([\s\S]*?)<\/style>/)![1]
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  const declarations = (selector: string) => Object.fromEntries(rules
    .filter(rule => rule[1].trim() === selector)
    .flatMap(rule => rule[2].split(';').filter(declaration => declaration.includes(':')).map(declaration => {
      const separator = declaration.indexOf(':')
      return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()]
    })))
  const variables = declarations('.trace-block')
  assert.match(variables['--trace-active'], /^#[\da-f]{6}$/i)
  assert.match(variables['--trace-inactive'], /^#[\da-f]{6}$/i)
  assert.notEqual(variables['--trace-active'], variables['--trace-inactive'])
  assert.equal(declarations('.trace-node.is-active .trace-medallion')['border-color'], 'var(--trace-active)')
  assert.equal(declarations('.trace-node.is-inactive .trace-medallion')['border-color'], 'var(--trace-inactive)')
  assert.equal(declarations('.trace-legend i').background, 'var(--trace-active)')
  assert.equal(declarations('.trace-legend i.dim').background, 'var(--trace-inactive)')
  assert.equal(declarations('.trace-medallion:after').background, 'var(--trace-active)')
  assert.equal(declarations('.trace-node.is-inactive .trace-medallion:after').background, 'var(--trace-inactive)')
  failed = true
  await assert.rejects(panel.render(saved), /截图图片加载失败/)
  await assert.rejects(panel.render({ ...saved, data: '{invalid' }), SyntaxError)
})

test('True Pearl panel stats follow truncated relic substats and speed multiplier', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('面板不应依赖 Mihomo 展示列表') })
  const relic = (id: number, setId: string, type: number, main: string, properties: object[]) => ({
    id, rarity: 5, type, level: 15, set_id: setId, name: '遗器', main_property: { property_type: main }, properties,
  })
  const relics = [
    relic(61331, '133', 1, 'HPDelta', [
      { property_type: 'DefenceAddedRatio', times: 3, value: '14.5%' },
      { property_type: 'SpeedDelta', times: 3, value: '6' },
      { property_type: 'StatusResistanceBase', times: 1, value: '4.3%' },
      { property_type: 'BreakDamageAddedRatioBase', times: 1, value: '5.1%' },
    ]),
    relic(61332, '133', 2, 'AttackDelta', [
      { property_type: 'DefenceDelta', times: 1, value: '16' },
      { property_type: 'SpeedDelta', times: 1, value: '2' },
      { property_type: 'CriticalChanceBase', times: 3, value: '9.3%' },
      { property_type: 'DefenceAddedRatio', times: 3, value: '14.5%' },
    ]),
    relic(61333, '133', 3, 'HealRatioBase', [
      { property_type: 'AttackDelta', times: 2, value: '38' },
      { property_type: 'DefenceDelta', times: 2, value: '33' },
      { property_type: 'HPAddedRatio', times: 1, value: '3.4%' },
      { property_type: 'StatusProbabilityBase', times: 3, value: '11.2%' },
    ]),
    relic(61334, '133', 4, 'DefenceAddedRatio', [
      { property_type: 'HPDelta', times: 1, value: '42' },
      { property_type: 'AttackAddedRatio', times: 4, value: '15.9%' },
      { property_type: 'CriticalChanceBase', times: 2, value: '5.8%' },
      { property_type: 'AttackDelta', times: 1, value: '16' },
    ]),
    relic(63315, '308', 5, 'DefenceAddedRatio', [
      { property_type: 'HPAddedRatio', times: 2, value: '7.7%' },
      { property_type: 'SpeedDelta', times: 3, value: '7' },
      { property_type: 'CriticalChanceBase', times: 2, value: '6.4%' },
      { property_type: 'CriticalDamageBase', times: 2, value: '11.6%' },
    ]),
    relic(63316, '308', 6, 'EnergyRecoveryRateBase', [
      { property_type: 'AttackDelta', times: 1, value: '19' },
      { property_type: 'AttackAddedRatio', times: 2, value: '8.6%' },
      { property_type: 'DefenceAddedRatio', times: 2, value: '9.1%' },
      { property_type: 'SpeedDelta', times: 3, value: '6' },
    ]),
  ]
  const character = {
    id: 1503, name: '真珠', rarity: 5, rank: 0, level: 80, icon: 'icon/character/1503.png',
    skills: [
      { point_id: '150301', type_text: '普攻', level: 6 },
      ...['1503201', '1503202', '1503203', '1503204', '1503205', '1503206', '1503207', '1503208', '1503209', '1503210'].map(point_id => ({ point_id, type_text: '行迹', is_activated: true })),
    ],
    equip: { id: 21064, name: '菇菇嘎嘎历险记', level: 80, promote_level: 6, rank: 1 },
    relics,
  }
  const client = {
    discover: async () => [{ game: 'sr', uid: '103592444', region: 'prod_gf_cn' }],
    record: async () => ({ retcode: 0, data: { avatar_list: [character] } }),
  }
  const records = createRecords(client as never)
  const panel = await records.queryPanel({ game: 'sr', uid: '103592444', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
  assert.equal(typeof panel, 'object')
  if (typeof panel === 'string') throw new Error(panel)
  const result = panel.characters[0]
  const stats = Object.fromEntries((result.calculatedStats || []).map(stat => [stat.name, stat.value]))
  assert.deepEqual(stats, {
    生命值: '3027', 攻击力: '1600', 防御力: '3074', 速度: '137',
    暴击率: '26.7%', 暴击伤害: '61.6%', 效果命中: '11.2%', 效果抵抗: '14.3%',
    击破特攻: '5.1%', 能量恢复效率: '124.4%', 冰属性伤害提高: '0.0%',
    治疗量加成: '34.5%', 欢愉度: '22.0%',
  })
  assert.ok(Math.abs((result.relics[0].subProperties?.[0].value || 0) - 0.1458) < 1e-9)
  assert.ok(Math.abs((result.relics[4].subProperties?.[1].value || 0) - 7.2) < 1e-9)
})

test('Star Rail relic speed preserves decimal display precision and authoritative totals', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('面板不应依赖 Mihomo 展示列表') })
  const character = {
    id: 1503, name: '真珠', level: 80,
    statistics: [{ field: 'spd', name: '速度', value: 115.2, display: '115' }],
    equip: { id: 21064, name: '菇菇嘎嘎历险记', level: 80, promote_level: 6, rank: 1 },
    relics: Array.from({ length: 6 }, (_, index) => ({
      name: '遗器', rarity: 5, type: index + 1, level: 15,
      main_property: { property_type: ['HPDelta', 'AttackDelta', 'CriticalDamageBase', 'AttackAddedRatio', 'AttackAddedRatio', 'AttackAddedRatio'][index] },
      properties: index === 0 ? [{ property_type: 'SpeedDelta', times: 3, value: '7', display: '7.8' }]
        : index === 1 ? [{ property_type: 'SpeedDelta', times: 3, value: '7.5', display: '7' }]
          : index === 2 ? [{ property_type: 'SpeedDelta', times: 3, display: '7.8' }]
            : index === 3 ? [{ property_type: 'SpeedDelta', times: 3, value: '7' }]
              : index === 4 ? [{ property_type: 'SpeedDelta', times: 3, value: '7', display_value: '7.5' }]
                : [{ property_type: 'SpeedDelta', times: 3, value: '7', display: '8.1' }],
    })),
  }
  const client = {
    discover: async () => [{ game: 'sr', uid: '103592444', region: 'prod_gf_cn' }],
    record: async () => ({ retcode: 0, data: { avatar_list: [character] } }),
  }
  const panel = await createRecords(client as never).queryPanel({ game: 'sr', uid: '103592444', region: 'prod_gf_cn' } as GameRole, '', undefined, '真珠')
  if (typeof panel === 'string') throw new Error(panel)
  const result = panel.characters[0]
  const speeds = result.relics.map(relic => relic.subProperties?.[0].value)
  for (const [index, expected] of [7.8, 7.5, 7.8, 7.2, 7.5, 7.2].entries()) {
    assert.ok(Math.abs((speeds[index] ?? NaN) - expected) < 1e-9)
  }
  assert.equal(result.stats.find(stat => stat.name === '速度')?.value, '115')
})

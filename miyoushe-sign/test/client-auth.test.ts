import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient, Result } from '../src/client'
import { GameRole } from '../src/accounts'
import { createRecords } from '../src/records'

type RequestOptions = { method: string; headers: Record<string, string>; data?: unknown }

function mockClient(respond: (url: string, options: RequestOptions) => Result | Promise<Result>) {
  const calls: { url: string; options: RequestOptions }[] = []
  const ctx = { http: async (url: string, options: RequestOptions) => {
    calls.push({ url, options })
    return { status: 200, data: await respond(url, options) }
  } }
  return { client: createClient(ctx as never, 5000, 0), calls }
}

const secret = 'stuid=123;stoken=test-stoken;mid=test-mid;ltoken=test-ltoken==;'
const cnRole = { game_biz: 'hkrpg_cn', game_uid: '200', region: 'prod_gf_cn' }
const osRole = { game_biz: 'hkrpg_global', game_uid: '300', region: 'prod_official_usa' }
const listed = (list: unknown[]): Result => ({ retcode: 0, data: { list } })

test('扫码换取的 ltoken 完整保留并用于 records，不凭空生成 v2 字段', async () => {
  const { client, calls } = mockClient((url, options) => {
    if (url.includes('/exchange')) {
      assert.deepEqual(options.data, { src_token: { token: 'test-stoken', token_type: 1 }, mid: 'test-mid', dst_token_type: 4 })
      return { retcode: 0, data: { token: { token: 'test-ltoken==' } } }
    }
    if (url.includes('getCookieAccountInfoBySToken')) {
      assert.equal(options.headers.Cookie, secret)
      return { retcode: 0, data: { cookie_token: 'test-cookie==' } }
    }
    assert.equal(options.headers.Cookie, 'ltoken=test-ltoken==;ltuid=123;cookie_token=test-cookie==;account_id=123;')
    return { retcode: -10001, message: 'login expired' }
  })
  const ltoken = await client.qrExchange('test-stoken', 'test-mid')
  const cookie = await client.exchangeCookie(`stuid=123;stoken=test-stoken;mid=test-mid;ltoken=${ltoken};`, '123')
  assert.equal(cookie, 'ltoken=test-ltoken==;ltuid=123;cookie_token=test-cookie==;account_id=123;')
  assert.doesNotMatch(cookie, /stoken=|(?:^|;)mid=|ltmid|_v2=/)
  const result = await client.record('https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index?role_id=200&server=prod_gf_cn', cookie)
  assert.equal(result.retcode, -10001)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(call => !/test-stoken|test-ltoken|test-cookie|test-mid/.test(call.url)))
})

test('换 CK 保留已有 v2 LToken 和配套 mid，不改写成传统字段', async () => {
  const token = 'stuid=123;stoken_v2=test-stoken;ltoken_v2=test-ltoken==;ltmid_v2=test-mid;account_mid_v2=test-mid;'
  const { client } = mockClient(() => ({ retcode: 0, data: { cookie_token: 'test-cookie' } }))
  const cookie = await client.exchangeCookie(token, '123')
  assert.equal(cookie, 'ltoken_v2=test-ltoken==;ltmid_v2=test-mid;account_mid_v2=test-mid;ltuid=123;cookie_token=test-cookie;account_id=123;')
  assert.doesNotMatch(cookie, /(?:^|;)(?:stoken_v2|ltoken|mid)=/)
})

test('换 CK 保留传统与 v2 LToken 的原始字段名和等号', async () => {
  const { client } = mockClient(() => ({ retcode: 0, data: { cookie_token: 'test-cookie' } }))
  const cookie = await client.exchangeCookie(`${secret}ltoken_v2=v2-token==;ltmid_v2=test-mid;`, '123')
  assert.match(cookie, /(?:^|;)ltoken=test-ltoken==;/)
  assert.match(cookie, /(?:^|;)ltoken_v2=v2-token==;/)
  assert.match(cookie, /(?:^|;)ltmid_v2=test-mid;/)
})

test('国际服换 CK 仍使用指定官方地址和 POST', async () => {
  const { client, calls } = mockClient(() => ({ retcode: 0, data: { cookie_token: 'test-cookie' } }))
  await client.exchangeCookie(secret, '123', 'hkrpg_global')
  assert.equal(calls[0].url, 'https://sg-public-api.hoyolab.com/auth/api/getCookieAccountInfoBySToken?game_biz=hkrpg_global')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers.Cookie, secret)
})

test('缺少或非法凭证在发送请求前拒绝', async () => {
  const { client, calls } = mockClient(() => ({ retcode: 0, data: { cookie_token: 'test-cookie' } }))
  for (const [token, uid] of [
    ['stuid=123;stoken=test-stoken;', '123'],
    ['stuid=123;ltoken=test-ltoken;', '123'],
    [secret, 'invalid'],
    [secret, '456'],
    [`${secret}account_id=456;`, '123'],
    ['stuid=123;stoken=test-stoken;ltoken=bad token;', '123'],
    [`${secret}ltmid_v2=bad mid;`, '123'],
    [`${secret}account_mid_v2=bad\nmid;`, '123'],
    [`${secret}ltoken_v2=${'a'.repeat(2049)};`, '123'],
  ]) await assert.rejects(client.exchangeCookie(token, uid), /SToken|凭证|通行证/)
  assert.equal(calls.length, 0)
})

test('换 CK 拒绝错误响应及可注入 Cookie 的 token，且不重试', async () => {
  for (const response of [
    { retcode: -10001, data: { cookie_token: 'test-cookie' } },
    { retcode: 1034, data: { cookie_token: 'test-cookie' } },
    { retcode: 0 },
    ...['', 'bad;other=value', 'bad token', 'bad\r\ntoken', 'a'.repeat(2049)].map(cookie_token => ({ retcode: 0, data: { cookie_token } })),
  ]) {
    const { client, calls } = mockClient(() => response)
    await assert.rejects(client.exchangeCookie(secret, '123'), /CK 换取失败/)
    assert.equal(calls.length, 1)
  }
})

test('discover 国内列表为空时继续查询国际服', async () => {
  const { client, calls } = mockClient(url => listed(url.includes('api-takumi') ? [] : [osRole]))
  assert.deepEqual(await client.discover('test-cookie'), [{ game: 'sr', uid: '300', region: 'prod_official_usa' }])
  assert.deepEqual(calls.map(call => new URL(call.url).hostname), ['api-takumi.mihoyo.com', 'sg-public-api.hoyolab.com'])
})

test('discover 国内列表过滤后为空也继续查询国际服', async () => {
  const { client, calls } = mockClient(url => listed(url.includes('api-takumi') ? [
    null, 'bad-role', {}, { ...cnRole, game_biz: 'unknown' }, { ...cnRole, game_uid: 'invalid' }, { ...cnRole, region: 'bad region' },
  ] : [osRole]))
  assert.deepEqual(await client.discover('test-cookie'), [{ game: 'sr', uid: '300', region: 'prod_official_usa' }])
  assert.equal(calls.length, 2)
})

test('discover 找到有效国内角色时去重并停止', async () => {
  const { client, calls } = mockClient(() => listed([cnRole, cnRole, { ...cnRole, region: 'prod_qd_cn' }]))
  assert.deepEqual(await client.discover('test-cookie'), [
    { game: 'sr', uid: '200', region: 'prod_gf_cn' },
    { game: 'sr', uid: '200', region: 'prod_qd_cn' },
  ])
  assert.equal(calls.length, 1)
})

test('discover 空列表、接口错误、异常及格式错误均有界结束', async () => {
  for (const response of [listed([]), { retcode: -10001 }, { retcode: 0, data: { list: {} } }, new Error('network error')]) {
    const { client, calls } = mockClient(() => {
      if (response instanceof Error) throw response
      return response
    })
    assert.deepEqual(await client.discover('test-cookie'), [])
    assert.equal(calls.length, 2)
  }
})

test('records 风控与验证码原样返回，不刷新凭证或自动重试', async () => {
  for (const retcode of [-10001, 1034, 10035, 5003, 10041]) {
    const response = { retcode, message: '请在官方客户端验证' }
    const { client, calls } = mockClient(() => response)
    assert.deepEqual(await client.record('https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index', 'test-cookie'), response)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].options.headers.Cookie, 'test-cookie')
  }
})

test('record 请求使用与参考客户端一致的系统版本并提供设备 ID', async () => {
  const { client, calls } = mockClient(() => ({ retcode: 0, data: {} }))
  await client.record('https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index?role_id=200&server=prod_gf_cn', secret)
  assert.equal(calls.length, 1)
  assert.match(calls[0].options.headers['x-rpc-device_id'], /^[a-f0-9-]{32,36}$/)
  assert.equal(calls[0].options.headers['x-rpc-sys_version'], '12')
  assert.equal(calls[0].options.headers['x-rpc-device_model'], 'XQ-BC52')
  assert.equal(calls[0].options.headers['x-rpc-signgame'], 'hkrpg')
})

const recordRoutes = [
  { name: 'overview', game: 'sr', type: 'overview', path: '/index', requests: 1 },
  { name: 'challenge_brief', game: 'sr', type: 'overview', path: '/challenge_brief', requests: 2 },
  { name: 'queryPanel list', game: 'gs', panel: true, path: '/character/list', requests: 1 },
  { name: 'query list', game: 'gs', type: 'panel', path: '/character/list', requests: 1 },
  { name: 'queryPanel sr', game: 'sr', panel: true, path: '/avatar/info', requests: 1 },
  { name: 'queryPanel gs', game: 'gs', panel: true, path: '/character/detail', requests: 2 },
  { name: 'query panel', game: 'gs', type: 'panel', path: '/character/detail', requests: 2 },
  { name: 'query', game: 'sr', type: 'forgotten', path: '/challenge', requests: 1 },
  { name: 'query roles', game: 'gs', type: 'roles', path: '/character/list', requests: 1 },
  { name: 'query zzz', game: 'zzz', type: 'overview', path: '/index', requests: 1 },
] as const

test('apocalypse 默认查询使用本期周期', async () => {
  const { client, calls } = mockClient(url => {
    if (url.includes('/binding/')) return listed([cnRole])
    if (new URL(url).pathname.endsWith('/challenge_boss')) return listed([])
    return { retcode: 0, data: {} }
  })
  await createRecords(client).query({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, secret, 'apocalypse')
  const request = calls.find(call => new URL(call.url).pathname.endsWith('/challenge_boss'))
  assert.ok(request)
  const params = new URL(request.url).searchParams
  assert.equal(params.get('schedule_type'), '1')
  assert.equal(params.has('isPrev'), false)
  assert.equal(params.has('need_all'), false)
  assert.equal(request.url.indexOf('role_id=') < request.url.indexOf('schedule_type='), true)
  assert.equal(request.url.indexOf('schedule_type=') < request.url.indexOf('server='), true)
})

const recordFailures = [
  { retcode: -10001, message: 'login expired', expected: '查询失败：Cookie 或登录状态已失效，请重新绑定米游社凭证。' },
  { retcode: -10001, message: 'Cookie 已失效，请重新登录', expected: '查询失败：Cookie 或登录状态已失效，请重新绑定米游社凭证。' },
  { retcode: -10001, message: 'invalid token', expected: '查询失败：Cookie 或登录状态已失效，请重新绑定米游社凭证。' },
  { retcode: -10001, message: 'device fingerprint forbidden; cookie=REDACTED', expected: '查询失败：请求被设备或风控策略拒绝，请先在官方客户端打开对应角色页面后重试。' },
  { retcode: -10001, message: '设备风控拒绝', expected: '查询失败：请求被设备或风控策略拒绝，请先在官方客户端打开对应角色页面后重试。' },
  { retcode: -10001, message: '请求异常', expected: '查询失败（-10001）：记录接口拒绝请求，原因未知，请在官方客户端检查账号状态。' },
  { retcode: -10001, message: 'cookie=REDACTED; token=REDACTED', expected: '查询失败（-10001）：记录接口拒绝请求，原因未知，请在官方客户端检查账号状态。' },
  { retcode: -10001, expected: '查询失败（-10001）：记录接口拒绝请求，原因未知，请在官方客户端检查账号状态。' },
  { retcode: 10001, message: 'login expired', expected: '查询失败：Cookie 或登录状态已失效，请重新绑定米游社凭证。' },
  { retcode: 10102, expected: '查询失败：该角色的米游社数据未公开。' },
  { retcode: 10101, expected: '查询失败：今日查询次数已达上限。' },
  { retcode: 1008, expected: '查询失败：请先在米游社绑定角色。' },
  { retcode: 1034, expected: '查询失败：平台要求验证码，请在官方客户端完成验证。' },
  { retcode: 10035, expected: '查询失败：平台要求验证码，请在官方客户端完成验证。' },
  { retcode: 5003, expected: '查询失败：账号或设备状态异常，请在官方客户端检查。' },
  { retcode: 10041, expected: '查询失败：账号或设备状态异常，请在官方客户端检查。' },
  { retcode: -999, expected: '查询失败（-999），请检查角色展示权限及官方客户端状态。' },
]

for (const route of recordRoutes) {
  test(`${route.name} 使用统一错误出口且不回显敏感响应`, async () => {
    for (const failure of recordFailures) {
      const role = { game: route.game, uid: '200', region: route.game === 'sr' ? 'prod_gf_cn' : 'cn_gf01' } as GameRole
      const { client, calls } = mockClient(url => {
        const path = new URL(url).pathname
        if (path.includes('/binding/')) return listed([{ game_biz: { sr: 'hkrpg_cn', gs: 'hk4e_cn', zzz: 'nap_cn' }[route.game], game_uid: role.uid, region: role.region }])
        if (path.endsWith(route.path)) return {
          retcode: failure.retcode,
          message: `${failure.message || ''}; private-response=SECRET_RESPONSE; ${secret}`,
          data: { cookie_token: 'SECRET_DATA', url: 'https://example.com/?token=SECRET_URL' },
        }
        assert.ok(path.endsWith('/index') || path.endsWith('/character/list') || path.endsWith('/note'))
        if (path.endsWith('/index')) return { retcode: 0, data: { nickname: '概览测试', level: 70 } }
        return listed([{ id: 1001 }])
      })
      const records = createRecords(client)
      const result = 'panel' in route
        ? await records.queryPanel(role, secret)
        : await records.query(role, secret, route.type)
      const expected = route.name === 'challenge_brief'
        ? `sr overview\nnickname：概览测试\nlevel：70\n挑战摘要：${failure.expected}`
        : failure.expected
      assert.equal(result, expected, `${route.name}: ${failure.retcode} ${failure.message || ''}`)
      assert.doesNotMatch(String(result), /SECRET_|test-stoken|test-ltoken|test-mid|private-response|example\.com/)
      const requests = calls.filter(call => !call.url.includes('/binding/'))
      assert.equal(requests.length, route.requests)
      assert.equal(requests.filter(call => new URL(call.url).pathname.endsWith(route.path)).length, 1)
    }
  })
}

test('sr overview 挑战摘要抛异常时保留基础摘要，不回显异常或重试', async () => {
  for (const error of [new Error(`SECRET_ERROR ${secret} https://example.com/?token=SECRET_URL`), 'SECRET_RESPONSE', null]) {
    const { client, calls } = mockClient(url => {
      if (url.includes('/binding/')) return listed([cnRole])
      if (new URL(url).pathname.endsWith('/index')) return { retcode: 0, data: { nickname: '概览测试', level: 70 } }
      assert.ok(new URL(url).pathname.endsWith('/challenge_brief'))
      throw error
    })
    const result = await createRecords(client).query({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, secret, 'overview')
    assert.equal(result, 'sr overview\nnickname：概览测试\nlevel：70\n挑战摘要：查询失败：接口请求异常。')
    assert.doesNotMatch(result, /SECRET_|test-stoken|test-ltoken|test-mid|example\.com/)
    assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
      '/binding/api/getUserGameRolesByCookie',
      '/game_record/app/hkrpg/api/index',
      '/game_record/app/hkrpg/api/challenge_brief',
    ])
  }
})

test('sr overview 挑战摘要成功时保留合并及空列表行为', async () => {
  for (const list of [[], [{ challenge_type: 'Story', cur_schedule: { finish_star_count: 10, total_star_count: 12 } }]]) {
    const { client, calls } = mockClient(url => {
      if (url.includes('/binding/')) return listed([cnRole])
      if (new URL(url).pathname.endsWith('/index')) return { retcode: 0, data: { nickname: '概览测试', level: 70, avatar_list: [{ id: 1 }, { id: 2 }, { id: 3 }] } }
      if (new URL(url).pathname.endsWith('/note')) return { retcode: 0, data: { current_stamina: 120, max_stamina: 240 } }
      assert.ok(new URL(url).pathname.endsWith('/challenge_brief'))
      return listed(list)
    })
    const result = await createRecords(client).query({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, secret, 'overview')
    assert.equal(result, `sr overview\nnickname：概览测试\nlevel：70\n角色数量：3${list.length ? '\nStory：10/12' : ''}`)
      assert.equal(calls.length, 3)
  }
})

for (const type of ['forgotten', 'fiction', 'apocalypse', 'anomaly']) {
  test(`${type} 遇到验证码仅请求一次，不换参重试`, async () => {
    for (const retcode of [1034, 10035]) {
      const { client, calls } = mockClient(url => url.includes('/binding/') ? listed([cnRole]) : { retcode })
      const records = createRecords(client)
      assert.equal(await records.query({ game: 'sr', uid: '200', region: 'prod_gf_cn' } as GameRole, secret, type, 2), '查询失败：平台要求验证码，请在官方客户端完成验证。')
      const requests = calls.filter(call => !call.url.includes('/binding/'))
      assert.equal(calls.length, 2)
      assert.equal(requests.length, 1)
      const params = new URL(requests[0].url).searchParams
      assert.equal(params.get('schedule_type'), '2')
      assert.equal(params.has('isPrev'), false)
      assert.equal(params.has('need_all'), false)
    }
  })
}

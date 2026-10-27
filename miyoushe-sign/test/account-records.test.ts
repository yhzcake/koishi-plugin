import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRecords, formatAccountOverview } from '../src/records'
import { createClient } from '../src/client'
import { App } from 'koishi'
import { GameRole } from '../src/accounts'

function setup(respond: (url: string) => { retcode: number; data?: Record<string, unknown> }) {
  const app = new App()
  const calls: URL[] = []
  const ctx = {
    http: async (url: string) => {
      calls.push(new URL(url))
      return { status: 200, data: respond(url) }
    },
    logger: { info() {} },
  }
  const client = createClient(ctx as never, 5000, 0)
  return { records: createRecords(client), calls }
}

const gs: GameRole = { id: 'gs-role', platform: 'test', userId: 'test-user', ltuid: '1', game: 'gs', uid: '100000001', region: 'cn_gf01', current: true, lastDay: '' }
const sr: GameRole = { id: 'sr-role', platform: 'test', userId: 'test-user', ltuid: '1', game: 'sr', uid: '200000001', region: 'prod_gf_cn', current: true, lastDay: '' }

test('原神账号概览读取昵称、账号头像及角色立绘', async () => {
  const { records, calls } = setup(url => url.includes('/binding/api/')
    ? { retcode: 0, data: { list: [{ game_biz: 'hk4e_cn', game_uid: gs.uid, region: gs.region }] } }
    : url.includes('/character/list') ? { retcode: 0, data: { list: [{ id: 10000001, name: '刻晴' }, { id: 10000002, name: '纳西妲', avatar_side_icon: 'http://assets.example.test/nahida.png' }] } }
    : { retcode: 0, data: { role: { nickname: '旅行者', level: 60, game_head_icon: 'http://assets.example.test/account.png' }, stats: { avatar_number: 42 } } })

  const result = await records.queryAccount(gs, 'cookie')
  assert.equal(typeof result, 'object')
  if (typeof result === 'string') throw new Error(result)
  const output = formatAccountOverview(result)

  assert.match(output, /UID：100000001/)
  assert.match(output, /昵称：旅行者/)
  assert.doesNotMatch(output, /等级|角色数|区服|挑战/)
  assert.match(output, /刻晴/)
  assert.match(output, /纳西妲/)
  assert.equal(result.game, 'gs')
  assert.equal(result.avatar, 'https://assets.example.test/account.png')
  assert.equal(result.characters[0].avatar, 'https://enka.network/ui/UI_Gacha_AvatarImg_10000001.png')
  assert.equal(result.characters[1].avatar, 'https://enka.network/ui/UI_Gacha_AvatarImg_10000002.png')
  const roleCall = calls.find(url => url.pathname.endsWith('/character/list'))
  assert.ok(roleCall)
  assert.equal(roleCall.search, '')
  assert.equal(calls.filter(url => url.pathname.endsWith('/index')).length, 1)
})

test('星铁账号概览读取角色立绘，且不请求挑战记录', async () => {
  const { records, calls } = setup(url => {
    if (url.includes('/binding/api/')) return { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: sr.uid, region: sr.region }] } }
    if (url.endsWith('/index?role_id=200000001&server=prod_gf_cn')) return { retcode: 0, data: { role: { nickname: '开拓者', level: 70 }, stats: { avatar_num: 28 } } }
    if (url.includes('/role/basicInfo?')) return { retcode: 0, data: { nickname: 'basicInfo-name', level: 71 } }
    if (url.includes('/avatar/basic?')) return { retcode: 0, data: { avatar_list: [{ id: 8001, name: '三月七' }] } }
    return { retcode: 0, data: {} }
  })

  const result = await records.queryAccount(sr, 'cookie')
  assert.equal(typeof result, 'object')
  if (typeof result === 'string') throw new Error(result)
  const output = formatAccountOverview(result)

  assert.match(output, /昵称：开拓者/)
  assert.match(output, /三月七/)
  assert.doesNotMatch(output, /等级|角色数|区服|挑战|星数/)
  assert.equal(result.game, 'sr')
  assert.equal(result.characters[0].avatar, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/image/character/8001_Splash.png')
  assert.equal(calls.filter(url => /\/challenge(?:_story|_boss|_peak)?$/.test(url.pathname)).length, 0)
})

test('账号概览角色列表请求失败时仍保留账号身份信息', async () => {
  const { records } = setup(url => {
    if (url.includes('/binding/api/')) return { retcode: 0, data: { list: [{ game_biz: 'hkrpg_cn', game_uid: sr.uid, region: sr.region }] } }
    const endpoint = new URL(url).pathname.split('/').pop()
    if (endpoint === 'index') return { retcode: 0, data: { role: { nickname: '测试开拓者' } } }
    if (endpoint === 'avatar') return { retcode: -10001, message: 'denied' }
    return { retcode: 0, data: {} }
  })

  const result = await records.queryAccount(sr, 'cookie')
  assert.equal(typeof result, 'object')
  if (typeof result === 'string') throw new Error(result)
  const output = formatAccountOverview(result)

  assert.match(output, /昵称：测试开拓者/)
  assert.doesNotMatch(output, /等级|角色数|区服|挑战/)
})

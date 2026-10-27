# 米游社游戏账号插件

仅自用插件。星铁角色属性数据为插件计算，会有±5之内的数值差。

使用 Koishi 的 `database` 与 `http` 服务，并依赖 `qrcode` 生成扫码图片；图片面板另需启用 `koishi-plugin-puppeteer`。插件尚未用真实账号验证全部接口的长期可用性，接口、活动 ID 和远程数据可能随平台更新而变化；验证码与风险拦截不自动绕过。使用前请确认平台规则允许此类自动访问。

## 启用

在 Koishi 控制台启用 `miyoushe-sign`，需保持 `database-sqlite` 和 `http` 服务启用。插件配置中的 `encryptionKey` 用于加密数据库内凭证，建议填写并长期保持不变；可以使用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` 生成。未填写时插件仍会加载，但每次启动会生成新的临时密钥，重启后已保存凭证将无法解密。配置中的 `accounts` 可直接填写 `platform`、`userId`、`ltuid`、`cookie`、`stoken` 导入账号。图片面板另需启用已安装的 `puppeteer` 服务。

私聊命令：

- `mys.bind Cookie`：验证完整 CK，查询通行证下的游戏角色并自动保存各游戏 UID、区服；不需要填写槽位、游戏或区服。自动签到默认关闭。
- `mys.qr`：私聊生成扫码登录链接，参考 YunZaiBot 轮询扫码状态；检测到已扫描后提示确认，确认后换取并加密保存 CK、SToken，约 100 秒后超时。
- `mys.token SToken-Cookie`：提交 `stuid;stoken;ltoken`，可独立于 CK 加密绑定。
- `mys.refresh 通行证ID`：使用已绑定的有效 SToken 换取 CK，角色列表验证成功后才替换旧 CK。
- `mys.accounts`：查看自己的通行证、游戏角色和每游戏当前 UID，不展示凭证。
- `mys.uid 游戏代号 UID`：切换该游戏的当前 UID。
- `mys.sign [游戏代号]`：手动签到自己的全部游戏角色，可只签到指定游戏。
- `mys.community [分区代号|all]`：手动签到米游社社区，默认原神分区；`all` 为全部已知分区。
- 社区签到仅通过 `mys.community [分区代号|all]` 执行，不再执行浏览帖子、点赞或分享任务，降低账号风控风险。
- `mys.auto on|off [通行证ID]`：启停游戏自动签到；仅绑定一个 CK 时可省略 ID，也兼容旧语法 `mys.auto 通行证ID on|off`。
- `mys.community.auto on|off [通行证ID]`：启停独立定时社区签到；仅绑定一个 SToken 时可省略 ID，开启时会关闭跟随模式，也兼容旧语法。
- `mys.community.follow on|off [通行证ID]`：启停跟随游戏自动签到的社区签到；仅绑定一个 SToken 时可省略 ID，开启时自动关闭独立定时社区签到，需同时开启游戏自动签到，也兼容旧语法。
- `mys.remove 通行证ID`：删除游戏 CK、设备及角色，不删除 SToken。
- `mys.token.remove 通行证ID`：单独删除 SToken，不删除游戏 CK。
- `mys.device.bind 通行证ID 设备ID 设备指纹`：加密保存通行证设备资料，供所属游戏角色复用；不等于官方远端绑定。
- `mys.device.fp 通行证ID`：向设备指纹接口申请并加密保存指纹；自动获取的指纹按七天有效期复用。并非远端设备登录或保存。
- `mys.device.remove 通行证ID`：删除本地设备资料，不等于官方远端解绑。
- `mys.record 游戏代号 [类型] [UID] [1|2|3]`：可在私聊或群聊查询发送者本人已绑定的角色；默认类型为 `overview`，默认使用当前 UID，也可指定已绑定 UID；挑战的 `1` 为本期，`2` 为上期，异相仲裁可用 `3` 查询往期。
- 星铁 `overview` 摘要仅列出角色总数，不逐个列出角色；并尝试通过官方便笺接口读取当前开拓力，接口不可用时不影响其他摘要。
- `mys.panel [gs|sr] [UID]`：查询游戏账号概览，默认星铁；图片顶部显示账号头像、游戏昵称和 UID，下方按每排三列展示角色立绘与名称。头像优先使用游戏账号头像，缺失时回退米游社或命令发送者头像。每次重新查询并使用 Puppeteer 渲染，不读取角色详情快照。
- `mys.character gs|sr 角色名 [UID]`：可在私聊或群聊查询发送者本人已绑定 UID 的指定角色详细面板；群聊回复会对群成员可见。
- `mys.migrate 旧槽位`：显式验证并迁移旧版槽位的游戏 CK；不会自动删除旧数据。旧社区槽位需重新绑定 SToken。

记录类型：星铁 `panel`、`roles`、`overview`、`forgotten`（忘却之庭/混沌回忆）、`fiction`（虚构叙事）、`apocalypse`（末日幻影）、`anomaly`（异相仲裁）；原神 `panel`、`roles`、`overview`、`abyss`（深境螺旋）、`theater`（幻想真境剧诗）、`peril`（幽境危战）；绝区零 `roles`、`overview`。旧项目未提供绝区零对应挑战接口，此处不虚构路径。原神和星铁的 `mys.record 游戏 panel` 兼容为账号概览；`mys.record sr overview` 输出上下拼接图片，上半为开拓者头像、昵称、等级、服务器和 UID，下半为开拓力、每日实训、历战余响次数及周期积分（接口提供时展示）。指定角色的装备、属性、行迹和遗器评分统一使用 `mys.character`，其角色快照不供账号概览读取。平台拒绝请求时如实提示，不自动绕过验证，也不能由离线测试保证真实查询成功率。

自动任务按北京时间每天配置的开始小时后运行，遍历已启用通行证的全部游戏 UID；网络异常至多再尝试一次，接口明确拒绝不重试。`mys.community.auto` 执行独立定时社区签到，默认执行原神分区，不依赖游戏自动签到。开启 `mys.community.follow` 后独立定时自动关闭；跟随模式在该通行证当天第一次实际发起的定时游戏签到后，对同一游戏分区执行一次社区签到，当天后续游戏签到不会再自动触发。两种模式共用持久化的每日触发记录，切换模式或重启不导致当天重复执行，失败也不自动重试。国际服社区签到不在支持范围内。

旧版自填槽位表保持原状，但不再参与常规命令。扫码、刷新 CK、指纹接口、社区签到与图片摘要的代码路径已接入；原 Yunzai 的完整面板评分模板、远端设备登录保存和验证码自动处理未移植。真实平台接口、验证码和风控状态需授权账号验证；离线模拟不能保证成功率。

凭证与设备资料使用 AES-256-GCM 加密存于数据库，主密钥不落库。插件只在发起指定平台请求期间解密并不记录凭证；但聊天平台、机器人适配器、数据库备份或 HTTP 调试中间件可能另行保留原消息或请求数据，无法由本插件消除。只在可信私聊绑定，发送后删除原消息；限制数据库及主密钥访问权限，不要打开包含原始请求头的日志。已得到主密钥和密文的攻击者可恢复凭证；进程内凭证也无法保证从内存中不可提取。群聊查询只读取命令发送者本人的账号，但面板、UID 和记录内容会直接发送到群聊，请勿在不可信群组使用。

离线验证：在 `koishi-app` 目录运行 `node --import tsx --test plugins/miyoushe-sign/test/sign.test.ts plugins/miyoushe-sign/test/data-cache.test.ts`。真实接口成功率需由授权账号实测，不能由模拟测试保证。

## 来源、借鉴与致谢

本节列出代码中直接使用、借鉴流程、读取数据或调用接口的项目、服务、仓库和资源地址。官方接口与第三方项目分别标注，不能将官方协议或游戏数据误认为本插件原创内容。

### 宿主框架与运行依赖

| 名称                    | 用途                                              | 地址                                                |
| ----------------------- | ------------------------------------------------- | --------------------------------------------------- |
| Koishi                  | 插件宿主、命令、配置、数据库和 HTTP 服务          | https://koishi.chat/                                |
| Koishi GitHub           | Koishi 源码和 API 实现                            | https://github.com/koishijs/koishi                  |
| koishi-plugin-puppeteer | 使用 Puppeteer 渲染二维码和角色面板图片           | https://github.com/koishijs/koishi-plugin-puppeteer |
| Puppeteer               | 浏览器页面渲染能力，由 Koishi 插件提供服务        | https://pptr.dev/                                   |
| qrcode                  | 将扫码登录地址生成二维码 Data URL                 | https://github.com/soldair/node-qrcode              |
| SQLite                  | Koishi 数据库后端，用于账号、快照和静态缓存持久化 | https://www.sqlite.org/                             |
| Node.js                 | 运行时、加密、压缩、测试和 Web API                | https://nodejs.org/                                 |

### 明确参考的项目

| 项目                   | 借鉴或使用内容                                                                                       | 地址                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| YunZaiBot              | `mys.qr` 扫码登录的轮询状态流程，包括已扫描、待确认、已确认和超时处理的交互思路                    | https://github.com/yoimiya-kokomi/Yunzai-Bot     |
| miao-plugin            | 米游社／米哈游游戏机器人生态中的面板展示和游戏记录功能作为设计参考；本插件没有直接复制其完整面板实现 | https://github.com/yoimiya-kokomi/miao-plugin    |
| StarRail-plugin        | 星穹铁道角色、光锥、遗器和行迹面板功能作为功能参考；本插件没有直接复制其完整实现                     | https://github.com/TsukinaKasumi/StarRail-plugin |
| Yunzai-genshin         | 米哈游游戏账号、签到和记录类机器人的功能形态作为参考；本插件没有直接复制其数据库或完整代码           | https://github.com/yunzaijs/genshin              |
| fribbels/hsr-optimizer | 遗器有效词条、角色评分权重、部位主词条偏好和相对评分口径；本地评分数据由该项目提取并记录来源提交     | https://github.com/fribbels/hsr-optimizer        |

fribbels 本地数据的来源记录如下：

```text
仓库：https://github.com/fribbels/hsr-optimizer
提交：a44c5d3ae2f1ed5907055a16c264bdc2392cf131
许可证：MIT
本地提取日期：2026-10-24
```

fribbels 评分的远程补充通过 GitHub Contents API 获取角色配置目录，再读取 API 返回的源码下载地址：

```text
https://api.github.com/repos/fribbels/hsr-optimizer/contents/src/lib/conditionals/character/{group}
```

### 游戏数据与图片资源

| 名称                   | 用途                                                                           | 地址                                                                 |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| StarRailRes            | 星穹铁道角色、角色突破、技能、行迹、光锥、光锥突破、叠影、遗器词条和套装数据   | https://github.com/Mar-7th/StarRailRes                               |
| StarRailRes jsDelivr   | StarRailRes JSON 数据的远程分发和缺失数据缓存来源                              | https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_new/cn/ |
| StarRailRes GitHub Raw | 角色、技能、光锥和遗器图片资源                                                 | https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/        |
| jsDelivr               | GitHub 仓库静态文件分发服务                                                    | https://www.jsdelivr.com/                                            |
| Mihomo                 | 按角色 ID 补充公开图片、图标和部分公开属性；不作为米游社角色是否存在的主数据源 | https://github.com/Mar-7th/Mihomo                                    |
| Mihomo API             | 星穹铁道公开展示角色补充接口                                                   | https://api.mihomo.me/                                               |

StarRailRes 的本地内嵌数据包含以下数据类别：

- `characters.json`
- `character_promotions.json`
- `character_skills.json`
- `character_skill_trees.json`
- `light_cones.json`
- `light_cone_promotions.json`
- `light_cone_ranks.json`
- `relic_main_affixes.json`
- `relic_sub_affixes.json`
- `relics.json`

当本地静态数据缺少角色或光锥条目时，插件从对应的 StarRailRes jsDelivr 地址获取 JSON，校验成功后写入 `miyoushe_static_cache`；远程失败不会覆盖已有有效数据。

### 开发期间查阅与核对的资料

以下为开发讨论中用于查找角色基础属性、行迹图片、属性计算与评分口径的资料链接；列入本节表示查阅或核对用途，不表示插件运行时会调用这些页面，也不表示直接复制其代码或采用其全部评分规则。

| 名称                       | 查阅或核对用途                                                                | 地址                                                                                |
| -------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 米游社星铁文章（69758661） | 角色面板与行迹资料查找参考                                                    | https://www.miyoushe.com/sr/article/69758661                                        |
| 米游社星铁文章（54518907） | 角色属性计算核对参考                                                          | https://www.miyoushe.com/sr/article/54518907                                        |
| 哔哩哔哩游戏 Wiki：真珠    | 角色突破白值及行迹资料核对                                                    | https://wiki.biligame.com/sr/%E7%9C%9F%E7%8F%A0                                     |
| 米游社星铁 Wiki（7935）    | 角色基础属性与行迹资料查找                                                    | https://bbs.mihoyo.com/sr/wiki/content/7935/detail?bbs_presentation_style=no_header |
| myhsr.wiki：角色 1503      | 角色成长与基础属性核对                                                        | https://myhsr.wiki/character/1503                                                   |
| HSR Statistics 遗器评分器  | 开发期间讨论遗器属性评分时的参考；当前实现的有效词条和评分权重来源为 Fribbels | https://hsr-statistics.com/zh-cn/relic-scorer                                       |

### 米游社与 HoYoLAB 官方接口

以下接口属于米哈游、米游社或 HoYoLAB 官方服务，不属于第三方借鉴项目。接口路径、请求头、活动 ID 和设备参数可能随官方更新而失效。

| 功能                     | 地址                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| 国内扫码登录创建         | https://passport-api.miyoushe.com/account/ma-cn-passport/app/createQRLogin      |
| 国内扫码登录状态         | https://passport-api.miyoushe.com/account/ma-cn-passport/app/queryQRLoginStatus |
| 米游社令牌交换           | https://passport-api.miyoushe.com/account/ma-cn-session/app/exchange            |
| 国内 SToken 换 CK        | https://api-takumi.mihoyo.com/auth/api/getCookieAccountInfoBySToken             |
| 国际 SToken 换 CK        | https://sg-public-api.hoyolab.com/auth/api/getCookieAccountInfoBySToken         |
| 国内设备指纹             | https://public-data-api.mihoyo.com/device-fp/api/getFp                          |
| 国际设备指纹             | https://sg-public-data-api.hoyoverse.com/device-fp/api/getFp                    |
| 国内游戏角色绑定         | https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie              |
| 国际游戏角色绑定         | https://sg-public-api.hoyolab.com/binding/api/getUserGameRolesByCookie          |
| 国内游戏签到             | https://api-takumi.mihoyo.com/event/luna/                                       |
| 国际游戏签到             | https://sg-act-public-api.hoyolab.com/event/                                    |
| 米游社社区签到状态       | https://bbs-api.miyoushe.com/apihub/sapi/querySignInStatus                      |
| 米游社社区签到           | https://bbs-api.miyoushe.com/apihub/app/api/signIn                              |
| 国内游戏记录             | https://api-takumi-record.mihoyo.com/                                           |
| 国际游戏记录             | https://sg-act-public-api.hoyolab.com/                                          |
| 米游社社区请求 Referer   | https://app.mihoyo.com/                                                         |
| 国内游戏活动请求 Referer | https://act.mihoyo.com/                                                         |
| 国际游戏活动请求 Referer | https://act.hoyolab.com/                                                        |

星穹铁道记录接口包括：

```text
/game_record/app/hkrpg/api/avatar/basic
/game_record/app/hkrpg/api/avatar/info
/game_record/app/hkrpg/api/index
/game_record/app/hkrpg/api/challenge
/game_record/app/hkrpg/api/challenge_story
/game_record/app/hkrpg/api/challenge_boss
/game_record/app/hkrpg/api/challenge_peak
/game_record/app/hkrpg/api/challenge_brief
```

原神和绝区零记录接口路径、签到活动 ID、DS 参数及请求头均来自对应官方接口约定，代码中没有将这些协议声明为某个第三方项目的原创内容。

### 算法与协议说明

| 名称               | 用途                                          | 参考地址                                  |
| ------------------ | --------------------------------------------- | ----------------------------------------- |
| AES-256-GCM        | 加密 Cookie、SToken、设备资料和数据库中的凭证 | https://nodejs.org/api/crypto.html        |
| SHA-256            | 凭证标识、缓存载荷校验                        | https://nodejs.org/api/crypto.html        |
| MD5 DS 签名        | 米游社记录接口请求所需的请求签名              | https://nodejs.org/api/crypto.html        |
| Gzip、Base64、JSON | 解压和读取内嵌 StarRailRes 静态数据           | https://nodejs.org/api/zlib.html          |
| Fribbels 有效词条  | 按副词条档位和角色权重计算有效词条数          | https://github.com/fribbels/hsr-optimizer |

角色白值、光锥白值、行迹、遗器和套装属性的合成是本插件根据 StarRailRes 数据实现的计算逻辑。除 Fribbels 评分口径外，当前代码没有声明这些计算函数直接复制自其他项目。

### 许可证与归属边界

- 本插件自身的 `package.json` 声明为 MIT，但不代表米游社接口、米哈游游戏数据、StarRailRes 数据、Mihomo 服务、Fribbels 数据或图片资源都由本插件重新授权。
- 第三方项目和数据源应以其各自仓库、许可证和服务条款为准。
- 本插件不保存或分发账号 Cookie、SToken 到上述公开数据缓存中；缓存只保存公开静态数据和来源元信息。
- `example.test`、`assets.example.test` 等地址只出现在自动化测试中，是占位地址，不是真实数据来源。
- DS 盐值、客户端标识、活动参数和官方接口请求格式是当前实现使用的协议参数；由于没有为每个常量保留可验证的上游提交，README 不将它们统一归因到 YunZaiBot 或其他项目。

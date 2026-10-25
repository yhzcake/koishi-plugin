# API 余额查询

仅自用插件。目前主要适配蓝钦与 DeepSeek 的 API 余额和用量查询。

## 支持接口

- `usage`：请求配置的 API 基础地址下的 `/v1/usage`。
- `deepseek`：请求配置的 API 基础地址下的 `/user/balance`。

## 命令

- `api.day [账号]`：查询今日余额与用量。
- `api.month [账号]`：查询本月余额与用量。

账号名称来自插件配置中的 `accounts`。API 密钥通过 Koishi 配置的 secret 字段填写，或使用环境变量 `OPENAI_API_KEY` 作为默认账号的初始值。不要把真实 API 密钥提交到版本库、聊天记录或公开日志中。

插件依赖 Koishi 的 `http` 服务，不新增第三方运行时依赖。

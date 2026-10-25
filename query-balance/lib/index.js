var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi = require("koishi");
var name = "query-balance";
var inject = ["http"];
var AccountConfig = import_koishi.Schema.object({
  name: import_koishi.Schema.string().default("\u9ED8\u8BA4\u8D26\u53F7").description("API \u8D26\u53F7\u6635\u79F0\u3002"),
  type: import_koishi.Schema.union(["usage", "deepseek"]).role("radio").default("usage").description("\u63A5\u53E3\u7C7B\u578B\u3002usage \u4E3A /v1/usage\uFF0C\u4E2D\u8F6C\u7AD9\uFF1Bdeepseek \u4E3A DeepSeek \u5B98\u65B9\u4F59\u989D\u63A5\u53E3\u3002"),
  baseUrl: import_koishi.Schema.string().default("https://api.777358.xyz").description("API \u57FA\u7840\u5730\u5740\u3002"),
  apiKey: import_koishi.Schema.string().role("secret").description("API \u5BC6\u94A5\u3002"),
  proxy: import_koishi.Schema.string().description("\u8BE5\u8D26\u53F7\u4F7F\u7528\u7684\u4EE3\u7406\u5730\u5740\u3002"),
  noProxy: import_koishi.Schema.array(String).default([]).description("\u8BE5\u8D26\u53F7\u4E0D\u4F7F\u7528\u4EE3\u7406\u7684\u4E3B\u673A\u540D\u6216\u5730\u5740\u3002")
});
var Config = import_koishi.Schema.object({
  accounts: import_koishi.Schema.array(AccountConfig).default([{
    name: "\u9ED8\u8BA4\u8D26\u53F7",
    type: "usage",
    baseUrl: "https://api.777358.xyz",
    apiKey: process.env.OPENAI_API_KEY || "",
    proxy: "",
    noProxy: []
  }]).description("\u53EF\u67E5\u8BE2\u7684 API \u8D26\u53F7\u5217\u8868\u3002"),
  timeout: import_koishi.Schema.natural().role("ms").default(15e3).description("\u8BF7\u6C42\u8D85\u65F6\u65F6\u95F4\u3002"),
  timezone: import_koishi.Schema.string().default("Asia/Shanghai").description("\u6708\u5EA6\u7EDF\u8BA1\u4F7F\u7528\u7684\u65F6\u533A\u3002")
});
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function buildUsageUrl(baseUrl) {
  const normalized = baseUrl.trim().replace(/`/g, "").replace(/\/+$/, "");
  return `${normalized.endsWith("/v1") ? normalized.slice(0, -3).replace(/\/+$/, "") : normalized}/v1/usage`;
}
__name(buildUsageUrl, "buildUsageUrl");
function buildDeepSeekBalanceUrl(baseUrl) {
  const normalized = baseUrl.trim().replace(/`/g, "").replace(/\/+$/, "");
  return `${normalized.replace(/\/v1$/, "")}/user/balance`;
}
__name(buildDeepSeekBalanceUrl, "buildDeepSeekBalanceUrl");
function getNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return void 0;
}
__name(getNumber, "getNumber");
function getBalance(data) {
  const quota = isRecord(data.quota) ? data.quota : void 0;
  const remaining = getNumber(quota?.remaining) ?? getNumber(quota?.balance) ?? getNumber(data.remaining) ?? getNumber(data.balance);
  const unit = String(quota?.unit ?? data.unit ?? "USD");
  return { remaining, unit };
}
__name(getBalance, "getBalance");
function getDeepSeekBalances(data) {
  return Array.isArray(data.balance_infos) ? data.balance_infos.filter(isRecord) : [];
}
__name(getDeepSeekBalances, "getDeepSeekBalances");
function formatNumber(value) {
  const number = getNumber(value);
  if (number === void 0) return value == null ? "-" : String(value);
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
__name(formatNumber, "formatNumber");
function formatUsage(value, unit) {
  if (!isRecord(value)) return `\u7528\u91CF\uFF1A${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
  const labels = {
    actual_cost: "\u5B9E\u9645\u8D39\u7528",
    cache_creation_tokens: "\u7F13\u5B58\u521B\u5EFA\u4EE4\u724C\u6570",
    cache_hit_rate: "\u7F13\u5B58\u547D\u4E2D\u7387",
    cache_read_tokens: "\u7F13\u5B58\u8BFB\u53D6\u4EE4\u724C\u6570",
    cache_write_tokens: "\u7F13\u5B58\u5199\u5165\u4EE4\u724C\u6570",
    cost: "\u8D39\u7528",
    input_tokens: "\u8F93\u5165\u4EE4\u724C\u6570",
    output_tokens: "\u8F93\u51FA\u4EE4\u724C\u6570",
    requests: "\u8BF7\u6C42\u6B21\u6570",
    total_cost: "\u603B\u8D39\u7528",
    total_tokens: "\u603B\u4EE4\u724C\u6570"
  };
  const lines = Object.entries(value).filter(([, item]) => item !== void 0 && item !== null).map(([key, item]) => {
    if (key === "cache_hit_rate") {
      const rate = getNumber(item);
      return `${labels[key]}\uFF1A${rate === void 0 ? formatNumber(item) : `${formatNumber(rate * 100)}%`}`;
    }
    return `${labels[key] || key}\uFF1A${formatNumber(item)}${["cost", "actual_cost", "amount", "total_cost"].includes(key) ? ` ${unit}` : ""}`;
  });
  return lines.length ? lines.join("\n") : "\u7528\u91CF\uFF1A-";
}
__name(formatUsage, "formatUsage");
function getDateKey(value) {
  if (typeof value !== "string" && typeof value !== "number") return void 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return void 0;
  return date;
}
__name(getDateKey, "getDateKey");
function getMonthKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value;
  const month = parts.find((item) => item.type === "month")?.value;
  return year && month ? `${year}-${month}` : void 0;
}
__name(getMonthKey, "getMonthKey");
function aggregateMonth(items, timezone) {
  const month = getMonthKey(/* @__PURE__ */ new Date(), timezone);
  const result = {};
  for (const item of items) {
    if (!isRecord(item)) continue;
    const date = getDateKey(item.date ?? item.day ?? item.timestamp);
    if (!date || getMonthKey(date, timezone) !== month) continue;
    for (const [key, value] of Object.entries(item)) {
      if (["date", "day", "timestamp"].includes(key)) continue;
      const number = getNumber(value);
      if (number !== void 0) result[key] = (getNumber(result[key]) ?? 0) + number;
    }
  }
  return result;
}
__name(aggregateMonth, "aggregateMonth");
function getMonthlyUsage(data, timezone) {
  const usage = isRecord(data.usage) ? data.usage : void 0;
  if (usage?.month !== void 0) return usage.month;
  const daily = Array.isArray(data.daily_usage) ? data.daily_usage : [];
  return aggregateMonth(daily, timezone);
}
__name(getMonthlyUsage, "getMonthlyUsage");
function isNoProxy(url, noProxy) {
  const hostname = new URL(url).hostname;
  return noProxy.some((pattern) => {
    const value = pattern.trim().toLowerCase();
    if (!value) return false;
    if (value === "*") return true;
    const host = hostname.toLowerCase();
    return host === value || (value.startsWith(".") ? host.endsWith(value) : host.endsWith(`.${value}`));
  });
}
__name(isNoProxy, "isNoProxy");
function errorText(error) {
  if (error instanceof Error && error.name === "AbortError") return "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
  if (isRecord(error) && isRecord(error.response)) {
    const status = getNumber(error.response.status);
    return status ? `\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${status}\uFF09\u3002` : "\u63A5\u53E3\u8BF7\u6C42\u5931\u8D25\u3002";
  }
  if (error instanceof Error && /timeout|ETIMEDOUT/i.test(error.message)) return "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
  return "\u65E0\u6CD5\u8FDE\u63A5\u4F59\u989D\u63A5\u53E3\uFF0C\u8BF7\u68C0\u67E5\u5730\u5740\u3001\u7F51\u7EDC\u548C\u914D\u7F6E\u3002";
}
__name(errorText, "errorText");
function getAccounts(config) {
  return (config.accounts || []).filter((account) => account && account.baseUrl?.trim());
}
__name(getAccounts, "getAccounts");
function resolveAccount(accounts, input) {
  const value = input?.trim();
  if (!value && accounts.length === 1) return accounts[0];
  if (!value) return void 0;
  const index = Number(value);
  if (Number.isInteger(index) && index >= 1 && index <= accounts.length) return accounts[index - 1];
  const exact = accounts.find((account) => account.name === value);
  if (exact) return exact;
  const matched = accounts.filter((account) => account.name.includes(value));
  return matched.length === 1 ? matched[0] : void 0;
}
__name(resolveAccount, "resolveAccount");
function accountList(accounts) {
  return accounts.map((account, index) => `${index + 1}. ${account.name || `\u8D26\u53F7${index + 1}`}`).join("\n");
}
__name(accountList, "accountList");
function apply(ctx, config) {
  const request = /* @__PURE__ */ __name(async (account) => {
    const apiKey = account.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("\u672A\u914D\u7F6E API \u5BC6\u94A5\u3002");
    const url = account.type === "deepseek" ? buildDeepSeekBalanceUrl(account.baseUrl || "https://api.deepseek.com") : buildUsageUrl(account.baseUrl);
    const requestConfig = {
      timeout: config.timeout,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    };
    if (account.proxy && !isNoProxy(url, account.noProxy || [])) requestConfig.proxyAgent = account.proxy;
    return ctx.http.get(url, requestConfig);
  }, "request");
  const chooseAccounts = /* @__PURE__ */ __name(async (session, input) => {
    const accounts = getAccounts(config);
    if (!accounts.length) throw new Error("\u672A\u914D\u7F6E API \u8D26\u53F7\u3002");
    if (!input?.trim()) return accounts;
    const account = resolveAccount(accounts, input);
    if (account) return [account];
    if (!session?.prompt) throw new Error(`\u672A\u627E\u5230\u8D26\u53F7\uFF0C\u8BF7\u4F7F\u7528\u8D26\u53F7\u5E8F\u53F7\u6216\u6635\u79F0\u3002
${accountList(accounts)}`);
    await session.send(`\u8BF7\u9009\u62E9 API \u8D26\u53F7\uFF1A
${accountList(accounts)}`);
    const answer = await session.prompt(3e4);
    const selected = resolveAccount(accounts, answer);
    if (selected) return [selected];
    throw new Error(`\u672A\u9009\u62E9\u6709\u6548\u8D26\u53F7\uFF0C\u8BF7\u4F7F\u7528\u8D26\u53F7\u5E8F\u53F7\u6216\u6635\u79F0\u3002
${accountList(accounts)}`);
  }, "chooseAccounts");
  const queryAccount = /* @__PURE__ */ __name(async (account, monthly) => {
    try {
      const data = await request(account);
      if (account.type === "deepseek") {
        const balances = getDeepSeekBalances(data);
        const lines = balances.length ? balances.flatMap((balance) => [
          `${String(balance.currency || "\u672A\u77E5\u5E01\u79CD")} \u603B\u4F59\u989D\uFF1A${formatNumber(balance.total_balance)}`,
          `${String(balance.currency || "\u672A\u77E5\u5E01\u79CD")} \u8D60\u91D1\u4F59\u989D\uFF1A${formatNumber(balance.granted_balance)}`,
          `${String(balance.currency || "\u672A\u77E5\u5E01\u79CD")} \u5145\u503C\u4F59\u989D\uFF1A${formatNumber(balance.topped_up_balance)}`
        ]) : ["\u4F59\u989D\u4FE1\u606F\uFF1A-"];
        return [
          `\u8D26\u53F7\uFF1A${account.name || "-"}`,
          `\u72B6\u6001\uFF1A${data.is_available === false ? "\u4E0D\u53EF\u7528" : "\u53EF\u7528"}`,
          ...lines
        ].join("\n");
      }
      const { remaining, unit } = getBalance(data);
      const usage = monthly ? getMonthlyUsage(data, config.timezone) : isRecord(data.usage) ? data.usage.today : void 0;
      const label = monthly ? "\u672C\u6708\u7528\u91CF" : "\u4ECA\u65E5\u7528\u91CF";
      const status = data.isValid ?? data.is_active;
      return [
        `\u8D26\u53F7\uFF1A${account.name || "-"}`,
        `\u4F59\u989D\uFF1A${formatNumber(remaining)} ${unit}`,
        `\u72B6\u6001\uFF1A${status === false ? "\u65E0\u6548" : "\u6709\u6548"}`,
        `${label}\uFF1A`,
        formatUsage(usage, unit)
      ].join("\n");
    } catch (error) {
      const message = error instanceof Error && error.message === "\u672A\u914D\u7F6E API \u5BC6\u94A5\u3002" ? error.message : errorText(error);
      return `\u8D26\u53F7\uFF1A${account.name || "-"}
\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A${message}`;
    }
  }, "queryAccount");
  const report = /* @__PURE__ */ __name(async (session, monthly, input) => {
    try {
      const accounts = await chooseAccounts(session, input);
      const reports = await Promise.all(accounts.map((account) => queryAccount(account, monthly)));
      return [monthly ? "API \u6708\u5EA6\u4F59\u989D\u67E5\u8BE2" : "API \u4ECA\u65E5\u4F59\u989D\u67E5\u8BE2", ...reports].join("\n\n");
    } catch (error) {
      const message = error instanceof Error && ["\u672A\u914D\u7F6E API \u5BC6\u94A5\u3002", "\u672A\u914D\u7F6E API \u8D26\u53F7\u3002"].includes(error.message) ? error.message : error instanceof Error && error.message.includes("\u672A\u627E\u5230\u8D26\u53F7") || error instanceof Error && error.message.includes("\u672A\u9009\u62E9\u6709\u6548\u8D26\u53F7") ? error.message : errorText(error);
      return `\u4F59\u989D\u67E5\u8BE2\u5931\u8D25\uFF1A${message}`;
    }
  }, "report");
  ctx.command("api.day [account:text]", "\u67E5\u8BE2\u4ECA\u65E5 API \u4F59\u989D\u4E0E\u7528\u91CF").action(({ session }, account) => report(session, false, account));
  ctx.command("api.month [account:text]", "\u67E5\u8BE2\u672C\u6708 API \u4F59\u989D\u4E0E\u7528\u91CF").action(({ session }, account) => report(session, true, account));
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});

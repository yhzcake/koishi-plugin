var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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
var import_node_crypto5 = require("node:crypto");
var import_qrcode = __toESM(require("qrcode"));

// src/accounts.ts
var import_node_crypto = require("node:crypto");
var gameBiz = {
  hk4e_cn: "gs",
  hk4e_global: "gs",
  hkrpg_cn: "sr",
  hkrpg_global: "sr",
  nap_cn: "zzz",
  nap_global: "zzz",
  nxx_cn: "wd",
  nxx_global: "wd",
  nxx_tw: "wd",
  bh3_cn: "bh3",
  bh3_global: "bh3",
  bh2_cn: "bh2"
};
function parseCookie(cookie, kind) {
  if (cookie.length > 4096 || /[\r\n\x00-\x1f]/.test(cookie)) throw new Error("\u51ED\u8BC1\u683C\u5F0F\u65E0\u6548\u3002");
  const fields = /* @__PURE__ */ new Map();
  for (const segment of cookie.split(";")) {
    const index = segment.indexOf("=");
    if (index < 1) continue;
    const name2 = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (name2 && value) fields.set(name2, value);
  }
  const ltuid = fields.get("ltuid") || fields.get("login_uid") || fields.get("stuid") || fields.get("account_id") || fields.get("ltuid_v2");
  if (!ltuid || !/^\d{1,20}$/.test(ltuid)) throw new Error("\u7F3A\u5C11\u6570\u5B57\u901A\u884C\u8BC1 ID\u3002");
  const identities = ["ltuid", "login_uid", "stuid", "account_id", "ltuid_v2", "account_id_v2"].map((name2) => fields.get(name2)).filter(Boolean);
  if (identities.some((value) => value !== ltuid)) throw new Error("\u901A\u884C\u8BC1 ID \u5B57\u6BB5\u4E0D\u4E00\u81F4\u3002");
  if (kind === "ck" && !(fields.get("cookie_token") || fields.get("cookie_token_v2"))) throw new Error("\u7F3A\u5C11 cookie_token\u3002");
  if (kind === "stoken" && !(fields.get("stoken") || fields.get("stoken_v2")) || kind === "stoken" && !(fields.get("ltoken") || fields.get("ltoken_v2"))) throw new Error("SToken \u987B\u5305\u542B stoken \u4E0E ltoken\u3002");
  return { ltuid, cookie: cookie.trim() };
}
__name(parseCookie, "parseCookie");
function createAccounts(ctx, keyText) {
  const key = Buffer.from(keyText, "base64");
  if (key.length !== 32 || key.toString("base64") !== keyText) throw new Error("MIYOUSHE_SIGN_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282\u968F\u673A\u5BC6\u94A5\u7684\u6807\u51C6 base64 \u7F16\u7801\u3002");
  ctx.model.extend("miyoushe_passport", {
    id: "string",
    platform: "string",
    userId: "string",
    ltuid: "string",
    cookie: "text",
    stoken: "text",
    device: "text",
    enabled: "boolean",
    communityEnabled: "boolean",
    followMissions: "boolean",
    fpExpires: "string",
    lastMissionDay: "string"
  }, { primary: "id" });
  ctx.model.extend("miyoushe_role", {
    id: "string",
    platform: "string",
    userId: "string",
    ltuid: "string",
    game: "string",
    uid: "string",
    region: "string",
    current: "boolean",
    lastDay: "string"
  }, { primary: "id" });
  const id = /* @__PURE__ */ __name((...parts) => (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(parts)).digest("hex"), "id");
  const seal = /* @__PURE__ */ __name((value, aad) => {
    const nonce = (0, import_node_crypto.randomBytes)(12);
    const cipher = (0, import_node_crypto.createCipheriv)("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify(aad)));
    return Buffer.concat([nonce, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
  }, "seal");
  const open = /* @__PURE__ */ __name((value, aad) => {
    const bytes = Buffer.from(value, "base64");
    if (bytes.length < 29) throw new Error("\u52A0\u5BC6\u6570\u636E\u635F\u574F\u3002");
    const decipher = (0, import_node_crypto.createDecipheriv)("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(JSON.stringify(aad)));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString("utf8");
  }, "open");
  const passport = /* @__PURE__ */ __name(async (platform, userId, ltuid) => {
    const [row] = await ctx.database.get("miyoushe_passport", { id: id(platform, userId, ltuid) });
    return row?.platform === platform && row.userId === userId && row.ltuid === ltuid ? row : void 0;
  }, "passport");
  return {
    id,
    passport,
    passports: /* @__PURE__ */ __name((platform, userId) => ctx.database.get("miyoushe_passport", { platform, userId }), "passports"),
    all: /* @__PURE__ */ __name(() => ctx.database.get("miyoushe_passport", {}), "all"),
    roles: /* @__PURE__ */ __name((platform, userId) => ctx.database.get("miyoushe_role", { platform, userId }), "roles"),
    async save(platform, userId, ltuid, cookie, roles) {
      const previous = await passport(platform, userId, ltuid);
      const existing = await ctx.database.get("miyoushe_role", { platform, userId });
      const selectedGames = new Set(existing.filter((role) => role.current && role.ltuid !== ltuid).map((role) => role.game));
      const newRoles = roles.map((role) => {
        const old = existing.find((item) => item.game === role.game && item.uid === role.uid && item.region === role.region && item.ltuid === ltuid);
        const current = old?.current || !selectedGames.has(role.game) && !existing.some((item) => item.game === role.game && item.current && item.ltuid === ltuid && roles.some((next) => next.game === role.game && next.uid === item.uid && next.region === item.region));
        if (current) selectedGames.add(role.game);
        return {
          id: id(platform, userId, ltuid, role.game, role.uid, role.region),
          platform,
          userId,
          ltuid,
          game: role.game,
          uid: role.uid,
          region: role.region,
          current: !!current,
          lastDay: old?.lastDay || ""
        };
      });
      await ctx.database.upsert("miyoushe_passport", [{
        id: id(platform, userId, ltuid),
        platform,
        userId,
        ltuid,
        cookie: seal(cookie, [platform, userId, ltuid, "ck"]),
        stoken: previous?.stoken || "",
        device: previous?.device || "",
        enabled: previous?.enabled || false,
        communityEnabled: previous?.communityEnabled || false,
        followMissions: previous?.followMissions || false,
        fpExpires: previous?.fpExpires || "",
        lastMissionDay: previous?.lastMissionDay || ""
      }]);
      for (const old of existing.filter((item) => item.ltuid === ltuid && !newRoles.some((role) => role.id === item.id))) {
        await ctx.database.remove("miyoushe_role", { id: old.id });
      }
      if (newRoles.length) await ctx.database.upsert("miyoushe_role", newRoles);
      const remaining = await ctx.database.get("miyoushe_role", { platform, userId });
      const chosen = new Set(remaining.filter((role) => role.current).map((role) => role.game));
      for (const role of remaining.filter((role2) => !role2.current && !chosen.has(role2.game))) {
        await ctx.database.set("miyoushe_role", { id: role.id }, { current: true });
        chosen.add(role.game);
      }
      return newRoles;
    },
    async saveToken(platform, userId, ltuid, token) {
      const row = await passport(platform, userId, ltuid);
      if (!row) {
        await ctx.database.upsert("miyoushe_passport", [{ id: id(platform, userId, ltuid), platform, userId, ltuid, cookie: "", stoken: seal(token, [platform, userId, ltuid, "stoken"]), device: "", enabled: false, communityEnabled: false, followMissions: false, fpExpires: "", lastMissionDay: "" }]);
        return true;
      }
      await ctx.database.set("miyoushe_passport", { id: row.id }, { stoken: seal(token, [platform, userId, ltuid, "stoken"]) });
      return true;
    },
    async removeToken(platform, userId, ltuid) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.stoken) return false;
      if (!row.cookie) await ctx.database.remove("miyoushe_passport", { id: row.id });
      else await ctx.database.set("miyoushe_passport", { id: row.id }, { stoken: "", communityEnabled: false, followMissions: false });
      return true;
    },
    async use(platform, userId, ltuid, kind, callback) {
      const row = await passport(platform, userId, ltuid);
      if (!row || !row[kind === "ck" ? "cookie" : "stoken"]) throw new Error("\u672A\u7ED1\u5B9A\u8BE5\u51ED\u8BC1\u3002");
      return callback(open(row[kind === "ck" ? "cookie" : "stoken"], [platform, userId, ltuid, kind]), row);
    },
    async device(platform, userId, ltuid, callback) {
      const row = await passport(platform, userId, ltuid);
      if (!row) throw new Error("\u672A\u7ED1\u5B9A\u8BE5\u901A\u884C\u8BC1\u3002");
      return callback(row.device ? JSON.parse(open(row.device, [platform, userId, ltuid, "device"])) : void 0);
    },
    async setDevice(platform, userId, ltuid, device) {
      const row = await passport(platform, userId, ltuid);
      if (!row) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { device: device ? seal(JSON.stringify(device), [platform, userId, ltuid, "device"]) : "", fpExpires: "" });
      return true;
    },
    async saveFingerprint(platform, userId, ltuid, device) {
      const row = await passport(platform, userId, ltuid);
      if (!row) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { device: seal(JSON.stringify(device), [platform, userId, ltuid, "device"]), fpExpires: String(Date.now() + 7 * 864e5) });
      return true;
    },
    async setEnabled(platform, userId, ltuid, enabled) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.cookie) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { enabled });
      return true;
    },
    async setCommunityEnabled(platform, userId, ltuid, enabled) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.stoken) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { communityEnabled: enabled, ...enabled ? { followMissions: false } : {} });
      return true;
    },
    async setFollowMissions(platform, userId, ltuid, enabled) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.stoken) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { followMissions: enabled, ...enabled ? { communityEnabled: false } : {} });
      return true;
    },
    async markMissionDay(platform, userId, ltuid, day2, mode) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.stoken || row.lastMissionDay === day2 || (mode === "follow" ? !row.enabled || !row.cookie || !row.followMissions : !row.communityEnabled || row.followMissions)) return false;
      await ctx.database.set("miyoushe_passport", { id: row.id }, { lastMissionDay: day2 });
      return true;
    },
    async choose(platform, userId, game, uid) {
      const roles = (await ctx.database.get("miyoushe_role", { platform, userId })).filter((role) => role.game === game);
      const selected = roles.find((role) => role.uid === uid);
      if (!selected) return false;
      for (const role of roles) await ctx.database.set("miyoushe_role", { id: role.id }, { current: role.id === selected.id });
      return true;
    },
    async mark(role, day2) {
      const [current] = await ctx.database.get("miyoushe_role", { id: role.id });
      if (current) await ctx.database.set("miyoushe_role", { id: role.id }, { lastDay: day2 });
    },
    async remove(platform, userId, ltuid) {
      const row = await passport(platform, userId, ltuid);
      if (!row?.cookie) return false;
      if (row.stoken) await ctx.database.set("miyoushe_passport", { id: row.id }, { cookie: "", device: "", enabled: false });
      else await ctx.database.remove("miyoushe_passport", { id: row.id });
      const roles = await ctx.database.get("miyoushe_role", { platform, userId, ltuid });
      for (const role of roles) await ctx.database.remove("miyoushe_role", { id: role.id });
      const remaining = await ctx.database.get("miyoushe_role", { platform, userId });
      const chosen = new Set(remaining.filter((role) => role.current).map((role) => role.game));
      for (const role of remaining.filter((role2) => !role2.current && !chosen.has(role2.game))) {
        await ctx.database.set("miyoushe_role", { id: role.id }, { current: true });
        chosen.add(role.game);
      }
      return true;
    }
  };
}
__name(createAccounts, "createAccounts");

// src/client.ts
var import_node_crypto2 = require("node:crypto");
var games = {
  gs: { name: "\u539F\u795E", cn: ["hk4e", "e202311201442471"], os: ["sol", "e202102251931481"] },
  sr: { name: "\u661F\u7A79\u94C1\u9053", cn: ["hkrpg", "e202304121516551"], os: ["luna/hkrpg/os", "e202303301540311"] },
  zzz: { name: "\u7EDD\u533A\u96F6", cn: ["zzz", "e202406242138391"], os: ["luna/zzz/os", "e202406031448091"] },
  bh3: { name: "\u5D29\u574F3", cn: ["bh3", "e202306201626331"], os: ["mani", "e202110291205111"] },
  bh2: { name: "\u5D29\u574F\u5B66\u56ED2", cn: ["bh2", "e202203291431091"] },
  wd: { name: "\u672A\u5B9A\u4E8B\u4EF6\u7C3F", cn: ["nxx", "e202202251749321"], os: ["luna/nxx/os", "e202202281857121"] }
};
var forums = { bh3: 1, gs: 2, bh2: 3, wd: 4, dby: 5, sr: 6, zzz: 8, hna: 9, planet: 10 };
function ds(salt, body) {
  const time = Math.floor(Date.now() / 1e3);
  const random = body ? String((0, import_node_crypto2.randomInt)(100001, 200001)) : Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[(0, import_node_crypto2.randomInt)(36)]).join("");
  const input = body ? `salt=${salt}&t=${time}&r=${random}&b=${body}&q=` : `salt=${salt}&t=${time}&r=${random}`;
  const hash = (0, import_node_crypto2.createHash)("md5").update(input).digest("hex");
  return `${time},${random},${hash}`;
}
__name(ds, "ds");
function recordDs(query, body, cn) {
  const time = Math.floor(Date.now() / 1e3);
  const random = String((0, import_node_crypto2.randomInt)(1e5, 1e6));
  const salt = cn ? "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs" : "okr4obncj8bw5a65hbnn5oo6ixjc3l9w";
  const hash = (0, import_node_crypto2.createHash)("md5").update(`salt=${salt}&t=${time}&r=${random}&b=${body}&q=${query}`).digest("hex");
  return `${time},${random},${hash}`;
}
__name(recordDs, "recordDs");
function createClient(ctx, timeout, interval) {
  let next = 0;
  let queue = Promise.resolve();
  const qrDeviceId = (0, import_node_crypto2.randomUUID)();
  const qrLifecycleId = (0, import_node_crypto2.randomUUID)();
  async function request(url, secret, method, body, community = false, device) {
    const hostname = new URL(url).hostname;
    if (!["api-takumi.mihoyo.com", "sg-act-public-api.hoyolab.com", "bbs-api.miyoushe.com", "api-takumi-record.mihoyo.com", "sg-public-api.hoyolab.com", "passport-api.miyoushe.com", "public-data-api.mihoyo.com", "sg-public-data-api.hoyoverse.com"].includes(hostname)) {
      throw new Error("\u8BF7\u6C42\u5730\u5740\u4E0D\u5728\u5141\u8BB8\u5217\u8868\u3002");
    }
    const task = queue.catch(() => {
    }).then(async () => {
      const delay = Math.max(0, next - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      next = Date.now() + interval;
      const overseas = hostname.endsWith("hoyolab.com");
      const headers = {
        "User-Agent": community ? "okhttp/4.9.3" : `Mozilla/5.0 (Linux; Android 13; XQ-BC52 Build/61.2.A.0.472A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.5563.116 Mobile Safari/537.36 ${overseas ? "miHoYoBBSOversea/2.57.1" : "miHoYoBBS/2.73.1"}`,
        Accept: "application/json",
        Referer: community ? "https://app.mihoyo.com/" : overseas ? "https://act.hoyolab.com/" : "https://act.mihoyo.com/",
        Cookie: secret
      };
      headers["x-rpc-app_version"] = overseas ? "2.57.1" : "2.73.1";
      headers["x-rpc-client_type"] = community || overseas ? "2" : "5";
      if (community) {
        headers["x-rpc-channel"] = "miyousheluodi";
        headers["x-rpc-device_model"] = "XQ-BC52";
        headers["x-rpc-device_name"] = "Sony XQ-BC52";
        headers["x-rpc-sys_version"] = "12";
      } else if (hostname === "passport-api.miyoushe.com") {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
        headers["x-rpc-device_os"] = "Windows 10 64-bit";
        headers["x-rpc-client_type"] = "4";
        headers["x-rpc-app_id"] = "bll8iq97cem8";
        headers["x-rpc-game_biz"] = "bbs_cn";
        headers["x-rpc-device_id"] = qrDeviceId;
        headers["x-rpc-device_name"] = "Chrome";
        headers["x-rpc-device_model"] = "Chrome 149.0.0.0";
        headers["x-rpc-device_fp"] = "38d805974f6af";
        headers["x-rpc-sdk_version"] = "2.54.0";
        headers["x-rpc-lifecycle_id"] = qrLifecycleId;
        headers.Connection = "keep-alive";
      } else if (url.includes("/event/") && !url.includes("/game_record/")) {
        const game = /\/event\/(?:luna\/)?([^/]+)/.exec(url)?.[1];
        const signgame = { hk4e: "hk4e", sol: "hk4e", hkrpg: "hkrpg", zzz: "zzz", mani: "bh3", bh3: "bh3", bh2: "bh2", nxx: "nxx" }[game || ""];
        if (signgame) headers["x-rpc-signgame"] = signgame;
        headers["x-rpc-platform"] = "android";
        headers["x-rpc-channel"] = overseas ? "google" : "miyousheluodi";
        headers["X-Requested-With"] = overseas ? "com.mihoyo.hoyolab" : "com.mihoyo.hyperion";
      }
      if (body) headers["Content-Type"] = "application/json";
      if (hostname === "api-takumi-record.mihoyo.com" || hostname === "sg-act-public-api.hoyolab.com" && url.includes("/game_record/") || hostname.includes("public-data-api.")) {
        const signgame = url.includes("/hkrpg/") ? "hkrpg" : url.includes("/genshin/") ? "hk4e" : url.includes("/zzz/") ? "zzz" : void 0;
        if (signgame) headers["x-rpc-signgame"] = signgame;
        headers["x-rpc-device_name"] = "Sony XQ-BC52";
        headers["x-rpc-device_model"] = "XQ-BC52";
        headers["x-rpc-csm_source"] = "myself";
        headers["x-rpc-platform"] = "android";
        headers["x-rpc-channel"] = overseas ? "google" : "miyousheluodi";
        headers["x-rpc-sys_version"] = "13";
        headers.DS = recordDs(new URL(url).search.slice(1), body ? JSON.stringify(body) : "", hostname.endsWith("mihoyo.com"));
      } else if (community) {
        headers.DS = method === "POST" && body ? ds("t0qEgfub6cvueAPgR5m9aQWWVciEer7v", JSON.stringify(body)) : ds("WGtruoQrwczmsjLOPXzJLnaAYycsLavx");
      } else if (hostname !== "passport-api.miyoushe.com") {
        headers.DS = ds("jEpJb9rRARU2rXDA9qYbZ3selxkuct9a");
      }
      if (device?.deviceId) headers["x-rpc-device_id"] = device.deviceId;
      if (device?.deviceFp) headers["x-rpc-device_fp"] = device.deviceFp;
      if (device && (hostname === "api-takumi-record.mihoyo.com" || hostname.includes("public-data-api."))) {
        headers["x-rpc-device_name"] ||= "Sony XQ-BC52";
        headers["x-rpc-device_model"] ||= "XQ-BC52";
        headers["x-rpc-platform"] ||= "android";
        headers["x-rpc-sys_version"] ||= "13";
      }
      const response = await ctx.http(url, { method, headers, data: body, timeout, redirect: "error" });
      if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
      const result = response.data;
      if (!result || typeof result.retcode !== "number") throw new Error("\u63A5\u53E3\u54CD\u5E94\u683C\u5F0F\u9519\u8BEF");
      if (process.env.MIYOUSHE_DEBUG_RECORD === "1" && (hostname.includes("record") || hostname.includes("public-data"))) {
        ctx.logger.info(`[record-debug] ${method} ${new URL(url).pathname} retcode=${result.retcode} message=${result.message || "-"} device=${device?.deviceId ? "id" : "-"} fp=${device?.deviceFp ? "fp" : "-"}`);
      }
      return result;
    });
    queue = task.then(() => {
    }, () => {
    });
    return task;
  }
  __name(request, "request");
  return {
    async qrCreate() {
      const result = await request("https://passport-api.miyoushe.com/account/ma-cn-passport/app/createQRLogin", "", "POST", {});
      const url = result.data?.url;
      const ticket = result.data?.ticket;
      if (result.retcode !== 0 || typeof url !== "string" || typeof ticket !== "string" || !ticket || ticket.length > 1024) throw new Error("\u4E8C\u7EF4\u7801\u751F\u6210\u5931\u8D25\u3002");
      const target = new URL(url);
      if (target.protocol !== "https:" || !["miyoushe.com", "mihoyo.com"].some((domain) => target.hostname === domain || target.hostname.endsWith(`.${domain}`))) throw new Error("\u626B\u7801\u94FE\u63A5\u57DF\u540D\u65E0\u6548\u3002");
      return { url, ticket };
    },
    async qrStatus(ticket) {
      return request("https://passport-api.miyoushe.com/account/ma-cn-passport/app/queryQRLoginStatus", "", "POST", { ticket });
    },
    async qrExchange(stoken, mid) {
      const result = await request("https://passport-api.miyoushe.com/account/ma-cn-session/app/exchange", "", "POST", { src_token: { token: stoken, token_type: 1 }, mid, dst_token_type: 4 });
      const token = result.data?.token?.token;
      if (result.retcode !== 0 || typeof token !== "string" || !/^[^;\s\x00-\x1f]{1,2048}$/.test(token)) throw new Error("LToken \u6362\u53D6\u5931\u8D25\u3002");
      return token;
    },
    async exchangeCookie(secret, ltuid, gameBiz2 = "hk4e_cn") {
      const overseas = gameBiz2.endsWith("_global");
      const host = overseas ? "https://sg-public-api.hoyolab.com" : "https://api-takumi.mihoyo.com";
      const result = await request(`${host}/auth/api/getCookieAccountInfoBySToken?game_biz=${encodeURIComponent(gameBiz2)}`, secret, overseas ? "POST" : "GET");
      const token = result.data?.cookie_token;
      if (result.retcode !== 0 || typeof token !== "string" || !/^[^;\s\x00-\x1f]{1,2048}$/.test(token)) throw new Error("CK \u6362\u53D6\u5931\u8D25\u3002");
      const ltoken = /(?:^|;)\s*ltoken=([^;]+)/.exec(secret)?.[1];
      if (!ltoken || !/^[^;\s\x00-\x1f]{1,2048}$/.test(ltoken) || !/^\d{1,20}$/.test(ltuid)) throw new Error("SToken \u6570\u636E\u4E0D\u5B8C\u6574\u3002");
      return `ltoken=${ltoken};ltuid=${ltuid};cookie_token=${token};account_id=${ltuid};`;
    },
    async fingerprint(deviceId, overseas, secret) {
      if (!/^[a-zA-Z0-9_-]{8,128}$/.test(deviceId)) throw new Error("\u8BBE\u5907 ID \u65E0\u6548\u3002");
      const seed = (0, import_node_crypto2.randomUUID)();
      const body = {
        app_name: overseas ? "bbs_oversea" : "bbs_cn",
        device_fp: overseas ? "38d7f4c72b736" : "38d805c20d53d",
        device_id: deviceId,
        ext_fields: JSON.stringify({ deviceName: "Sony XQ-BC52", model: "XQ-BC52", brand: "Sony", osVersion: "13", packageName: overseas ? "com.mihoyo.hoyolab" : "com.mihoyo.hyperion" }),
        ...overseas ? { hoyolab_device_id: deviceId } : { bbs_device_id: deviceId },
        platform: "2",
        seed_id: seed,
        seed_time: String(Date.now())
      };
      const host = overseas ? "https://sg-public-data-api.hoyoverse.com" : "https://public-data-api.mihoyo.com";
      const result = await request(`${host}/device-fp/api/getFp`, secret, "POST", body, false, { deviceId, deviceFp: "" });
      const fp = result.data?.device_fp;
      if (result.retcode !== 0 || typeof fp !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(fp)) throw new Error("\u83B7\u53D6\u8BBE\u5907\u6307\u7EB9\u5931\u8D25\u3002");
      return fp;
    },
    async discover(secret) {
      for (const host of ["https://api-takumi.mihoyo.com", "https://sg-public-api.hoyolab.com"]) {
        try {
          const result = await request(`${host}/binding/api/getUserGameRolesByCookie`, secret, "GET");
          if (result.retcode !== 0 || !Array.isArray(result.data?.list)) continue;
          const roles = result.data.list.flatMap((role) => {
            if (!role || typeof role !== "object") return [];
            const item = role;
            const game = gameBiz[String(item.game_biz)];
            const uid = String(item.game_uid || "");
            const region = String(item.region || "");
            return game && /^\d{1,20}$/.test(uid) && /^[a-zA-Z0-9_-]{2,40}$/.test(region) ? [{ game, uid, region }] : [];
          });
          return roles.filter((role, index) => roles.findIndex((other) => other.game === role.game && other.uid === role.uid && other.region === role.region) === index);
        } catch {
          continue;
        }
      }
      return [];
    },
    async record(url, secret, body, device) {
      return request(url, secret, body ? "POST" : "GET", body, false, device);
    },
    async game(account, secret, game, device) {
      const config = games[game];
      const cn = account.region.startsWith("cn_") || account.region.endsWith("_cn");
      const spec = cn ? config.cn : "os" in config ? config.os : void 0;
      if (!spec) return { text: "\u8BE5\u6E38\u620F\u6682\u4E0D\u652F\u6301\u6240\u9009\u533A\u670D\u3002", done: false };
      const host = cn ? "https://api-takumi.mihoyo.com" : "https://sg-act-public-api.hoyolab.com";
      const path = cn ? `luna/${spec[0]}` : spec[0];
      const base = `${host}/event/${path}`;
      const language = game === "wd" && account.region === "tw_prod_wd01" ? "zh-tw" : "zh-cn";
      const activity = game === "wd" && account.region === "tw_prod_wd01" ? "e202308141137581" : spec[1];
      const params = new URLSearchParams({ act_id: activity, lang: language });
      if (cn) {
        params.set("region", account.region);
        params.set("uid", account.uid);
      }
      const info = await request(`${base}/info?${params}`, secret, "GET", void 0, false, device);
      if (info.retcode !== 0) return { text: `${config.name}\uFF1A\u72B6\u6001\u67E5\u8BE2\u5931\u8D25\uFF08${info.retcode}\uFF09\u3002`, done: false };
      if (info.data?.is_sign === true) return { text: `${config.name}\uFF1A\u4ECA\u65E5\u5DF2\u7B7E\u3002`, done: true };
      if (info.data?.first_bind || info.data?.send_first) return { text: `${config.name}\uFF1A\u9996\u6B21\u7ED1\u5B9A\u9700\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u624B\u52A8\u7B7E\u5230\u3002`, done: false };
      const body = { act_id: activity, lang: language };
      if (cn) Object.assign(body, { region: account.region, uid: account.uid });
      const signed = await request(`${base}/sign`, secret, "POST", body, false, device);
      if (signed.retcode === -5003) return { text: `${config.name}\uFF1A\u4ECA\u65E5\u5DF2\u7B7E\u3002`, done: true };
      if (signed.retcode !== 0) return { text: `${config.name}\uFF1A\u7B7E\u5230\u5931\u8D25\uFF08${signed.retcode}\uFF09\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u68C0\u67E5\u8D26\u53F7\u72B6\u6001\u3002`, done: false };
      const confirmed = await request(`${base}/info?${params}`, secret, "GET", void 0, false, device);
      return confirmed.retcode === 0 && confirmed.data?.is_sign === true ? { text: `${config.name}\uFF1A\u7B7E\u5230\u6210\u529F\u3002`, done: true } : { text: `${config.name}\uFF1A\u63A5\u53E3\u5DF2\u63A5\u53D7\u8BF7\u6C42\uFF0C\u4F46\u72B6\u6001\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u5230\u5B98\u65B9\u5BA2\u6237\u7AEF\u6838\u5B9E\u3002`, done: false };
    },
    async forum(secret, forum, device) {
      const id = forums[forum];
      const host = "https://bbs-api.miyoushe.com/apihub";
      const status = await request(`${host}/sapi/querySignInStatus?gids=${id}`, secret, "GET", void 0, true, device);
      if (status.retcode !== 0) return { text: `${forum}\u793E\u533A\uFF1A\u72B6\u6001\u67E5\u8BE2\u5931\u8D25\uFF08${status.retcode}\uFF09\u3002`, done: false };
      if (status.data?.is_signed === true) return { text: `${forum}\u793E\u533A\uFF1A\u4ECA\u65E5\u5DF2\u7B7E\u3002`, done: true };
      const signed = await request(`${host}/app/api/signIn`, secret, "POST", { gids: String(id) }, true, device);
      if (signed.retcode !== 0) return { text: `${forum}\u793E\u533A\uFF1A\u7B7E\u5230\u5931\u8D25\uFF08${signed.retcode}\uFF09\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u68C0\u67E5\u8D26\u53F7\u72B6\u6001\u3002`, done: false };
      const confirmed = await request(`${host}/sapi/querySignInStatus?gids=${id}`, secret, "GET", void 0, true, device);
      return confirmed.retcode === 0 && confirmed.data?.is_signed === true ? { text: `${forum}\u793E\u533A\uFF1A\u7B7E\u5230\u6210\u529F\u3002`, done: true } : { text: `${forum}\u793E\u533A\uFF1A\u63A5\u53E3\u5DF2\u63A5\u53D7\u8BF7\u6C42\uFF0C\u4F46\u72B6\u6001\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u5230\u5B98\u65B9\u5BA2\u6237\u7AEF\u6838\u5B9E\u3002`, done: false };
    }
  };
}
__name(createClient, "createClient");

// src/starrail-data.ts
var import_node_zlib = require("node:zlib");
var source = "https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_new/cn/";
function decode(value) {
  return JSON.parse((0, import_node_zlib.gunzipSync)(Buffer.from(value, "base64")).toString("utf8"));
}
__name(decode, "decode");
var characters = "H4sIAAAAAAACCrWdWY8lx5Gl/0s+zBPRfd3MfAm+NQY9QKNHjZ7pwehhMGjUUAWxILIolChgBEEAKYrNTVxFQeSwKK6iWq2Vm1QSRfK/CHVz+ReDzLz2mWelR6aTKD3xsOKGhZsfj7hhx47f/O5e2mzS3r3f3bv2tb17T//nnr3rVx68unfv3u1bT+3ffPL2rcf27tm7ceXGtYe/s3ev3bP3zSsP3793794/Xr/29fsf3rtn7+oDVx+8ev3hvXv3/uG+q3v37F2776Hre/ee/Odv77v/yo0r9z189cbfHof+m29e//pJrOvf+Nbevf/r5HInFzwB4kAdmIPsoOz973v2vvWNaw888MUCFAeVAP/68I2rVyNKhIk4ESgibeoOxYXjynFp4ahwVLqjBsqgAqqgBlocpc1xDg9e+b//+q1v7t2bZPO9kwPSsyg9i3/cf/SlIYX//aGvf/vqGQa/eu361y6iUAYUkiqZkih5kqYMKJwLUBysUCibCBNxIlBE8ukVKBQoFCiUGFaMS7qjBsqgAqqgBloc3UHhZkeh9hRqULj9+a+2v36hozBD4VeufP0sg//l2o0Lb0IdMKieqXqi6nmqp6mepQ4YnAtQHKwwqJsIE3EiUETy2VUYVBhUGFQYVBhU6Y4aKIMKqIIaaHG0chNaz6AFgwc/em/7u5cPnvrjkMSvXrnxwEP3fePss/TBK1+/dv3Kje9cRKYNyDRP2jxn85TNMzZP2AZkzgUoDk6mKU6L8+LEODNO3Z07XAi2iSHEGGIQMQonyVgIxkIwFoKxEIyFYNIdNVAGFVAFNdDiKG3IppuAbga6KejmIKYtxWkpTktxmsQHJD4g/QcsYA5YAtaALeACXFnOuV/OuXsgPfvW4dOvbp99a3o5/4/7v339a1dvXLSY82AxZycuO2/ZacvOWnbS8mAxzwUoDnyeMnOemfLMjGcmPDPJeW0x500MIcYQg4hR+ELLLObMYs4s5sxizizmLN1RA2VQAVVQAy2OWMx5001ANwPdFHRzENMWiznHYs6xmHMs5hyLOUv/AQuYA5aANWALuABXFnPpF3OJxXz0o98fPPPn6ZX837595frD337wopVcBiu5OGvFSSvOWXHKijNWBit5LkBx4JNUmPDCfBemuzDbhRkuayu5bGIIMYYYRIzCV1lhJRdWcmElF1ZyYSUX6Y4aKIMKqIIaaHHESi6bbgK6GeimoJuDmLZYySVWcomVXGIll1jJRfoPWMAcsASsAVvABXjHSk67ldz6ldy6lfzK59vHfzd81f/qlRs3rj1044s+k9tgJTdnrTlpzTlrTllzxtpgJc8FKA5WVmPbRJiIE4Eikq+UxmpsrMbGamysxsZqbNIdNVAGFVAFNdDiaIXHpedxCR4Pn/rs9q3Xt+99MKTyX+6/8uCV61/opX8Z0Lh4uotnu3iyi+e6eKrLgMa5AMXBCo3LJsJEnAgUkXyKF2hcoHGBxgUaF2hcpDtqoAwqoApqoMXR+Isl9WVb6sq2o09e3L718pDDc2XbxdJJGlRtyYuu5EVX8qIredGVvGpLg6ptMkBxMCYwUbUlqrZE1Zao2hJVW6JqS1RtiaotUbUlqrZE1Zao2hJVW6JqS1RtiaotUbUlXbkPU1+1pa5q+5cr/+fk8Th8MTj3OL1EO0mDYi15rZW81kpeayWvtZIXa2lQrE0GKA6qgzYmk8orUXklKq9E5ZWovBKVV6LySlReicorUXklKq9E5ZWovBKVV6LySlReicor3VmzaNmR2dcsqatZ/u7GffevsHleB7v8JS8NypXk1UbyaiN5tZG82kherqRBuTIZoDioDpYxndQeidojUXskao9E7ZGoPRK1R6L2SNQeidojUXskao9E7ZGoPRK1R6L2SNQe6c63djl9uKZenE69OL299dj+R69t3/vN9t8fH5I6+Jq8+A5NA4E6bXgP5C2Qd8DkL3jJX+/OC9SzAYqD4VM2IVAnBOqEQJ0QqBMCdUKgTgjUCYE6IVAnBOqEQJ0QqBMCdUKgTgjUCYE6IVCnNYE69QJ16gXq7a0fbn/w+d26MdNAo04bsiVZciVVMpUBi3MBioPT+YnT4rw4Mc6MU9Oavp3QtxP6dkLfTujbCX07oW8n9O2Evp3QtxP6dkLfTujbCX07oW8n9O2Evp3Qt9Opvu3ZdBPQzUA3Bd0cxLSlOC3FaSlO6ya2m1npP2ABc8ASsAZsARfgyjrWfh3rmXV8dPODgx+9N/fGd2n1lQZafXKpPbnUnlxqTy61J9fq00Crnw1QHKysRt1EmIgTgSKSrxRlNSqrUVmNympUVqNKd9RAGVRAFdRAi6NhtyX1Wn3qtfr913+3vfXj7Wd/GD6SvmjbMw1E+hRiOVo5UjlKuXmmNmBxLkBxsMJiaNYhWYdiHYJ16NUhV4daHWJ1aNUhVYdSHUJ16NQhU4dKHSJ1aNS2xmLuWewl6n+/uX3r5cPnnhvejf9849rVb51l8Z/v/863rt135YGLqMwDKpGKUYoRitGJs6ebB1TOBSgOVqgMxTYE29BrQ64NtTbE2tBqQ6oNpTaE2tBpQ6YNlTZE2tBoQ6INhfbOV71lx2Tpmez02duf/mL/mafWVK3zjbOL78YyoBCNFIkUhRSBtHiaZUDhXIDiYIXCkCpDqQyhMnTKkClDpQyRMjTKkChDoQyBMvTJkCdDnQxxMrTJkCZXlMnjt9eOw9rdjY8/s//MU2dpvLianrkd64DL6jlXT7l6xtUTrp5vHXA5F6A4WOGybiJMxIlAEcnnucJlhcsKlxUuK1xW6Y4aKIMKqIIaaHG0wmXruexU5v23Xtw++/+m78fLiq42ILF5ss1zbZ5q80ybJ9oGJM4FKA5WSGybCBNxIlBE8glukNggsUFig8QGiU26owbKoAKqoAZaHK28rC49ib3E/Opz28efmW4VXCwwp4HAnFwfTq4PJ9eHk+vDyQXmNBCYZwMUB9XBMmZz2US8CBgRIyShYHOBzQU2F9hcYHOR7qiBMqiAKqiBFkdjNtOmY/OkxnJ7yXMfbJ//7eybzuU1dNqc5zNFKUfBRblFsUWpdZ7PyQBeoK3clGnThYk4ESgiUeBFNRnFZFdLTtfoeVitO6KGjBJy/M6aek0r9ZrWs2+f9VRc/GSd+IpMA0kLYQhdCFkouSKVXNJKA0lrMkBxUB20MaOxMGJlxNKItYG21Y8ghhBjgFG0rYS2ldC2EtpWQttKaFsJbSuhbaVz2pbuGO21rdRpW/tPvbK99eP/dPjRe4cfvTcpcV3yrE0DfSsyJmHyJV2yHehbkwGKg5V7M+SeUHtC7AmtJ6SeUHpC6AmdJ2SeUHlC5AmNJySeUHhC4Al9J+QdGTMpvd4svd589PpLR689MiftXPqAlYHULP6YEn9KiT+kxJVicalZBlLzbIDioDoY3peC5ixozoLmLGjOguYsaM6C5ixozoLmLGjOguYsaM6C5ixozoLmLGjOguYs5zVn27EpPZu95vzozdt/enG2vX6pVCcD0Vk2pEu2JEuupCoDPucCFAd1TKNsIkzEiUARyadYoFGgUaBRYlgxLumOGiiDCqiCGmhxtHJTak9jJ7kefPqT7ZNjT+3gvWfCUisDzVVcMhWXTMUlU3HJVFxzlYHmOhugOFghUjcRJuJEoIjkk6wQqRCpEKkQqRCp0h01UAYVUAU10OJo+OYjveYqZzTXV3+7ffyxOYf7xN1oAxLNkzXP1TxV80zNE7UBiXMBioMVEm0TYSJOBIpIPsEGiQaJBokGiQaJJt1RA2VQAVVQAy2OVu7G3JPYS65PPnaXzBIyUFrFhVJxoVRcKBUXSsWVVhkorbMBioPq4PTtgfMjQESIEBEjguyiDBdE3sSoYlgxrhgYA2JBZBZEZkFkFkRmQWTpjhoogwqoghpocbTr68Wgu1F3w+7G3Q28G3k39G7s3eC70XfD78bfJdBl0KXQ5dAl4VmMlnXpl3WnPx989ObhOx9ObqC6vCaTgQQtriCLK8jiCrK4giwuQctAgp4NUBysPJ3KJsJEnAgUkXyhFBZjYTEWFmNhMRYWY5HuqIEyqIAqqIEWR0ONRHoJWnoJ+ugXvz74xZ9mX/mm3hXqgMjqCVfPt3q61bOtnmwdEDkXoDhYIbJuIkzEiUARySe5QmSFyAqRFSIrRFbpjhoogwqoghpocbRyP7aeyE5/PvjVewfP/WC2OTtRi7UBjc3TbZ5t82Sb59o81TagcS5AcbBCY9tEmIgTgSKST3GDxgaNDRobNDZobNIdNVAGFVAFNdDi6E4a8ymNS09jp0BvP31v++ys7efCpp4M5Gdx9VhcPRZXj8XVY3H5WQby82yA4mCFwWUTYSJOBIpIPrsLDC4wuMDgAoMLDC7SHTVQBhVQBTXQ4mhcRPeqs/Sq8/5b37/9x8cOn/7VtGJ5sbQlA9lZECHQIJAgUCBcdpaB7DwboDgY84jsLMjOguwsyM6C7CzIzoLsLMjOguwsyM6C7CzIzoLsLMjOguwsyM6C7CznZefdN2MvO0svOx+8+unRzQ9mq+jLy6+B6CwoQwhD6EKuGYuLzjIQnWcDFAcrNMZqiOUQ6yEWBJpW6i4cV45LQyOaFtKpoJ0K6qsgowpas6A1C1qznNeadzV0rzVLrzUf/fjm/sePTldgFz9SByqzRK6kSqYkSp4DQWsyQHFQHeze3VGpCRARIkTEiCC7KMMlgT6GaC2I1oJoLYjWgmgtiNaCaC2I1oJoLYjWgmgtiNaCaC2I1oJoLYjWkjBWxqC7UXfD7sbdDbwbeTf0buzd4LvRd8Pvxt8l0GXQpdDl0CXhWYy+Z3qVr99Hc/oLFn955O2jn/1m/+aT8yt84h1+sLNGfGOM+MYY8Y0x4htjxHfWyGBnzWyA4qA6aA52hOsp38dAxosXTZDdN8LuG2H3jbD7Rth9I+y+EXbfCLtvhN03wu4bYfeNsPtG2H0j7L4Rdt8Iu2/k/O4bp73XBPvdN0ev/cfhW+9MWxQuf9Ef7MAR30AjvoFGfAON+AYa8R04MtiBMxugOFj5XkIWZOONsPFG2HgjbLwRNt4IG2+EjTfCxhth442w8UbYeCNsvBE23ggbb4SNN8LGG0m29nrRy4L9xpvtb186uvXebOE9IaAMtt6I75wR3zkjvnNGfOeM+NYbGWy9mQ1QHKzwiJrHjhthx42w40bYcSPsuBF23Ag7boQdN8KOG2HHjbDjRthxI+y4EXbcCDtuhB03cm7HDfdjL6CkTkA5/Mnnhz/5fPY18RKBNw20k+TSR3LpI7n0kVz6SK6dpIF2MhmgOPDvqcp3XuUrr/KNV/nCq3zJrekuCd0lobskdJeE7pLQXRK6S0J3SeguCd0lobskdJeE7pLQXRK6S0J3SeguCd0l1XiZqJtuAroZ6Kagm4OYtniZqPEyUeNlosbLRI2XiSr9ByxgDlgC1oAt4AJcWcW9epR69+K7L92+9cr0rz1cVrEOtKPk0k9y6Se59JNc+kmuHaWBdjQZoDhYWYpoRwntKKEdJbSjhHaU0I4S2lFCO0poRwntKKEdJbSjhHaU0I4S2lFCO0poR6mtlDrSKw/SKQ9H7/z06OYPJrWjS55EMhAdKAmoCCgIqAfERQcZiA6TAYqD6qA5WHYg2ZBd2XRXiEvENeIiBE+ckTgjcYZwVDgq3VEDZVABVVADeQrnXhhOye3lCOl/dvBPLx689NhdNIqLDAQJajhKOCo4cT1BXJCQgSAxGaA4GN+lIU+FPhUCVShUgiARSkhIIaGFRI0dRXZU2VFmR6EeFXeU3IIgQfUtcqcgIbtHrfSChHSCxMGjHx+8+f3ZF4ZLnrQyECSotCm0qbMps6myZSBITAYoDlY4jLs9bve43+OGjxs9Fk+snlg+3bBiXNIdNVAGFVAFNdDiaGj2F+lrb+lq78MPnt7/8NPJ5ufl0qAMym3xalm8WhavlsWrZfFyWwbl9mSA4mCFRUppoZQWSmmhlBZKaaGUFkppoZQWSmmhlBZKaaGUFkppoZQWSmmhlBZKaVn5+UGRvpQWm/0l10G7ZUI5kUE1LV4MixfD4sWweDEsXk3LoJqeDFAcVAdjc4VQVgtltVBWC2W1UFYLZbVQVgtltVBWC2W1UFYLZbVQVgtltVBWC2W1UFaLrd2ZfVktfVn9+SvbT1+6/ac/3a13WRmU1eJVsXhVLF4Vi1fF4mW1DMrqyQDFQXWwQij1tVBfC/W1UF8L9bVQXwv1tVBfC/W1UF8L9bVQXwv1tVBfC/W1UF8L9bWs+Ey0dxjrmV+0ePrN/WeeOvz4l7P7OC7mUwceY/V3QPVXQPU3QHWLsLrHWAce49kAxUF1MORT8RgrHmPFY6x4jBWPseIxVjzGisdY8RgrHmPFY6x4jBWPseIxVjzGisdY8RjreY9x2vEpPZ9y5ncF93/6+pyn8fKXWB1YjHVDtiRLrqRKpjKgcy5AcbCbHxlXJYrXWPEaK15jxWuseI0Vr7HiNVa8xorXWPEaK15jxWuseI0Vr7HiNVa8xorXWM97jduOTu3p7H/N65Xf/OWRt/ffnv61mQsbbDowGqv7hNV9wuo+YXWfsLrRWAdG49kAxUEds6ibCBNxIlBE8hlWWFRYVFhUWFRYVOmOGiiDCqiCGmhxtPKQtZ7F/oeY3/z+0RMvTv+yw+XvQTowG6t7hdW9wupeYXWvsLrZWAdm49kAxcEKkbaJMBEnAkUkn2SDSINIg0iDSINIk+6ogTKogCqogRZHK0/X3BPZvf4c3Hzj4IV/2/7wk4OX35g1Ec2wmQdsZs86e9LZc86ecvaM84DNuQDFwQqbeRNhIk4Eikg+0xk2M2xm2MywmWEzS3fUQBlUQBXUQIujoSqrvcdWe4/t4dPvHzz6y9kn66WtPh14bNUtsuoWWXWLrLpFVt1jqwOP7WyA4uBUuea0OC9OjDPj1N25wyVQNjGEGEMMIkbh9BSWQGEJFJZAYQkUlkCR7qiBMqiAKqiBFke79kIMuht1N+xu3N3Au5F3Q+/G3g2+G303/G78XQJdBl0KXQ5dEp7F6LFU+4Vcz/7m57u/OPrj49NV2cXytA5MxuoeYXWPsLpHWN0jrG4y1oHJeDZAceCTVJnwynxXprsy25UZrmsruW5iCDGGGESMwldZZSVXVnJlJVdWcmUlV+mOGiiDCqiCGmhxxEqum24CuhnopqCbg5i2WMk1VnKNlVxjJddYyVX6D1jAHLAErAFbwAU41Iy0t1nrmR+T/uQH+x8+dfd+4F8HPmt1m7S6TVrdJq1uk1b3WevAZz0boDjY8dySH0oeO/ln0sqKbZu4VFwrLhZXi6twBiu2sWIbK7axYpt0Rw2UQQVUQQ20OLrjF5ZOmV56pjsn9sEbP9t/7aOjW2/Mfv/OVKvLgOzFE14838XTXTzbxZNdBmTPBSgOVohcNhEm4kSgiOSTvEDkApELRC4QuUDkIt1RA2VQAVVQAy2O7rhpT3/kVntLtp6xZH/86OEL7073zi5RkAZ+bEWwQa9BrkGtcT+2DvzYswGKg+qgOdg90vjZCCJFqIgVwSJahNvFGy0THN+K41txfCuOb8XxrTi+Fce34vhWHN+K41txfCuOb8XxrTi+Fce34vhWHN966vj2bLpJ6Walm5ZuXmI6UpyW4rQUp0l8QOID0n/AAuaAJWAN2AJC57i/qL3hWXvD88H7H+5/8Oq0QfBiPWZgeFbERLREpESURITEgeF5NkBxMH5gYfZVvL6K1Vdx+ipGX8Xnq9h8FZevYvJVPL6KxVdx+CoGX8Xfq9h7FXevYu7VtPKnzbT39mrv7d1/5Y39m2/s/+Rn06raRBE/MPWqe3LVPbnqnlx1T666qVcHpt7ZAMXBCpdoaxh2FcOuYthVDLuKYVcx7CqGXcWwqxh2FcOuYthVDLuKYVcx7CqGXcWwq2lNW+sNu9obdg8+f+vg8zfnBO/LS/iBW1fdbKtutlU326qbbdXdujpw684GKA5WSERXw62ruHUVt67i1lXcuopbV3HrKm5dxa2ruHUVt67i1lXcuopbV3HrKm5dPe/W9Ydqr6v1bt39D9/ef/6F/V/9fFJUm3gXHPh11e226nZbdbutut1W3a+rA7/ubIDioDoYN6Iw7irGXcW4qxh3FeOuYtxVjLuKcVcx7irGXcW4qxh3FeOuYtxVjLuKcVcx7up5427Kp5T2mkRv3L39x/cP3vxo7r6cerwOJAn30KpbaNUdtOoGWnXvrg68u7MBioPqYDc/9fQV6Bj46cnPSn7Z5KcnPz2tLAfkCRyxiiFW8cMqdljFDauYYRUvrGKFVZywihFW8cEqNljFBauYYBUPrGKB1TUHrPb+Ou39ddt3f3771qeHT79/l4wDOrDXKS8gvH/w+uHuOHV7nQ7sdbMBioPxkxp7nWKvU+x1ir1Osdcp9jrFXqfY6xR7nWKvU+x1ir1Osdcp9jrFXqfY6xR7ncrKb8tZ7xewzVkez/2Fofwl/8KQDcwC5kWBeUlgXhCY9/rNzQI2MAvMBigOqoNhRWaYBQyzgGEWMMwChlnAMAsYZgHDLGCYBQyzgGEWMMwChlnAMAsYZgHDLGCYBeycWWD350ysNwvYGbPAK5/vv/nnw+feP3ptLB1/5eqDD508lb+A5GYDz4BtSJqcSZmMSVgGrM4FKA6qg+bgtOIjUASIK99x6TPLQDYxgBhBDCHGwLVZBsIyEJaBREKRkXRHDZRBBVRBDbQ4Ov1Wso17FE+QnPnDRXm3NLRfGv2PnP35ie1vXr9rvTEbOA9sw/DUZ0B9AtTzV09fB4tiLkBxUMfU6ibCRJwIFJF82hVqFWoVahVqFWpVuqMGyqACqqAGWhwN9XTrnQe2OePBfGL/xz+8m5tXbWA9MHcOmDsHzJ0D5s4Bc+uBDawHswGKg+pgNzGW0phb20TgiByhIzYx4dbg1uDW4Nbg1qQ7aqAMKqAKaiBPYSy7Wm9GsN6McPT9d7ZPfrJ99/m5r+KLW3428CCYWwjMLQTmFgJzC4G5B8EGHoTZAMXByg2aNxEm4kSgiOQTnCExQ2KGxAyJGRKzdEcNlEEFVEENtDgavhdb70GwMx6Ej187euena3+K6kv9KWAb+BDM/QDmdgBzN4C5GcDch2ADH8JsgOJghcqyiTARJwJFJJ/mApUFKgtUFqgsUFmkO2qgDCqgCmqgxdHKq3Htqey78I++cPj672ffoyZorAMaq6dbPdvqyVbPtXqqdUDjXIDioDrw16fK65N344kQl44Yx2jXJzhGnDv+aQGj2W30uo1Wt9HpNhrdRp/baHMbXW6jyW30uI0Wt9HhNhrcRn/baG8b3W2juW106G1TeQ2pd7xmXf/2Aw+cLprWL5p25mdwtiu/K/bl9p3ZoONt3rA2b1ibN6zNG9bmHW8bdLy/RIAdqA6ag930tbVv7LaJS8W14mJxNYKzAhoroLECGiugsQKadEcNlEEFVEEN5CkM9xha3/K2vuV99M5z2zefmH1AXPZ9vQxoXjzVxTNdPNHF81w8zWVA81yA4qDubueFh8LCo2DhUbCs1VTLJi4X14sLxhWdhgWqF6heoHqB6gWqF+mOGiiDCqiCGmhx5Df7ws2+3HGz+3d93ye3s33yPxy8+MbRGx9Of9dP3O6DdrkhWaBYIFigV3i73Abt8tkAxcH4y56+sNEWNrrCRlPY6AkbLWGjI2w0hI1+sNEONrrBRjPY6AUbrWCjE2w0go0+sJ3/+bK047KXTvo28PGb92fPbD/7w+HzT96dvwRrg2awIRahFSEVoRQhFA2awbMBioMVJlE/aAYbzWCjGWw0g41msNEMNprBRjPYaAYbzWCjGWw0g41msNEMNprBRjPY1v7GgvXNYDvzB9N//Pn23ZtrP/E0eDBfrGkO2sDmXVzzLq55F9e8i2veBrZBG3g2QHFQHeze2vz8OC8uGGfuTh0uADQSOshGB9noIBsdZKODbHSQjQ6y0UE2OshGB9noIBsdZKODbHSQjQ6y0UG20w7yKYpZu+NRLf6o7nWTZINf/zp8/LPDZ1+a3box87weyCfeIDZvEJs3iM0bxOYdZht0mGcDFAcrJCOW0GE2OsxGh9noMBsdZqPDbHSYjQ6z0WE2OsxGh9noMBsdZqPDbHSYjQ6zne8wn/7wq/UdZjvTYX7l5f3fv3GXbvGBVOKdYfPOsHln2LwzbN5atkFreTZAcVAd7OYmJ/9M8ps+c9P7L8cTMwZzcgb/dhrkBMXRAqqgBuJqsgFxXeG6wjWEawjXkPEbIg1yo0FuNMiNBrnRIDca5EaD3GiQGw1yo0FuNMiNBrnRIDca5EaD3GiQGw1yS5nHTuaxk889do4Xae6ba7lvrh08+su1DunfP3Dl4WsPXf8CHdI86K5lf7/K/nqV/e0qe3Mse3ctD7prswGKg+qgOVh24HS68nH/asR9pvGWabxlGm+Zxlum8ZZpvGUab5nGW6bxlmm8ZRpvmcZbpvGWabxlGm+Zxlum8ZY3u18oPkYmIxE39y243LfgDp78ZPv4U9OUX/4Fkwftt7whdTIncfImbRnQPhegONhNlqxxK5uIFwEjYoQkFNwK3ArcSowvBijdUQNlUAHFcBtoceTcyp3cth232nOrZ3cLPv/mNLcXfunkQQMte/8re/8re/8re/8rewMtDxposwGKg+pgN03qc6NrROsmrhCXiGvERQgO0QrRCtEK0QrRKt1RA2VQAVVQAy2OSGaNaOuJPvO2+Oz+rz85euTlSfvapT30PGiyZe+RZe+RZe+RZe+RZW+y5UGTbTZAcVDHlNomwkScCBSRfLoNSg1KDUoNSg1KTbqjBsqgAqqgBloc3fGWmHdE5p7Ifn/vJ789fOb9u/o0zgMisyecPd/s6WbPNnuyeUDkXIDiYDdFee0mzZuIFwEjYoQkFIxmGM0wmmE0w2iW7qiBMqiAYrgNtDjymzTfcZOa36Sl57ac+WWMg2f+/F//598syzL/TL68IZ4H7bbs3bLs3bLs3bLs3bLs7bY8aLfNBigOqoPdlBWfp5L89OSHxA9JGq+HsomLx9Xj8nF9rst6KKyHwnoorIfCeijSHTVQBhVQBUUGCyl4MnesB3/xqv1y6P84/LOPbf/t93955O0L/oDYF/Qk5kHHLnvDLHu/LHu7LHvDLXvbLA86drMBioPqoDnYzVUd/35KpueW6bllem6Znlum55bpuWV6bpmeW6bnlum5ZXpumZ5bpueW6bllem6Znlum55bP7yd1llvPctdeO/z85vb172+feO0ubRDIg+5a9uZY9uZY9uZY9uZY9uZYHnTXvkSAHagOljGzbROBI3KEjtiEgtkGsw1mG8w2mG3SHTVQBhVQBTXQ4miF2aVntv9LPi88tf3dy7f//OnBZ8/d/uSR6Q7qxLvXMqB48cQXz3vxtBfPevGklwHFXzjADlQHKxQvmwgckSN0xCYUFC9QvEDxAsULFC/SHTVQBhVQBTXQ4ugsxbqjuO+X5b5ftv35r7a/fuH4Ef3Cbw/f+uHcLXzJI3rQLssIDegMyAyoDN4uy4N22WyA4qA6aA6WHUj+YfE44pcdS2SZJlumyZZpsmWabJkmW6bJlmmyZZpsmSZbpsmWabJlmmyZJlumyZZpsmWabJkmWz7fZNu9jvdNtnxmr6XvET/+DaxXP9r/9Q/vTvM8D1ptGXkIdQhxCG0IaWjQapsNUByciqmcFh+P69xxoTO8I6HQksu05DItuUxLLtOSy7TkMi25TEsu05LLtOQyLblMSy7Tksu05DItuUxLLvMXZHJyQ/IJGjXPc9+my32b7vQ3tI4XwpPP73/8H9Nv8Jd/pQ86djkxUBdGvHGWveGWvYGWBx272QDFwW76dPdufrJ5Zkg7ggqNuEwjLtOIyzTiMo24TCMu04jLNOIyjbhMIy7TiMs04jKNuEwjLtOIyzTiMo24nM4JKic92ZOXEyd796ayI/u7//QP//kf/+nvvvL337t7zqjjK9xJ9PG/nVz3BIgDdWAOsoM7iJ4OUBxUB83B6Iv95EAEjsgROmITM4YSY4nBCEeFo9IdNVAGFVAFNdDiaORKP3nj7OiVvzq9MqCXpMmZlMmYhGVA71yA4qA6aA5W6JVNBI7IETpiExN6BXoFeiUGGiOV7qiBMqiAKqiBFkcr9GpPr07TO+ibX/jSdhx8wKx6vurpqmernqx6rjpgdi5AcVAdtDGhuol4ETAiRkhCQahCqEKoQqhCqEp31EAZVEAV1ECLoxVCrSfU/pqE2oBQ83zN0zXP1jxZ81xtQOhcgOKgOlgh1DYRLwJGxAhJKAg1CDUINQg1CDXpjhoogwqoghpocbRCaO4JzdOEfqlfwDi+woDV7Elnzzl7ytkzzp5wHrA6F6A4qGMy8ybCRJwIFJF8ojNkZsjMkJkhM0Nmlu6ogTKogCqogRZHoy0kbdMJ223TC9t/JTLLgMziSRfPuXjKxTMunnAZkDkXoDhYIbNsIkzEiUARySe6QGaBzAKZBTILZBbpjhoogwqoghpocbRCZu3JrNNkfkGv0nHsAY3V062ebfVkq+daPdU6oHEuQHFQHTQHJyUCgRIBEldOhEi7GMOlUDcxlBhLDCZGwyhYCpWlUFkKlaVQWQpVuqMGyqACqqAGWhydlEPHiDePyqtHPX7MndM/26ZTttumV7bv+kJpg4XSfKDNx9l8KprPRPOJaIOFMhegOKgOmoOVt+e2icAROUJHbGJCe4P2Bu0N2hu0N+mOGiiDCqiCGmhx5LQ3aG/Q3tZoX3ral2naRwrIZYr38QUG3C8+2sUHu/h8LD4di8/GMuB+LkBxsJvDZdikPvlExIuAETFCEgrKFyhfoHyB8gXKF+mOGiiDCiiG20CLI6d8GdrB2qaTvE/+569L73nNu4W6gLiAtoC0sNO8T8A5eicDFAd1B1bodRn7FBEwIkZIQiXOSJyROEM4KhyV7qiBMqiAYrgNtDja0Zs2A3q/9/8BiMdHJd6+AAA=";
var characterPromotionsData = "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";
var characterSkillsData = "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";
var characterSkillTreesData = "H4sIAAAAAAACCuzdaY+cR3Yv+O+i17rXGSf2fme7x7g9wADdHl/4xcAw2C26m2iJ6qHIixEMAyxuxX2RSHHfSYkSxUVcxGItrG/gD3FRTy6v9BUGTxbVyvizsvIkIyJvRswAhu2q6q46J56F+TtPPOf8+wei02n/54Nf/fsHuz764Fd//frDD3bv+GTnB7/64IMPP9j1h093f/Cr4f/5m8/+vOvjj/+m/Y/86+93fLbrD/+6Y++f/+tfdv/xgw8/2LH7D3/6dM8Hv/rgt5/u2r13+Ds+3vk/dn78r/v+8q/D/9pnH/zq/xr9M8O/su+TD34l/uNf3v5nN/8jf9nz6V927tm7a2f75b/8x4fZvvMv//Hh24wJVoA4KzD8f7fOniZmT//Ls0+/ihJWUXJWcd/He3d9smPvzq0XUk5cSFnhQipYSMVZyL07Pt65e+/Wy6gmLqOqcBktLKNlLePOP/xp967/e9+YE1JPXEnLXMmf4xRw/xWj99/e8pPui4UJ96C9e3buFFuHa7YMlxkXQVwjd8Xm+K3u8XuMuGjruGxMXBLiGrnPNEeeNl98wYhLbh2Xe/+4CI4jjR7HjdV7zePnzepyc/Kr/7n/TnPkKcT49pd+/je/+cOnu3/zh51/+9FHOz/6xx17d326daB+2kD//YO9n/+lDSX45R98+MH/2PHxvp0f/KrzXzuS/mM0HYJ0Rg7/4NKz5s3tzXS2S+TXO/9t5+4/bH0pic57p/D2145JQwdZSMhC5jsoQuQ/KArSGfmnoXvhaPfGte7xl93jFycfmv9z7469+z77x52f7fps746xx4jeOyP8/X+347OdQWIqyEtDXjrjYZIZDpNyQToG0jF5D5PKd5hMkJeFvGzie4LOdE+w4U3BQRou49lm8p9tHtLxGdOxGdIxwb1AdMJ0hv9QpDzJXJ6TTPySBAGqiYVqikU1zQ+qCVBNLFRTDKqpPlQToJpYqKZIVFN9qCZANbFQTVGopvpQTYBqYqGaYlFN06KaANUUoLq7dm3w5vKEe1AWVBOgmgJU91auN2s/MOJKjmoCVFOA6t7a7cHd04y4kqOaANW0HarfjTH4SPDPu3Z/lE/V4W8fKzgCVlPA6u75lWZxZfKnm7/du3fHH/6cWtWbv3XcJ84gBwk5yIwHJULV/IOiICGV+CMn5a91ECCatkN0gsMicxyWUdgQMJpCRie4VlSea8UEOVjIweY8KHoGB8VBQi7xtWJmUAMgQDMFaE5xbtk851ZwKEIpUyDl9OeWy3FujdJfgpolS80yVs1yftQsQc2SpWYZo2ZZn5olqFmy1Cwj1SzrU7MENUuWmmWUmmV9apagZslSs4xVs5xWzRLULEM1X7rZW3g44R6URc0S1CxDNS+s9g4+YsSVXM0S1CwDNQ8WvuzeWmTElVzNEtQst1Pzu8c0+GDwD7v2ZHwWHf72sUCToGZZoJolqFlup+b4gxKhZv5BUZBQFQ+jJThabufoBAdK5jhQo2ST4GhZoKMlOFpu5+gEB0XP4KA4SMjlvXrMTPYISIC1LBDWEmAtt4N1gpPN5TjZRmGtANaKBWsVC2s1P7BWAGvFgrWKgbWqD9YKYK1YsFaRsFb1wVoBrBUL1ioK1qo+WCuAtWLBWsXCWk0LawWwViGsD37bPfrFhHtQFlgrgLUK93g/vt0cvceIKzmsFcBaBbDu311ojjxnxJUc1gpgrQJYJ/hwE0FprkMVWFoFloYPN/3LV7oXtt8x+MmOP+7avWPP55M+5Ly/sLf4E2NRqkDZKlB2io+fYhZHSEEOVcBaAaxVAOsUx0Zmd6gCS6vA0vmuHpXt6hlFqQJlq0DZKY6QnsURcpBDFbBWAGu13TbvhGeezXbmBUIFcquA3CnOPJe9bKBB2ZqlbB2rbD0/ytagbM1Sto5Rtq5P2RqUrVnK1pHK1vUpW4OyNUvZOkrZuj5la1C2ZilbxypbT6tsDcrWobKPX+rdfTDhHpRF2RqUrQNld0/fau4tM+JKrmwNytahsk8d6d69xIgrubI1KFsXqGwNytbhE+vhp9Dm3NrG0iPup9Df7vn09zt+v+vjXXs/Tw3sd/7AdorTIGxdoLA1CFsHwu6dv9mcW5ucw/+x4//5b79NDer/9ltW+BrCLw7SGiCtt3hHOvEFojJeIGFmFjIrDtEaEK0DRCe4QEz6CyQM30P4PvPJZTOeXKPGBCfrAp1swMmG5WQT62QzP0424GTDcrKJcbKpz8kGnGxYTjaRTjb1OdmAkw3LySbKyaY+JxtwsmE52cQ62UzrZANONmHHsfM3u0fPTrgHZXGyASeb0MnPHzSH7zPiSu5kA042gZO7Fxe6zx8w4kruZANONgU62YCTTTVONuBkU6CTDTjZBE7GNwwXzzSPzm6XzO/27di9d98nk544vT+e3/kDY/cJGCC0KZDQBghtqiG0AUKbAgltgNBmuy5jya4dk+naGd0lYEDXphpdG9C1KVDXDnTtWLp2sbp286NrB7p2LF27GF27+nTtQNeOpWsXqWtXn64d6NqxdO2idO3q07UDXTuWrl2srt20unagaxfoun/iTO/8zQn3oCy6dqBrF+71vn6lWT/FiCu5rh3o2oW6Pn6xeXObEVdyXTvQtStQ1w507bbQddq9kJ2Z7CR2YGtXoK0d2NqV9QzaAaBdgYB2AGhXSZ9uB3x2BfLZAZ9dWU+gHRjZbWHktKeWzXdqjeoShOwKFLIHIXuWkH2skP38CNmDkD1LyD5GyL4+IXsQsmcJ2UcK2dcnZA9C9iwh+ygh+/qE7EHIniVkHytkP62QPQjZh8+fFx72j/8w4R6URcgehOzDNmMHXvcWDzLiSi5kD0L2oZAv3WyWv2HElVzIHoTsS28z5oHLvsiZVx5w7EtvNOZByj58H/rKi2ZxpXd6cfKR+fs9u/bu+sOOj//+TzlehQ5/+zsfoskGGWnIqOwWYx4k7QNJJ7ly1Ay6QnuAsy+9y5gHRfvwZei0l47JdemoICEPCfnEJ5rNPh3KA6J94f3FBDTuFqzG3SK2cbeYn8bdAhp3C1bjbhHTuFvU17hbQONuwWrcLSIbd4v6GncLaNwtWI27RVTjblFf424BjbsFq3G3iG3cLaZt3C2gcbeAxt0XjvZOL064B+UQtYDG3SJs3L2xvNws/MiIK7WoBTTuFhJnSPdWvmTElVrUAhp3C1n0DGkBbbuFLNHTAhp3C1n0DGkBbbuFLF3TAhp2C1n09GgB7bqFLNLSAjp2i207dscfFZ3/qDhIp2hJC2jULWSBkhbQqVts26k7/iRzeWdfC+jTLVh9ukVsn24R9On+cPT7bl58Df27Bat/t4jp3y3q698toH+3YPXvFpH9u0V9/bsF9O8WrP7dIqp/t6ivf7eA/t2C1b9bxPbvFtP27xbQv1uE/bsHby5vvD4x+O5cc/fhhDtRFmVDF28RdvHuvv5q4/WJ3v3rva/PMKJLbm3o5S0UPr3eeH2iOXKrOXKBEV1ycUNHb6EKHzAtoL23CNt7J/6c2pkF76Clt1CFj5sW0N9bqKJ2fgto4y1U4XOmBfT0FmFP78SXjJoB7aCNt1CFD50W0NNbqKI2gwto3S3C1t2JTzCb6wTTcjSj0N2q8NHTAnp3C1bvbhHbu1vMT+9uAb27Bat3t4jp3S3q690toHe3YPXuFpG9u0V9vbsF9O4WrN7dIqp3t6ivd7eA3t2C1btbxPbuFtP27hbQu1tg7+4LzdoPg0fnu9eeTLgTZRE2dPAW0MH70d2N18c2Vi9vrL5gRJdc2NDHW4R9vJvHR7vH7/X3H2aElpzX0Mpb6G15nagJTgSy2Q2kBDT4Frq8kdQCWnkLva2sU7UoErM5OgoyK/whN/T8Fnpbdac6VjJ/OykBncCFLm88tYCe30JvK+5UR0fP5ug4yKzs597QG1zo8gZUC+gCLvS2/E51urlMp9svDhcdETj87dcTPq+KjohzePtn5sThw4wJVoA4K/DeDm//RGUOH66ahFWUnFWMcXj7V2SFC6lgIRVnId/f4e3fUBUuo4VltKxljHF4+2emcrjoCAH338DhzZlXGyv3JtyDMgh8GAdBXMFW4pfNtaeMuBLbexiHhLiCneRXm+PrjLgSw1t0BMFxLPu59jABgoTeea49mhbno+ivd3yy44/ZHm1v/vZtHqMMk5CQVMmPtocJKEiogtHVwzw05FXyM+9hAgYSMjkvJ5XrcgpzspBTyY+9hwk4SKiCUdbDPDzk5XOefDbTySc6djSpUZO//brcR+KiQ0BxYlGcYilO80NxAooTi+IUQ3Gqj+IEFCcWxSmS4lQfxQkoTiyKUxTFqT6KE1CcWBSnWIrTtBQnoDiFFL93rX/75IR7UBaKE1Ccwkbix5717x5gxJWc4gQUp3Cj+Y83u6vfMeJKTnECilNxjcSHMRPkUL6+CfRNxXURH8asIAeV+C1Oyv2K/TBqDVkU1kx8GLOBHIoXNYGoqbhG4sOYHeTgEl8hJvvr9MOwPaRRvpkJzEzFdRMXHQlMliwmy1gmy/lhsgQmSxaTZQyTZX1MlsBkyWKyjGSyrI/JEpgsWUyWUUyW9TFZApMli8kylslyWiZLYDL0Pju32F25MuEelIXJEpgc9j7rnX85uPmcEVdyJktgctj7rHfiQO/gI0ZcyZksgclh77O0Gw0jxMzesjvMgCCjKmZbDzORkJnMtilUzOhYKcioigfXEmQd9kZLfKRk9u27wwQMJFTF0OthJhYys9kOlZ7NoXKQUBWPryVQXFYy/7rNJPR42E4t8Sno8r+oLjoKdK5YOlexOlfzo3MFOlcsnasYnav6dK5A54qlcxWpc1WfzhXoXLF0rqJ0rurTuQKdK5bOVazO1bQ6V6DzsHNac/RK99HdCfegLDpXoPOwZ1pv5ebgzhFGXMl1rkDn0C3t6KXuoTOMuJLrXIHOVcmdyYfhE6RTwWDsYR4S8iq3V/kwfAXpFPh0W4HBVcn9yYfhG0ingqnZwzws5FVuw/Jh+A7SKfG5twJsqyoGabd5hNRWJXcuFx0NztYsZ+tYZ+v5cbYGZ2uWs3WMs3V9ztbgbM1yto50tq7P2RqcrVnO1lHO1vU5W4OzNcvZOtbZelpna3B22D+tf/SL3uqXE+5BWZytwdlh57Tm5MrYxmRBXMmdrcHZYc+0/tODvbNHGHEld7YGZ4cN0+I73UbIenJv6GG4BOFX4WoNrg47pSVoQCxyHxYF4RfoaA2ODlugJTgIMmMX6GG4BsKvws0a3Bz2PktwWHTuw+Ig/BKdrMHJuhIna3By2Ooswdnl0p9dI+EbcLFhudjEutjMj4sNuNiwXGxiXGzqc7EBFxuWi02ki019LjbgYsNysYlysanPxQZcbFguNrEuNtO62ICLTeDi3sWrzeLKhHtQFhcbcLEJnz9/c6n36CtGXMldbMDFJnTx+lr30SojruQuNuBiU/bzZwNONsV1Dx/GLCGHkp81GzCy2WIHeOJdnTSb3foG3GzKfv5swNGmuH7hw5gt5FDys2YDhjZb7PROfO2Y2WzKN8BqU1y38DbmkNCm7EfNFkhtWaS2saS280NqC6S2LFLbGFLb+khtgdSWRWobSWpbH6ktkNqySG2jSG3rI7UFUlsWqW0sqe20pLZAahtu6X7848by8oR7UBZSWyC1DR81D8dgMeJKTmoLpLZhi/B7pzZWFhlxJSe1BVLbAvuSWXC0DRwNH216x75996l+kMxv//T5Z+2LZZM+4rw/rt/9C2NBasHXtsD2ZBZQbUsadT0MV0P4xfUls8BlG3A52yWicl0io+60wGhbYH8yC3a2Jc22HobrIXw/g9PL5jq9AmkCnG2B7ckcaNmxtOxitezmR8sOtOxYWnYxWnb1admBlh1Lyy5Sy64+LTvQsmNp2UVp2dWnZQdadiwtu1gtu2m17EDLLtTytaPN/YsT7kFZtOxAyy7U8tnT3WMnGHEl17IDLbtQy8dvdb+6zIgruZYdaNkVqGUHWnbVNCRzYGVXoJUdWNlV0oLMAaJdgYh2gGhXTdcxB4R2BRLaAaFdJY3GHNjaVdNozIGsXYGy9iBrz5K1j5W1nx9Ze5C1Z8nax8jaj8r6w9Hv+9qE40HcniVuHyluX5+4PYjbs8Tto8Tt6xO3B3F7lrh9rLj9tOL2IG4fbvl+eL937eaEe1MWcXsQtw/E3b14a3DgO0ZcycXtQdw+bAh++tvewkNGXMnF7UHcvkBxexC3p7AJfPTDnU7W558eWO0LZLUHVvuQ1ckH59AsRpd5MLUv0NQeTO0DUye4NlTWB58e4OwLhLMHOPsQzsmvDTODmWUe0OwDNCc4rWzWF4Y9yNiXJ2PRCWW8+fWkT4qiEylj0ZkbGbcZE6wAcVbg/WUsOtU9c25XTcIqSs4qRglYdKoTcLtwChZScRYyQsCiU52A22WzsIyWtYxRAhadKQUsOgLuv+FIrDNnm2OnmhOXui9PTLgT5XBwGw1BdKMOPn1ncPnb7vH93WtPGNGl1nAbjYToRslzY6G5c7D7w4He+ZuM6FKbuJ0iHh7ZotqDteEShE+Je+10svehaqOWkEVBzcDacBWEX8Nz5jYPDXkV1B6sDddA+CbxtaHy96Fqw7aQRkHdwNpwHYRfw6PkNg8PefnEZ5fNc3aJ0SQCG29+XUwvsE2gjoQvWCwWsSwWoyz+cPT7bl64LIDLgsVlEcNlUR+XBXBZsLgsIrks6uOyAC4LFpdFFJdFfVwWwGXB4rKI5bKYlssCuCzCLdrHH/QPrvXXF/traxPuRFm4LIDLItyo/ea73uknzdEfm+MPGNEl57IALovw4fGzY707p7tfXWzWLzKiS85lAVwW5T1CbmMmyKGOTdttJhIyK+3pchuzghzK66zdRq0hi9IeJ7cxG8ihji3abSYWMivtSXMbs4McCuyy3YbtIY06dmQLAbYWBT53JgA2sYBNscCm+XnuTABpYkGaYiBN9UGaANLEgjRFQprqgzQBpIkFaYqCNNUHaQJIEwvSFAtpmhbSBJCmANKD/We6559MuAdlITQBoSkg9GDxXP/GqZb5p24zoktOaAJCU/jEefgkvLv/m/7Tg90LLxgBJlc0gaJpu97b724WDz4g/MOuPRmbb4e/fVxnrTYBgoQItz32Ti/y9zz+/Z9yDKgKf/s7H97IBhlJyEhmPEQRsOYfIgUJFdQ4rA1XQ/g65/GQOY6HckFCBhIy2S4ZleuSCY+QhYRsziOkZ3CEHCRUUB+xNlwP4ftsJ5jNdYKNvKMhCERN27XdTnCGuRxn2C/t0KgTPr9++/WEj6HUiXx+TZ2tn1+335+T59fDlSBYGeKszHuzmzrVPb8erpqEVZScVYxhN3Wqe349XDgFC6k4C/n+7G7/hqpwGS0so2UtYwy72z8zFbupEz6/fvv1L//QLB/rXfhuwj0oA7uHcRDEFbQY+7537CQjrsTgHsYhIa4A3He6128x4krsbOqET6vffl3U0+phzAQ5jG/IPVg80zw6u10yv9u3Y/fefZ/k68f9zh8YI9JhJhIyK+xp9TBmBTkU97R6GLWGLAp7Wj2M2UAOJv91ojJdJ784dJiJhcwKe1o9jNlBDuU9rR6G7SENn/8ks5lOsoCiga3ffl3U02rqEHCaWJymWE7PzdPqYcYEK0CcFYhgM9XHZgI2E4vNFMlmqo/NBGwmFpspis1UH5sJ2EwsNlMsm2laNhOwGZ5Wf7vSvfxiwj0oC5sJ2Bw+re4+utOcPsSIKzmbCdgcPqfeWH4w2H+FEVdyNhOwmQpkMwGbqcAXo4dRS8iiOCITEDl88Iyfma++2i6Tf/rTvt0f7dwz6QPz+5P5nT8wtnpBYGYq0MwEZqYS35Aehm0hjeKATADk8GFzlqvEZLpKRmsXBGCm8t6SboMObUwF2liCjSXLxjLWxnJ+bCzBxpJlYxljY1mfjSXYWLJsLCNtLOuzsQQbS5aNZZSNZX02lmBjybKxjLWxnNbGEmwsww5iL5e6P9zqnzgztgvWX+9EWYQsQcgyFPLLxd7Cyebppf7yQ0Z0yZ0swckycHL/9sn++mLzeq3/9BUjuuRalqBlWaCWJWhZltRVexiuhPCLY7IEJssinyRLULEsUMUSVCxLaqM9DNdC+MVpWIKGZZmPiyXoV5bUObsNN3SvLNC9CtyrWO5Vse5V8+NeBe5VLPeqGPeq+tyrwL2K5V4V6V5Vn3sVuFex3Kui3Kvqc68C9yqWe1Wse9W07lXgXhXOjrr1YnDp5YR7UBbxKhCvCsTbW1nqrX7HiCu5dRVYVwXWHSzcbZ4eYcSVXLkKlKsKVK4C5arC31IeZiAho+LgqwC+qkj4KoCvKhC+CuCryn4leZiAhYSKo7ACCqsyKayAwqrwt5HbDEIdqwJ1rEHHmqVjHatjPeYFZD0/LyBrULNmqVnHqFnXp2YNatYsNetINev61KxBzZqlZh2lZl2fmjWoWbPUrGPVrKdVswY16/Bp8cVbzdO1Zu1O82R9wp0oi5012FnDa8g3mvVTvctvuo9WGNElF7QGQetA0M31M83xh4MrzzeWbzOiS+5oDY7WJc2bGoZLEH7hhNZAaF3S7KlhuArCr2D21DAPDXmVM3tqGK6B8MumtAZK65KmUA3DdRB+BVOohnl4yKtwVmtgtS5pJBV1DIjasERtYkVt5ud5swE5G5acTYycTX1yNiBnw5KziZSzqU/OBuRsWHI2UXI29cnZgJwNS84mVs5mWjkbkLMJ5Nx/ee/dlhx4D8piZgNmNmHH7P1nmyeLjLiSa9mAlk04burWi+6Fk4y4kjvZgJNNgc+bDWDZlLWr2oCMTYEPlw3w2BT5cNkAhk2BD5cNiNiUtavagH9NgY+SDSDYlPko2YB5TVm7qg0A1xT43NiCci1LuTZWuXZ+lGtBuZalXBujXFufci0o17KUayOVa+tTrgXlWpZybZRybX3KtaBcy1KujVWunVa5FpRrQ+XeP9Q8XZ5wD8qiXAvKtYFy++s3m7XrjLiSK9eCcm3YoPrp+ebuY0ZcyZVrQbl2u0FQ/ctXuheebveh4Def7Pjjrt079nyebyDUFn9ibIskC/61ZfnXgn/tdiOg0h2cCBVPeXAUZKfSfgyl7Lq34GK73VCohEdIZjtCo72TLIjZliVmC2K2282DSnhw9KwOjoPsXNrLx2SvB1iAtC0L0hYgbbcbB5XwBHPZTrDRhtwOiO1YxHaxxHbzQ2wHxHYsYrsYYrv6iO2A2I5FbBdJbFcfsR0Q27GI7aKI7eojtgNiOxaxXSyx3bTEdkBsFxC7uffdxuvLzeqZ3tVLE+5EWaDtANoufJy8sNA7/6x76Wb/6BFGdMm57YDbLtyCffhRc/f75vCR5tZ3jOiSo9sBul34aDnpnrkIaU+xh9kBtF1Z0HYAbRc+aE67iVHM6IAoyKiKXdkOwO3CB9Fpj5ScwbZmB8Z2ZRnbgbFd+FQ67fHQszkeDhKqYp+2A2q7sqjtgNoufGad9jxzs9hm7oHXnsVrH8trPz+89sBrz+K1j+G1r4/XHnjtWbz2kbz29fHaA689i9c+ite+Pl574LVn8drH8tpPy2sPvPbhrKg7C82RpxPuQVlg7QHWPny3efHk4No1RlzJSe2B1D7sgb220py9wIgrOaY9YNoXuE/bA5/9diOW3z0vw6cIo1sYU2P6N2P3R44+2fXAaV/gvm0PgPYBoBN8XqasFQ0PTvYFbtj2QGO/3UDl+KtCZbgqRh/YeqCyL3ADtwcd+0DHCa4Kk7Va4QHBfrvpyfFnlM1wRpngIg9R7MvbyC06IYM3v570cVF0IhksOnPD4DZjghUgzgq8P4NFpzoGt6smYRUlZxWjGCw61TG4XTgFC6k4CxnBYNGpjsHtsllYRstaxigGi86UDBYdAfffsD326qXew/UJ96AcDG7jIIhrtM/T8Qu9E48YcaVmcBuHhLhG22PvfzM4f4IRV2oGiw7BcdxuI3dv4eF2nwj+Ydeenfk2cIe/fRwi2wQIEgrqICu9Wy8mf7j5uz07d/z5v/8ltYOHv/bXOz7Z8ceRVLYr97fhS0hHZjw+EULmHx8FCb3zhLk5t7ax9Ij7oOy3ez79/Y7f7/p4197P8zxiHvkD2zwCbDPRkJnOeahkjkOlXJCQgYRM4ktJZb6UwmwsZGNzHh49g8PjICGX+UoyGa8kE2TmITOf+MSzeU880bGj6QTe3vw645nncpx5IwUEIQDfgoVvEYtvMT/4FoBvwcK3iMG3qA/fAvAtWPgWkfgW9eFbAL4FC98iCt+iPnwLwLdg4VvE4ltMi28B+BbhFu9nZwcrh3rP3my8PjbhTpSF4AIILkKCn1zoXjo9eHO5f4gTXXKIC4C4CCH+/EZ36Xjv6zPd52uM6JJzXADHRVFdtttwCcKnxI16Otm7VrVRS8iioM7abbgKwq9hD3ebh4a8Cuqs3YZrIHyT+NpQ+ZtYtWFbSKOgftptuA7Cr2GfdpuHh7x84rPL5jm7xGgSIZRFUS20BQGLicViimUxzQ+LCVhMLBZTDItplMUfjn7f18YTAi4Ti8sUyWWqj8sEXCYWlymKy1Qflwm4TCwuUyyXaVouE3CZwqFUj1aaOwcn3JuyQJkAyhRu2T52bvD1V4y4khOZgMgUEvnatcGjQ4y4kuOYAMe0xfvPo9V0zvtcm4X8XK9Ab/72bR/wEpCZQjLvv9ksf834KPqXnTs/Sg3m4S/99c6P9+74JXoKIpcQucx4OBK8AM07HAqSKmj/dhuuhvB1zmMicx0TF+RkICeT9ApRSa+Q8GSyELnNeTT0bI6Gg5wK2srdhushfJ/0ZLJJT6bg0g5xTFu8ypzyZHKZTqbg0bgEMksWmWUsmeXWc5yFHJ3jPPr9zaXe4vs0L/SWQG/JoreMobes74m0BGJLFrFlJLFlfcSWQGzJIraMIrasj9gSiC1ZxJaxxJbTElsCsaUItxGf6b95OuEelIXYEogtA2JvrD/uff2aEVdyYksgtgzfin75qn+Vs17JiS2B2LKmvt5tNgTZlT0Eus1AQkb1tPpus1GQXUkYl4BxWVOX7zYbA9kVPSm6TcBCQvX0/W6zcZBdSW6X4HZZ+rxoIcHzsqYu4EIB7BUL9ioW9mp+noUrALligVzFgFzVB3IFIFcskKtIkKv6QK4A5IoFchUFclUfyBWAXLFArmJBrqYFuQKQK2hTdqg5fKR7bbl7fXXCnSgLyxWwXIVbxM99Mzh/or/2ontsnRFdcpwrwLkSIaqW+98c2Fh61L1xhxFdcqIrILoKiJ7i5bgIjU//grMCk6uiWoC34UoIXyZ+VVHM9mgoSEeN/VA6WDzz7lD6IK/f7duxe+++TyZ9JH1/hr/zB8bWEhRgXAUYT3Kg5OxeZlaAb1VU++82XAvh28QHQ8/0YDjIxuW/aEymi0aFmXnIrKDu30IBsVVA7CSnmZvhe+QaTK1ZptaxptbzY2oNptYsU+sYU+v6TK3B1Jplah1pal2fqTWYWrNMraNMresztQZTa5apdayp9bSm1mBqHb52vXZhY/nEhHtQFk1r0LQO95G/XmuWrzHiSu5oDY7W4UPu9UuDS88ZcSUXtAZB6/Jaf7cxE+RQyLZxDWLW5XX5bmNWkENJD6Y1WFiX1+W7jdlADoXsCteAX11eQ+82Zgc5lPQ0WYNrdTG7wDWQVhfYu9uCYy3LsTbWsXZ+HGvBsZblWBvjWFufYy041rIcayMda+tzrAXHWpZjbZRjbX2OteBYy3KsjXWsndaxFhxrw83aS6e6F+70F7/bWPpywp0oi2YtaNYGmu2/uNEs/rjx+kRzbo0RXXLTWjCtDUzb3f+ke/CbZvl8d30/I7rksrUgW1tW+zALqLXh/uwMzXk6M+lcZYG8tqyGYha0awPtJvi0TLlqDRaga8tqGWbBuDbcYp3helAzaVZlQcC2rB5iFvBrA/wmuB5MrtKDBffacBd1hhPK5juhRkUJKrZlNQ5zAGLHArGLBbGbHxA7ALFjgdjFgNjVB2IHIHYsELtIELv6QOwAxI4FYhcFYlcfiB2A2LFA7GJB7KYFsQMQu3CY1dGb7w5lwHtQFgo7oLAL315eetM7cJwRV3IEO0CwCxDcO3B58PVlRlzJ+euAvy58sJthIkoEiKeaLeRAxm67Sc8JRoh0co+BckBiFz4FzjG8RszsUCnIrBAtO9CyCx8L5zgmcjYDhRxA2m03EjrB5aNyz35yIGgXPkPOcaj0zA6Vg8wKwbUDXLvtpkQnOMls7jFPDlTtwmfNOU4yl/Ek++XyIZgeTazp0RQ7PZrmZ3o0wfRoYk2Pppjp0VTf9GiC6dHEmh5NkdOjKZge/eHo992Y7/utvy9UhQdEwQFRnAMSAXeqbwo1wRRqYk2hptgp1DTtFGqCKdQUTqFu7n072H9lwr0sB9wJplBTOIW6/83dZu0OI67UcCeYQk3hFOre+ZcbS28YcaWGO8EUauqUtyObYPA0dUpvLkYwe5o65e3UJhg3TeG46SRzcSj7RDKC0dLUKW/DNsE0aeoU3i+MYKA0dcrbx00wQ5rCGdJJLg+TfygZwcBo6pTeHYxgZjR1ytvnTTAmmlhjoil2TDTNz5hogjHRxBoTTTFjoqm+MdEEY6KJNSaaIsdEU31jognGRBNrTDRFjYmm+sZEE4yJJtaYaIodE03TjokmGBNN4Zjo3sJq98mBCfegLDqGAdEUDohuTr0YHPiOEVdyHcNoaApHQ/eu3WyOXmHElVzHMBSaRIE6hsnQJIpq80UwEppEgRSGudAEc6HTfkimWRQoYCI0iQJZDGOhSRTVyYtgHDSJAhEMM6EJZkKnvTDMDCoTMAyaRFFtuwjGQJMo0L4wC5pYs6ApdhY0zc8saIJZ0MSaBU0xs6CJ6rMvzHwm1sxnipz5TPXNfCaY+Uysmc8UNfOZ6pv5TDDzmVgznyl25jNNO/OZYOYzwcznaz/0Fk9PuAdlsS/MfCaY+Xz4ae/gTUZcye0LM58JZj4vXOwdXWTEldy+MPOZqOhu1wTTnonKYjCMfCYquts1wbBnCoc9p/igSdlVDxOfiUrua00w65moLA3DwGeikvtaE4x6pnDUc4rLw2S3Pcx7JiqLwjD0majoDtYE456JNe6ZYsc9k5wfFcOYZmKNaaaYMc1U35hmgjHNxBrTTJFjmqm+Mc0EY5qJNaaZosY0U31jmgnGNBNrTDPFjmmmacc0E4xppnBMc3PnQffJw97K3f7tuxPuRFlsDMOaKRzW3D12orl/ojl5oXm6zIguuZBhZDOFI5vbrmnHLw0uHGleP2NEl9zJMLiZwsHNm88wRl9B4zzG2PynPTWaw9++rc9gXjPBvOYEH0A72X0GE5opnNCc/MBE+Hm6A6MgqYL6XxMMZqZwMHP6YyJzHRMX5GQgJ5P2WlHZsQYTmCmcwJz+uOjZHBcHORXUKZtg7jLB3OUEp5XN/iwWJi1TOGk5/WnlMp1WAaVhwDKxBixT7IBlCgYsfzj6fTcvxIbBy8QavEwxg5epvsHLBIOXiTV4mSIHL1N9g5cJBi8Ta/AyRQ1epvoGLxMMXibW4GWKHbxM0w5eJhi8TOHg5e7B44Ol9Qn3oCy4hpHLFI5c7p1+1jtzjhFXclbDsGUKhy13v7rdfX6HEVdyUMOYZVIFbrqG2cqktnglOeUHn84s7AkTl0kVuBUbxiyTKvKtZBipTKrA7dcwSJnUFm8lp7xE1AzICdOVSRW4JxtmKpMq88VkGKBMaosXk1OeXnYm9ARPqwL3Z8MsZWLNUqbYWcqkx/BZzw+fYcYysWYsU8yMZapvxjLBjGVizVimyBnLVN+MZYIZy8SasUxRM5apvhnLBDOWiTVjmWJnLNO0M5YJZixTOGN5cP2LjaVLg8VTzeFjE+5EWRANk5YpnLTc/fFA88MPvdOH+o/fMKJLTmmYt0zhvOXe6XPdSzebe9/1XtxiRJcc1DB1mcKpy/GNXWNacW/bF5lg1jKFs5aTbMLrzHDXMwxgpnAAc4IOuyLjgVAQeUmPnWHsMoVjlxMsvMzU2phg2DKFw5aTXAFqdvuaYQAzhQOYExwHnfE4OIi8pIfJMHaZwrHLSU4jO8PdzDCLmcJZzAnOI5dnirTshJ253n494dOg7ER25pIdsaV+2+/PiX6HK0GwMsRZmffWr+xU17FruGoSVlFyVjFGv7JTXceu4cIpWEjFWcj312/7N1SFy2hhGS1rGWP02/6ZqfQrO2HHrrdf//IP5ItH3a+eDg6f6n71esKdKIN+h9EQREdBt+3eoR8Hh192n5xiRJdYv8NoJEQXTBT6vv/kVfP6Wff6E0Z0ifUrO2EPr7df55y8GT2ZijPaeJgHQV7l2ngYvoR0ZN4BqWJWh0lBXuXIeRiuhvB13sMiZzAIeZiHgbyKdfUwegvZ2LxHSc/qKDnIqxx1D8P1EH4FQ5/bPEb5/fbrUoY+yw6BwYllcIo1+Nx0CBtmTLACxFmBCGtTfdYmsDaxrE2R1qYtZ1DJDglV4QIrWGDFWeAYg1OnxmW0sIyWtYxxBqdpDU5g8LBzWP/y+f6TKxPuTVn0TaDvsHNY9/Cr7uEHjLiSu5vA3WHnsObEYvfpeUZcycVNIG4qbgP3MGaCHLYZ+3zs297ZI9sl89s/ff5Zu8cv3/Tnd//CmAnQw1wk5FbYPu5hzApyKInVBKym4jZwD2M2kIOZwSWicl0iygW5WcitsI3cw5gd5FASngnwTNsOdU52etlcp5cJLv8Q0FTcPm7ZkaBoyVK0jFW0nB9FS1C0ZClaxiha1qdoCYqWLEXLSEXL+p5YS9CyZGlZRmlZ1qdlCVqWLC3LWC3LabUsQcthR7HesW831r5szq02Z5c2lh5NuBllYbMENkNTsYv3uz8eHSyc7e6/PriwzggwuZ8l+DnsK9Y/u9Y7eLV3+Jvu0xe9xYOMAJNDWgKkZcktuIfhE6RDid8s7OR+93YYtYQsyu3EPQxfQToq6VZKyrMnfRiphsiL7b89jN5ANibxxaGyv3Y7DNtCGsX24R5G7yAbl/TiMHn2qw8j9RC5T3w62TynkxhNImSyLLkHt+woELNiiVnFilnNj5gViFmxxKxixKzqE7MCMSuWmFWkmFV9YlYgZsUSs4oSs6pPzArErFhiVrFiVtOKWYGYoUHY9Vvd60cm3IOyQFkBlKFB2MFH3WMnGHEl97ECH4cNwprHb7o3rv20usAILbmMFcg47BGW4uNNhIzZlFQAYrXdQ+b+5SvdC0+3S+c3n+z4467dO/Z8nu8p8xZ/YuxjZgVQDtuFJfkIKmZyjBRkofLu4aSZ7EtXoOewhViSoyNn4E0FbFbbPYROeAmpbJfQ6GNoBZoO+4klOUh6NgfJQRou7zVkZrI9XQGy1XaPqBOefDbbyWeCO0So77DZWJKTz2UvIWgwt2aZW8eaW8+PuTWYW7PMrWPMresztwZza5a5daS5dX3m1mBuzTK3jjK3rs/cGsytWebWsebW05pbg7nDrmLN2he95ecT7kFZzK3B3NBPbPV8b+U0I67k5tZg7rCTWPf0g3e3uW0VV3JwawC3LnBPtwZu6y2acvdOL/L7wf79n3ZkeBId/vZ3Pn+SDTKSkFFxO7k1AFsX2JF7GLWGLIrb0K3B0nqLjtzJrg+V6/oITy0LCRW3i1uDnXWJ7biHYXtIw2c7t2yuc2t044wGHusC93Ab0LFh6djE6tjMj44N6NiwdGxidGzq07EBHRuWjk2kjk19OjagY8PSsYnSsalPxwZ0bFg6NrE6NtPq2ICOTajjZwvdiz/2Hz+dcBvKAmQDQDYBkDeWlwf7b/WP/8AILbmRDRjZhM+l713rHnzevfqMEVpyJhtgsgmYHP/OXYSSOa+lGhCyKX9s1TAJCUnJpO9BitzHREH4VTyANiBmE4g5wWGRWV9PNYBlU/z4qmEOFnKySQ+Jzn1IHIRfxWNmA3Y25Y+yapMI+WzK6iFmQc6WJWcbK2c7P3K2IGfLkrONkbOtT84W5GxZcraRcrb1ydmCnC1LzjZKzrY+OVuQs2XJ2cbK2U4rZwtytmGvsENnNpYe9ZcXmuMPJtyJsuDZAp5t+HT5+pNm+ULv4ZNm/3eM6JL72YKfbTit6uDVZu2H7rULzeEjjOiSE9oCoW2BT5otONput7F7cPf0dpn8867dH+Xb0B3+9rF7uS0Y2hb4oNkCpO0WkG7OrW0sPeLy4Ld7Pv39jt/v+njX3s/zSHrkD2xHaQuUtgU+fLbgabvdRu4El4zKccmM7t22gGlb4MNnC6K2W4g68SVjMl4yYWYeMvM5Tzeb43QzwT0g9LQt8HG0A1Q7FqpdLKrd/KDaAaodC9UuBtWuPlQ7QLVjodpFotqNacztRhtzB9/XY75vxnzfVnigFBwoxTlQMWh39aHdAdodC+0uFu1uWrQ7QLsL0f7y3uD71Qn3uCxcd8B1F47Xun+0f3aNEVdyqDuAugugPrj6qlk/yIgrOdEdEN0VSHQHRHc1POp2wHRXINMdMN0FTMdP5ldfbZfJP/1p3+6Pdu6Z9OH8/Zn+zh8YW0FxYHRXoNEdGN1V8MzbAdNdgUx3wHQXMD3LJWMyXTIqPDQe0ir/ubcDp7sCne7B6Z7ldB/rdD8/TvfgdM9yuo9xuq/P6R6c7llO95FO9/U9/PbgaM9ytI9ytK/P0R4c7VmO9rGO9tM62oOjfbht/NTpZu3b/vEf+ofPT7gTZdG0B037UNOnnjeHX/TvHh7cf8qILrmpPZjahy9YP7jdX7+68fps9/FLRnTJZe1B1r5AWXuQtQ9knWBnXyfrfmsPhvYFGtqDoX0xTb09MNkXyGQPTPYBkxNcACrrNmoPIvYFitiDiH0xjbs9oNcH6E1w8tis+6I98NaXx1vRCXm7+fWkj4GiE8lb0Rnl7Yej33dzwt52JQhWhjgr8/7sFZ1R9gar4ivjR7uaElZXclY3isOiUx2H24VTsJCKs5ARHBad6jjcLpuFZbSsZYzisOhMyWHREXC/Djj8nz90H9zurRz6L83CmfZ16vWl5sy5CbeqHC5uwyIIc+Tm+Z/P3obZX/xucPls/+7h3vlnjDBTA7kNS0KYI3eh/3z+c5jri/21te6tpfHPoEfDTC1l0SE46EXPxmrDJ0iH8r672JnFW75tHhLyKnhaVhu+gnTKgHUbqYbIy52W1UZvIBuT93JRs3jVt83DQl7ljs9qo3eQTRkKbyP1ELnPe37ZfOdXcEQCnm9+XexELUEgdWJJnWKlTnPzILrNmGAFiLMCESKn6h5Et6smYRUlZxXj5E31yZtA3sSSN0XJm+qTN4G8iSVvipU3TStvAnlTIO/B4vHu+TcT7kFZqE1AbQqoPTi/0D19nxFXclsT2JoCW2+s3mqOPGPElRzTBJimANOwgbA5sv0Uk9F+sKlh/ZuxzWZH9tq24ROkU96g6TZqCVnIfAclgtHsg6IgHZWtAzDNoPt6m4GGjHTGAyQzHKCR7bZt+AbSKXACdRu2hTRsxqOi8x8VB+m4bJeNyd+UvU3AQ0LFTaYWBI6mwNHJTzKX4SQbeXlcSHC0ZDlaxjpazo+jJThashwtYxwt63O0BEdLlqNlpKNlfY6W4GjJcrSMcrSsz9ESHC1ZjpaxjpbTOlqCo2Xg6I2lle7F+92lF93DFybcibJoWoKmZbih+8Xi4OGl7okDzdNLjOiSm1qCqSVMzDrZdqd5fKy79IQRXXJZS5C1DDd0p36HLYLW/NeM2yQIkqriYbUEcctw63fyFw7FjA6WgqTKm6/VRq0hC53z0Mj8rx63ORjIqYqH2BIELsMN5MmPlZ7NsXKQU4FjuNqwPaRRxXNtCR6X4bbz5Kecm8Gr4kKByhVL5SpW5Wp+VK5A5YqlchWjclWfyhWoXLFUriJVrupTuQKVK5bKVZTKVX0qV6ByxVK5ilW5mlblClSuwqfb+480V2/0XzyacBvKQnIFJFdhg/Hjl3rHLvfuP2CEltzjCjyuwu7iK9ebtS+bLxcYoSXHuAKMq+0ecw8WzzSPzm73QeF3+3bs3rvvk3xPu9/5A2MfrioQuQpFnuC1u07ul5bbmCXkILMfnQiDT3V0FGRWwwivNg8Neen8R0xmOmKjT10V0FyFNE9wPanc70C3MVvIweY/Ono2R8dBZjUM+mrz8JCXT3vW2ewvTyuQuNruyXiys85lOutGH5Jr4LhmcVzHclyPeS1cz89r4RqYrllM1zFM1/UxXQPTNYvpOpLpuj6ma2C6ZjFdRzFd18d0DUzXLKbrWKbraZmugek67Ib2eq238LJ/93Bz++GEO1EWqWuQug6k3r+6uPH6xMbS8f7tk4zokmNdA9Z1+PD8+Mv++rnm6aFmcYURXXKva/C6Lvsdbw1I1wUiXQPSddnvc2uQuQ5knqDbEuXsVdeGqyH8gl/q1oBuXSC6NaBbF/0CtwZo6wDaCS4Pk7OTXRuuh/CL87QGT+uy39iGudmCNTdbxM7NFnYMou0ooke/v7nIW3yfxnx/bjAOc7kFay63iJnLLeqbyy1gLrdgzeUWkXO5RX1zuQXM5Rasudwiai63qG8ut4C53II1l1vEzuUW087lFjCXW4RzuZv1U93nF5qlYe330fnm3rcT7kdZSA7TuUU4nXs0xu7LV4Olu4wYk8McZnSLcEZ3EOONJ82ZHxkxJuc5TOoWBU7qFjCpW4STuhO0KOrkaugFI7lFgSO5BYzkFuFI7iQfbmmG1QSYwy0KnMMtYA63COdwJ7ggVK6eXTBwWxQ4cFvAwG0RDtxOckGY2ZUPYMi2CIdsJziXbNJzKbgxheoucJo2iZDaJDjUJhFJ7Z9bAM0BhUmEFCbBoTCJCAr/3GioInqQCClMgkNhEnEU/rkzUmULqWAhFWchIyhMojoKkwgpTIJD4XYZoyhMYkoKkxBw/w0pfOboxtL+5tpy/9z3vXurE25GORzcBkQQ4Oij6cUXzZf7f1o92b1weGN5mRFgagS3AUkIcBTBqwe7F79pA1w40f3qKSPA1AImQXCIi35ATYLghKjjvW4SBOdR0Q+tSRD8O1JKE/I2Ug2Rl/u8uo3eQDY1vL9NguAf2JKfYbfRO8imjCbkbaQeIq/hZW0SIa43vy71kbbqhM5++/WEz6OqE+ls1ZkbZw8zJlgB4qzAeztbdcSWY8Ha71c2Fmy4mhJWV3JWN8bfqlOdv4cLp2AhFWch39/f7d9QFS6jhWW0rGWM8Xf7Z6byt+qE/n779S//zBx51V291btyqP/kSvP4xoSbVAZ/DwMiCHDU398c6V042dz7qnv9/sb6bUaAif09DEhCgCN3nsH9+4P7670rh5prT7uXnzACTOxv1Qn9/fbrUvuWD8MnSKewDeLDmCXkUG7X8mH4CtIpwtrDSDVEXm538mH4BtIpbHP4MGYLOZTbmnwYvoN0ipD1MFIPkRe2MbyNeVTRb78utQW56hAomliKplhF05Ybw9XPk+rmQdcEuiaWrilG1zRG11Sfrgl0TSxdU6SuqT5dE+iaWLqmKF1Tfbom0DWxdE2xuqZpdU2g63D0V+/mo/43RzZen+ge/HbCHSoLrQloHQ4A660s9tfPbrw+0Xv4iBFdclcTuDocAza4e2Pw7dON1ycGl54zokuOagJUbzsMbHD11XYfLP7pT/t2f7RzTz5Yv/MHxkqOANfhULDEg3Q6+edPDTOQkJHMe6AiuD3VgVKQVnENy4dRa8hCZz44MtPBGTUfAcPDIWGJryKVfRzVMAELCdnMx0nP5jg5SKu8fuXDsD2k4bOdbjbX6ablaEYh27edHJbmfHOZzreA7xI+NMjgYcvR5d7y6/YjzeVX4z/SfLLzk08/+8ueXXt3bka59adC4bf9KIum/19sdwkfOmTwoeP5d92nLwbnVwb72ydRzclb/eUnrPXZBk3Umbw+cgvdD3+gx/3AzMuKSqgTSVadSMbWieT8nFMS6kGSVQ+SMfWg6kbVDVdNwipKzirG1X1kfXUfCXUfyar7yKi6j6yv7iOh7iNZdR8ZW/eR09Z9JNR9wlF1zc3TzZ3Lzb2velcO9d4c77053xxa/5/7v55wV8pSA5JQAwrH1g0urPfWD/eP7G8jPb3S++Jg7+zBn1YXGJEmrwdJqAeFI+yaZ+f7r550Ly60HxGenundfN48OvvT6k1GpMlrQxJqQxWMsxsmQZBU4ZUhCZWhCgbZDZNQkFQ5vfqG4WoIv/AJdsMcDORUdjVIQjWo/NF1wxwc5FROE79huB7CL7wEJKEEVMGwOtVR4HLFcrmKdbmaH5crcLliuVzFuFyN2aehRvdpjH5fiNrcpMDxiuV4Fel4VZ/jFThesRyvohyv6nO8AscrluNVrOPVtI5X4PhwuF336YuNpdPd5/ebazcn3Lmy2F2B3cP5dhtLx5pTC83BRxtLK4zokntdgdfDEXf92/t79+/31r7tj5s4EESX3OgKjK5qMLoCo4cD7hJ8iO1kxZ8CkKsaQK4A5KqYdyMUWFxVYHEFFg9H1iW4QlRW5imQt6pA3grkrYp5QUIBusNJdAlOJpv+ZAoWPhS2qkHYGoStWcLWscLW8yNsDcLWLGHrGGHr+p58axCzZolZR4pZ1ydmDWLWLDHrKDHr+sSsQcyaJWYdK2Y9rZg1iDmcM9d9udB9+V3bT+DgWvfk4oSbURY0a0Czhr72h/tft8+Qexcu9y6vMQJM7mYNbg6nzfVfPOju/6Z9yP39xebMJUaAyemsgc5621cf7p7e7nPDP+/a/VG+9x7C3z52L70GNuviH21rkLTe9qWH6EMUIWn+IVKQUEmPtTVQWm/7nkP88ZA5jsfoznkNjtalP9PWIGu97RsO8UdIz+AIOUiopAfaGmyti3+grYHbett3GuLPMJfjDBt9m8EAtQ2L2iaW2mZ+qG2A2oZFbRNDbVMftQ1Q27CobSKpbeqjtgFqGxa1TRS1TX3UNkBtw6K2iaW2mZbaBqhtwuYC92/0b59sHl8f3Dgx4U6UxdkGnG3w4XTv8puNN7d6Vy8yokuObAPINuFm8oVXzb1vu6fudC/eZ0SXXNgGhG0CYcc/Eokg9YRnhgYobQJK44ecxTPNo7PbpfC7fTt27933yaSPOu9v6nf+wFiBGiC1CUid4DGVyHhMFESusEN2c25tY+kRt0P2b/d8+vsdv9/18a69nyd/Jo1/YDu0GWC1CVid4JjIXI8ODfjZBH7OdZ2oTNfJqDsNQNoEkE5wTHTGY+Igcpf5OjEZrxMTZOYhM5//bLOZzrbAoIBqE6A6wdnm8gzPUx0LerYsPdtYPdv50bMFPVuWnm2Mnu2YreC2vpZ9FlRtWaq2kaq29anagqotS9U2StW2PlVbULVlqdrGqtpOq2oLqg5ns3fP/9g8ft27cqh75WJ37fGEm1QWWFuANQxm3/9Fb+1x+wB74WHvwPeMAJPb2oKtw6ns/fvrg7une1cODb5d6f/4nBFgcl5b4LXdYu93qmcLCTZ+M573WmC3rYbdFthtt9gTnuw5kJjRsVKQkcq57ZJmscvdgsTtFnvFkx0mOYPnwRaAbqsBugWg2y32kCc7VHo2h8pBQi7nBWVmsCnegthtNWK3IHa7xa7zZKefm8WDfQtd/WzQ1a/75aX+3QPNkfv9kw/bj2VHv+tdvDD+U0+q9n52y5b9Ywm8+TFt3A/mp2QAnQJt0Cmwt3i6ebo2WHnSfb7WLvWhp92FJ6yljuoUaMd1CrRi3FKPdgoMf6DnZakd1Kccqz7lYutTbsyoCTc/oyYc1K0cq27lYupWbkzdyo1pYeDqa2HgoJ7lWPUsF1nPcvXVsxzUsxyrnuWi6llutJ4VnL+6wuW1sLyWtbxxdS43bZ3LQZ3LBXWuduvI2XMbS1/1LpzsrRztHXg94b6WpdTloNTlwtmPyw+7x9Z7B073Dny/sbTYnDrIiDF5tctBtcsF1a7e4W/63yz0T/wwuHqoe+37/rFnjBiTF7wcFLxcDc0OHNS8XPFvbTiodbka+h84KHe5YvofOKhpuQr6Hzgoa7nS39twUM1yFXREcFDQcsV0RHBQtnLFv7XhoFzlamiS4MH2nmV7H2t7Pz97TzwY3rMM72MM7+t7c8ODyT3L5D7S5L4+k3swuWeZ3EeZ3Ne3x8SDvT3L3j7W3n5ae3uwtw/sPbj0YmP5XP/0jebp+Ql3oizq9qBuH44EuPpqcPVBf22le5MTXXJve/C2F4Ckwd3TzcK17qNFRnTJpe1B2r6YNzc8cNqHnB7ufu4ef9k9fpG7+/kfd36267O9OUyNv387IHhAtS/mvQ0PcvZl9TzwwGdfzMsZHpDsQyRnuBRUvkvBBHlZyKuQVzM8iNiX1czAA4t9yOIMJ5TNd0K50bxCHPti3r7wsGfDB3s2Nl6f3Fg+t/m/m/WH/ZdPm9X924w98u9s23jPXRvzJGTYauHDrRbHXvZfvupeftH7drndDX3sBGttovZZ+HH7LPy4iYx+biYyik5Yctn8ehJNRCey5CI6c3NCtRkTrABxVuD9Sy6iU13JpV01CasoOasYVXIRnepKLu3CKVhIxVnIiJKL6FRXcmmXzcIyWtYyRpVcRGfKkovoCLj/hhMZ3yx0r51quyoeO9e9eHHCzShH1aUNiCDA0X9vr17dWL3S/kv7/Hb32UNGgKkLL21AEgIc3ehw5lTvTDufuXf2RbP6NSPA1LUX0SE4xKXUXtpICSIfrb2cX2kWVyZH/rd79+74w59T11o2f+tE7osOwelRSp2ljVRB5HX0xxCdsAQjOqWUYEQnLMGITliCSXBFqDxXhAlysJBDGeWWNlIHkdfRCaPNxENmPu15ZfOcV240h6Dqsvl1CVUXQYBgYiGYYhFM84NgAgQTC8EUg2CqD8EECCYWgikSwVQfggkQTCwEUxSCqT4EEyCYWAimWATTtAgmQDCFvS2u3+/vPzzhHpTFvgT2pXCf/zcLvLiSk5eAvBR2iRwWDXihJccuAXap8CEMbQIECRVnYAIDU+FjF9oEFCRU0BaENlwN4Rc9dqFNwEBCxbGYgMVU+KSFNgEHCRW0OaEN10P4xZGYgMRU+GwFIUHKkiVlGStlOT9SliBlyZKyjJGy3PoteyGr6w7ZrqaE1ZWc1Y0TtKxP0BIELVmCllGClvUJWoKgJUvQMlbQclpBSxC0DB8j3/t2sHJusHLup9WT3WtHmycHmicHJtyqsoBaAqhl+DD54NXewsP+y1c/rZ7c/P97Rw4xwkzuawm+lqGv7327sfx4Y/nIT6sn21cOzq5tLB9hhJnc2hKsLUvvF9lmQJARJf3I2snqOgnOlqU3hWwzUJBR8U0h2yQ0JFV0U8g2AQMJmaSXjcoqPQnyloV3fmwTcJBQ6Z0f2xw85OSTnmM2/TkWhB9KXJbe3lFICf/6B68K9NfXmvX2E0r/9UL/1eufVk82Xx8YXH0w/nMKviog3+9dgdDqHwY/sHODeAmfM4KXCJpH93onvm8/K7983F1aav+f1SODlXOstYt5lSCEaLh2etwP5uZVAgW1IcWqDanY2pCan9qQgtqQYtWGVExtSNW3i0JBDUixakAqsgak6qsBKagBKVYNSEXVgFR9NSAFNSDFqgGp2BqQmrYGpKAGpHDuZu+b/RPuQVmKPgqKPircRXHuef/CPUZcyas8Cqo8KqzyPL/fvLzEiCt5WUdBWUeFZZ34B18RtRzujgMFhRwVFHIGl541b25PzuHXO/9tZ4Y2DW9/7ZgsdJCFhCxk2keQYhZHQkEOZfQ5bCPVELlOu/oy+6YCBZUZFVRmklwHKtN1YMMLwUIaNu2h0LM4FA5yKKN7YRuph8h94pPI5jmJxGgSYQFGhQWYBKeQy76dQ4NwNUu4Ola4euvZA0LPzeyBdiUIVoY4KxMhX12ffDXIV7PkqyPlq7csOimhhapwgRUssOIscIyIdafGZbSwjJa1jHEi1tOKWIOIdThL4PHTZv1I+3L94v5351ThTSoLjTXQWIczM58tdK8dbV+uv3h4Y3mZEWByI2swsg6MvLF0rHd1qV3Bq7e6N64xAkyOZQ1Y1hWMEGiTIEiKkn5U7eQymwYx6wpGBbRJKEiqpLcNNDhalz8voM3BQE4m6RWicmFOA6V1+YMB2hwc5FTSmwYafK1DX8efTDbXi+saUK0rmAIgNGxs0OHcykf3+k8utjtETz7eWD66sbS/Obq4eYqN//yRpg3iGIijRYMfCDnuB2rcD/S4H5hxP7DjfuDG/cCP+QF1xv1gXOY0LnMalzmNy5zGZU5zs8dBw8YRHXaffHSseXO43Wtz7UH32P7utWO9K4f664vN6RXWuRm1d0SP2zui52V4p+6IoID29usJcNQdEVdA0z/3VIOlab/v5mhlCFaGOCvz3gU0/XMjty1WpbLXioarKWF1JWd1Ywpr+udGdJUtpIKFVJyFfP8CWvs3VIXLaGEZLWsZYwpo7Z+ZqoCmO0LA/TrcUnL+Wv/atZ9WF3rfn+sdeN179KY5/3hj9cqEu1WGStowMoJIR/9hPvCwd/XxT6sLG8vL/cdvNpYW+8d/6D36ghFp4pLaMDIJkY6WSJ4t9Q+/adf02s2N1e/6Tw/2jz3rXb3EiDRxbU13BMHRD2tr39/pHjrGotH//unnqatp/9vHreh2b3LiF+KN35U/DJ8gnaIHcw4zkJCRTHqAIupr73eAFKRT+stGwyQ0JKXTHiOZ/RiZIB0D6ZQ8qHOYgIWEbNrjo2d8fBykU/irR8McPORU9PTONoPRut3br5OedC77STd6gBSF6Sh6J53u8f3jP8Ps3PybW1c+Jjp2tGhVhw8I6iTEqpNQbJ1kbhqSDjMmWAHirEBEPaS6hqTDVZOwipKzinF1D6qv7kFQ9yBW3YOi6h5UX92DoO5BrLoHxdY9aNq6B0HdI2xI2qzub34401b3761OuBNlqXUQ1DrCtqS9+zcGF591D53prtxmRJe8vkFQ3wibkw6W1vvrZwfPbwyuHmFEl7ymQVDToMJ7pgwzIMioiM1Cw0glRF50u5RhBgoyUmk/19MsCzIEtQsqu1HKMAEDCRWxbWgYqYXIS+6RMkzAQUIu7aViZll3IahRUCF7iNpIw1oEFd4ZRXcIyhE0XTmC4soRVF85QkI5QrLKETK2HCHHbNuQHbf190VnXsoXEsoXklW+kDHlC1lf+UJC+UKyyhcysnwh6ytfSChfSFb5QkaVL2R95QsJ5QvJKl/I2PKFnLZ8IaF8EXaD7b640Ty5ubG02Dv27YQ7UZbyhYTyRdgEtnvoZu/m/ebx6+bVY0Z0ycsXEsoXYe/X/rHl7rUnzd2F5sYXjOiSly8klC/Clq8pXgWPKFow+2oMoybIopCShYSSBXR4HU4g7B5/2T1+kTuB8B93frbrs7056hb4+7fTmITChSy7cCGhcBF2eE3SMUFmb7sxDNtAGoWUKySUK6Cla4brROe7TkyQl4O8Sq5aSKhayGKqFhKqFmE/1yRXuMvcE0V3JBQq5HSFChlXqJD1FSoUFCoUq1ChYgsVan72TSgoPChW4UHFFB5UfYUHBYUHxSo8qMjCg6qv8KCg8KBYhQcVVXhQ9RUeFBQeFKvwoGILD2rawoOCwgO0IF37brD//IR7UJaSg4KSQ9iCtFn7oX/gDiOu5MUGBcUGaEF670XvxCojruRlBgVlBlV+V5VhEgRJ0fhhfFdfbZfUP/1p3+6Pdu6ZNI/v/esQ7/yBMbNQh2lISKv0livDJBQkpdJ2C6TMnVeHMWvIofC+K8McDORkMl9DKtM1pMK0LKRVeFOWYQ4OcnJpLyGTuWfrMGYPOfjMp5vNdLqZ4M4QFi9U+W1bdEeDvTXL3jrW3np+7K3B3pplbx1jb12fvTXYW7PsrSPtreuztwZ7a5a9dZS9dX321mBvzbK3jrW3ntbeGuwdNjvt3Xi6sXpx4/XZCbehLPzWwO+wzWn/9sn+3YXuV48YoSUXuAaBhw1Om9X9G0un+i/uM0JLjnANCNfFv6qgQeBhX9MUT886s3zKrEHeuvj3FzSwWxcyLGQYqYbIy35VQYO0ww6nKa4VNcsnzRqErUt/f0EDr3Uh40SGkXqI3Kc9s+wsmw9owLQu/v0FDdsC9HTbAnTctgBd37YAA6UJwypNmNjShBnz/oIZ8/6CEZ0x36cx35+b9pUGSh+GVfowMaUPU1/pw0Dpw7BKHyay9GHqK30YKH0YVunDRJU+TH2lDwOlD8MqfZjY0oeZtvRhoPRhwnYNC4u9lS+bH/YP9t8c7L/SPb/Su3B/wi0pSxnEQBnEhH0brt3cDLP/zd3B+YXu9dsbKz8ywkxeEjFQEjFhA4crZ/sXzzSHnzenbjeHH3SPnm2e/sAIM3l5xEB5xBRfHjFQHjHFvBZhoBJiiq+EGKiEmLJfiDBQHjGll0cMlEdMMa9GGKiEmNIrIQYqIabsdyIMlEdMMe9EGKiEmOIrIQYqIWa6SoiJq4QYGuNxErV90rdQIbGsComNrZDYMRUSOz+DOSxUNiyrsmFjKht2zGAOW99gDgsVD8uqeNjIiofdclSO7lihKlxgBQusOAscUwmxnRqX0cIyWtYyxlVC7LSVEAuVEBtuArn8pndgdfDdgwm3rSzVDwvVDxu+g3Hq4OD8yuDRAUZoySseFioeFqbcLnZffd+sH2SElrzKYaHKYYMqB+yA7S083O5j3T/s2rNzwvbXiEJH+NvHvq5gochhi5/CYaH4YYPiR/JDFFH/4B8iBQmVM+92GK6G8HXO4yFzHI/RtxMs1Dps6TM3LJRAbFACSX+E9AyOkIOEyhmAOwzXQ/iFD9iwUAqxQSkk/Rnmcpxho6+MOAC6YwHdxQLdzc/bFQ4g7lgQdzEQd2Mg7uqDuAOIOxbEXSTEXX1bDxyA27HA7aLA7TpqzHmqK1xeC8trWcsbB3E3LcQdQNyFEP/mWPfkwsbqpcHVwxPuXFks7sDiLmzB+Opcc//54O7p/smDjOiSc9wBx13YgvHFne7y2eb1en/9KiO65CJ3IHJXQ28EByp3ocoTvCzcyf6+vQOHuxoaITiwuAssjm9AL55pHp3dLq/f7duxe+++TyZ9nH1/oL/zB8ZWGRww3VXQHsGB1F0o9QSXkcr+zr0DnLsKeiE48LkLfJ7rKjKZriIVZuYhM5/2jLN5zrgghxDrroZ2CB7A7llg97Fg9/MDdg9g9yyw+xiw+/reCfAAc8+CuY+Eua8P5h5g7lkw91Ew92Ng7uuDuQeYexbMfSzM/bQw9wBzH74rcOZZ/8nF3pVDLTHvvZhwk8picw8292GzhBM/DK4e6l051Dy61xx4xggwOc898NwHPO+dPjG4ttS7cqj38MZg/1lGgMmF7kHovvg3Azzw3BfIcw8898W/I+DB5n5bmyfpTkYzaCjpAea+9HcFPKjcF6hyDyr3pb814IHkfluSJ7l4zAw6SXrwuC/Q4x487kt/j0B0Qoxvfj3pw6noRGJcdOYG423GBCtAnBV4f4yLTnUYb1dNwipKzipGYVx0tt6uLjpb95EQndHtCaPfr257e3sAFBwQxTkgEagXna1RLzpEY76vx3zfVHg4LBwOyzocUUUA0ZmyCCA6Av49CIoAG8vLvR9W+k/uN2fPbaxdaO4dak6vTLhF5igFtGERhDm6Zf7oxf7a170rh/qHjnXPnmmuPeivPR0s3WVEmrom0EYmIdLRngFf/thfe9Bce9C9+Ko5c29j6dHg+uXByiVGpKmLA6JDcOjD4kD8B7SIigCT0m3MBDmUvYe+zUBCRjLtx2Yxi6OiIAeVc88pZX4PoE1AQ0I67UGRud3cxmwgh6L3zrcJWEjIpj0oehYHxUEOLueVYjLv/28T8JBQ2RvoRSesAWx+nfQ0c7nrGIJA/cRSP8Wqn+ZH/QTqJ5b6KUb9VJ/6CdRPLPVTpPqpukfw7cIpWEjFWcgYrVN1L6O3y2ZhGS1rGeOUTdMqm0DZBG35zvS+Xmm+ONmsfj3hTpQF1wS4Jngf/Xlz+EX/y+v9pwcZ0SUHNQGoKQT14qnujUP9p2fHD3QYjS45ogkQTQGi43skRRh6+051baQEkVPSNzU7Od9tbsOVEL5M2pxKZFx4BZGrbB+RaRY1CwIeU8DjBMdCZmpB10ZqIHKT9CJQOV9XbsO1EL5NuvA648I7iNxluwjMDKoRBPClAL4JziSb/kwaFSIolwLlJjiTXKZef4Ik/Assw22Ma+3/XHjT/s/Vq4PFU839M+M/KHyy85NPP/vLnl17d24jP+G3/Xw4Z/CV8M+8DCrkx8711g8Pru7vvzrYbqX84mRz9ylrebaRCHUmr89Wz3GHP9DjfmDmZUUlFFMkq5giY4spcn7OKQnFFMkqpsiYYoqsr5gioZgiWcUUGVlMkfUVUyQUUySrmCKjiimyvmKKhGKKZBVTZGwxRU5bTJFQTJFBMaV7Y2Hj9dnuizfNk9cT7kRZiikSiikyHG2w/HJj+WH34PHuj1cZ0SUvpkgopsigmNK9+E33ztfdV5cGi+cY0SUvpkgopsjSX1doMyDIqIxBBm2kEiIv+yWFNgMFGRU8yKANX0M6Rb+c0CZgIKEyBhm0kVqIvOhXEtoEHCRU8CCDNnwP6ZQxyEBIKMvI4l9AkOEgg82v2YMMhIwaZNAe+S13IMvKBhm0TRFHyxQ/f739x/n2PxVVphj+mfkoU2xmTLACxFmB9y1TDP8EVXgeSVhFyVnFiDLF8K9sUSEcft+N+b6vcOEVLLziLPx7lzWGf0NVuIwWltGyljGirDH8M9OUNdr/goD7dVDW6H95qDm+PuGelb6gsRkHQVyju0OuXxnc/IYRV9pSxmYcEuIaBepXF5v1i4y40hYx2t9NcBxLe61iM2aCHIrZG7IZroTwy3qHYjNmBTmM3P0Hl541b25PzuHXO/9tZ4a9IW9/7ZgsdJCFhizKenFiM2YDORSzR2QzXAvhl/WaxGbMDnJwiS8Gk+lisOHV4CGNYvaIDMMdKUb8/HVJb0K0jfJBxcRSMcWqmOZHxQQqJpaKKUbFVJ+KCVRMLBVTpIppjIppjIqpPhUTqJhYKqYoFVN9KiZQMbFUTLEqpmlVTKBimkLFlFHFBCqmKVRMGVVMoGKaQsWUUcUEKqYCVUygYipLxQQqpgJVTKBiKlLFBCqmAlVMoGIqS8UEKqYCVUygYipTxQQqprJUTKBiKlDFElQsWSqWsSqWWw29H37fzYuWJWhZsrQsY7Qs69OyBC1LlpZlpJZr2+q+uXAKFlJxFjJGv7I+/UrQr2TpV8bqV06rXwn6Dbe6N6vL3TMvmtUfJtyGsgBYAoBhn/v5m83ho91HK4zQkhtYgoHDTe792yf7B691919nhJacwRIYHO5wT/GRLcLBbL9IgLAsrQn/ZswScpCJPzyLmRwJBVkUM6B+M1wN4evEB0HOQDASLCxLa6u/GbOFHGziQ6FncygcpFHM/PnNcD2EX1bT/GHMIYjDPetJziSX50wSvyShQMSKJWIVK2I1RsRqfkSsQMSKJWIVI2JVn4gViFixRKwiRazqE7ECESuWiFWUiFV9IlYgYsUSsYoVsZpWxApErKYTscooYgUiVtOJWGUUsQIRq+lErDKKWIGIVZEiViBiVaCIFYhYFSliBSJWZYlYgYhVmSJWIGJVoIgViFiVKWIFIlZliViBiFWBIlYgYlWiiDWIWLNErGNFrOdn57QG+WqWfHWMfHV98tUgX82Sr46Ur65Pvhrkq1ny1VHy1fXJV4N8NUu+Ola+elr5apCvDuV76mH36Ln+y1f9ozcm3Imy4FcDfnWA38GVM93ndwb7z3ZfLjCiS+5fDf7VgX+bY98MLt/ZeH2iWVpjRJecwBoIrAMCtx1ebr2Y/PHg7/bs3PHn//6X1AQe/tqJzXb+2uFlM3yCdGjsTKP+5SvdC0+3y+s3n+z4467dO/Z8Pmm20fsLeYs/sfUosM1sJGQn0x6sCCW/18FSkM5oU7QLR7s3rnWPv+wev8hokLR3x959n/3jzs92fbY3R0d6/P1jO1ht5qEhL534MMnMh8kF2RjIxsziklLZLikVZmchO5v4WOmZHisH2bi8V5TJd0WZIC8PeflZnIM22zlogvtFSHQdED3JOejynoOiY39JxwDWDQvrJhbrZn6wbgDrhoV1E4N1Ux/WDWDdsLBuIrFu6sO6AawbFtZNFNZNfVg3gHXDwrqJxbqZFusGsG6mxrrJiHUDWDdTY91kxLoBrJupsW4yYt0A1k3ZWDeAdVMV1g1g3ZSNdQNYN5Vg3QDWTdFYN4B1UxXWDWDdFI11A1g3lWDdANZNVVg3gHVTNtYtYN2ysG5jsW7H7DW387PX3ALiLQvxNgbxdhTxwapU10rLAu4tC/c2Eve2PtxbwL1l4d5G4d7Wh3sLuLcs3NtY3NtpcW8B9zbsSba+1qy/3Hh9onv9YPf6VxNuUll8b8H3NvB9/85XvTOnelcObSyf6D+5yAgwOfEtEN8GxO/dXejdfL6xdHpwYX3w5RtGgMmVb0H5dotJZKOfojijVzY/E+QaRrb527flowXr2wI3qVsQvd1iLFnCA5NgMhnvwChISqU9MDSLA6MhB53zwMhcB8YFORnIqaQeZxaobrcYS5bykOjZHBIHObm0l4rJ/mKBBZzbshqeWdC33WImWcrTymU6rUKDS/gHP5wif/3MxvLyT6sLg+WV3sGvf1pdGP+hBEfIi/eZIT+O52Kqz6v5P7FL+EQhw6cHlzdWX/y0urCxtL//8hV31d5/sjzqMlw1Pe4HZm6WU8NJqINPnde+ax6f7F051Dx909x9yqgLbf25ncR7fyx2UKlyrEqVi61UuTGVKjc/lSoHlSrHqlS5mEqVG1OpcvVVqhxUqhyrUuUiK1WuvkqVg0qVY1WqXFSlytVXqXJQqXKsSpWLrVS5aStVDipV7n0qVS5jpcpBpcq9T6XKZaxUOahUufepVLmMlSoHlSpXQ6XKQaXKFVipclCpcjVUqhxUqlyBlSoHlSpXQaXKQaXKlVWpclCpchVUqhxUqlyBlSoHlSpXVqXKQaXK1VCpclCpcu9ZqXL/n6pUOahUufesVLn/v1I1XD6oVLn3qVS5jJUqD5Uqz6pU+dhKlZ+fF6A8VKQ8qyLlYypSvr4XoDxUnjyr8uQjK0++vsqTh8qTZ1WefFTlyddXefJQefKsypOPrTz5aStPHipPPnwBav1h8+Wxzf894U6Upezkoezkw7LTq5sba7d6R49sLB9hRJe85uSh5uRF2IhxvfnyaPPF983jg9t8UPEZa04eak6+wGGOHkpMPiwxDW3QO73Ih8Hf/2n8pv9ONAw2f/s73iQbZCQho+LmO3qoL/mwvpRcbDSLopmHgpMvcNyjhwKTDxt6pr1cVK7LJTzTLCRU3ABIDyUmH5aYkl8tZgZlMw8lJx/2+0x7otlcJ1p4+YdVKF/ggEivKMxB0WgO39/pHjrWPb5//IeRnR+3v3731syf6MrNP1bR53jRCesTm19P+hwvOpH1CdGZm/pEmzHBChBnBd6/PiE61dUn2lWTsIqSs4pR9QnRqa4+0S6cgoVUnIWMqE+ITnX1iXbZLCyjZS1jVH1CdKasT4iOgPvvtPWJn+9EOeoTbTQE0U1XnxiNLnV9oo1GQnRT1ydGA0xdnxAdgoNbXn2ijZkgh7LrE20GEjIqrT7Rxqwgh+LrE20SGpIqrT7Rxmwgh6LrE20CFhIqrT7Rxuwgh9LrE20OHnIquz4hOmF9YvPrsuoTohPWJza/ZtcnRCeqPtGeA1V9jhcCBqD+9Rvbf5If/seiShSbf2g+ahRvkyZcBWKtwvuWKTb/CNV4PklcSclayYhSxebfkTUupsLFVKzFfO9yxeZfUTUupcWltLyljChZbP6haWoWw/+GwHtyULXoHvy2e/SLSfek9AWLt5EQhjZyo2we326O3uOElrZa8TYSiaGNTj+9u9Acec4JLW2dYvjLCQ9oWKkY9h9szq1tLD3i9h/87Z5Pf7/j97s+3rX389Sli3f+wFi/vE2FMLdaWsu+TUdifjLvsYsocEx97BTmVn6n2beJaMxMZz5qMuNRM2FuBnOrpfPs23Qs5mczHzs9u2PnMLfyO9G+TcRjZrX0ot1MZ6R88tdv5D0rXcazcvSK01gE0LwigI4uAug5KgJoLAJoXhFARxUBdIVFAI1FAM0rAujYIoCusAigsQigeUUAHVcE0BUWATQWATSvCKCjiwB66iKAxiJAOAi2e/xS7+6DSfekPEUAjUWAcAps9/St5t4yJ7T0RQCNRYBwBGz/1JHu3Uuc0NIXATQWAXRp2xXeBk2YBWX+GNSZEYc1Ul+XtnXhbdAKs1BJ3+an9G/zQwIaEyhro8LboA1mYTJfKGpGitUodF3aroW3QTvMwiW9UEy+bipv4/WYgM98itlZkRS5rUvbrtAGbRDWhgdrEw1rM0ewNghrw4O1iYK1qRDWBmFteLA2sbA2FcLaIKwND9YmDtamQlgbhLXhwdpEw9pMDWuDsA6HtvbO3+wePTvpnpQH1gZhHU5s7T5/0By+zwktPawNwjoc19q9uNB9/oATWnpYG4S1KRHWBmFt6oG1QVibEmFtENbhXFZ4wjVYPNM8OrtdOr/bt2P33n2fTHq+9f7afucPjN/lYNDcpkRzGzS3qcfcBs1tSjS3QXOHk1hzXUMm0zUU7FswyHFTD8cNctyUx/F2/37wSeHtNyZ9TBUdiuT4X99MnAOOD5MmXAVircL7c/yv7zVWxJ7hwklcSclaySiO//WVytoWU+FiKtZiRnD8r2921raUFpfS8pYyiuN/fXuRzfHhW2hwTw5f0b93rX/75KR7Ug6ODyMhDG10s/uxZ/27Bzihpeb4MBKJoY2K6seb3dXvOKGl5rjoEOEBLY/jw6AJs6CcL7V2sr8C/jYLiWmVJvFh0AqzUKOtKZ41b25PzuLXO/9tZ4aN6m9/7Zg8dJiHxjxKU/cwaINZmJyXisr9/vfbJCxmVZq3h0E7zMIlvlJMpivFwqXiMRGf8ySz2Yc8bGYRuPrtN8pyNeH+ceLtH6fo/eMU7h//MPiBmxNwE24sJ97GcoraWE4Vbiwn3FhOvI3lFLuxnCrcWE64sZx4G8spbmM5VbixnHBjOfE2llP0xnKaemM54cZywo3lF281T9eatTvNk/VJd6Yc7CbcXk6wvbw5e6NZP9W7/Kb7aIUTYGp8E24yJ9hk3lw/0xx/OLjyfGP5NifA1AQn3GpOsNU8fmdjhMAZW4AJd5kT7jIvrS3e2xQk5iSTbjcV2Q+KwgRqeFuccMc5wY7zBIdG5twJTLjZnHCzeWF98d5mYDElm/SY6OzHxGECNbzqTbjvnHDfeWnN8TZTCCBOsN88wenm8s3AFIIEPNt++42JH0FF7LPt9g/Ny7PtYdKEq0CsVYigtgiebX8Y/MDXZh0BD73ffoOzxHEGF/U99B6uncLFVKzFjDG4qO+h93DlLC6l5S1lnMHFtA+9ScBD77ff+OVf0EcrzZ2Dk25WWfQt4KH322+MPPQ+N/j6K05oyd0t4KH322/88jDj2rXBo0Oc0JKLW8BD77ffyPd4IgLg/MfFwywI0xo5GQb7bzbLXzM+vf5l586Pkm9Bb3/pr3d+vHfHL/FTGLvE2GXOJ0ZiVodEYVoFvd49jFdjAjrncZH5HxcPkzCYlUl6paikVwqcUhZjtzmPiJ7REXGYVUGvdw/j9ZiAT3pK2aSnVHiRh5wW8Fw7+SnlZvC4noRFZFsesm00su0cIdsisi0P2TYK2ba+59ntwklcSclayUhL2wotbdHSlmdpG2dpW6GlLVra8ixtoy1tp7a0RUvbwNIbS6e6F+70F7/bWPpy0p0pj6gtitqGY95e3GgWf9x4faI5t8YJML2rLbrahpvJ9z/pHvymWT7fXd/PCTC9ri3q2pb1PLuNlzAByvssqDOTR6dtIhIzK+mpdhuvwgRU0k/ZlK3EYZHStqzn1m28BhMwea8LNZNnpG0iFjMr6fF1G6/DBFzS68JkK2hYlLPd4k3stKeVzXdauSAzcLUt6jG1xI5oktcRTUZ3RJNz1BFNYkc0yeuIJqM6oskKO6JJ7IgmeR3RZGxHNFlhRzSJHdEkryOajOuIJivsiCaxI5rkdUST0R3R5NQd0SR2RJPQEa15ttC9+GP/8dNJt6UcfJbYFE1CU7SN5eXB/lv94z9wokttZ4l90ST0RWvuXesefN69+owTXWo4S2yNJqE12rzDWWJXNIld0Yp8DVtiQzQJDdHmXc0Se6FJ6IVW7F5wiZ3QJHRCm3dTS2yCJrEJWomvY0tsfyah/dm8e1pi5zMJnc+K3Q4use+ZxL5nRb6aLbHlmYSWZ/NPbYvUtjxq22hq2zmitkVqWx61bRS1bYXUtkhty6O2jaW2rZDaFqltedS2cdS2FVLbIrUtj9o2mtp2ampbpHb4sLp/6MzG0qP+8kJz/MGkO1MebVvUdviwunv9SbN8offwSbP/O06A6cFtEdzhw+rewavN2g/daxeaw0c4AaY3t0Vz2/L6nw2DJsxi/Fjvwd3T2+Xyz7t2f5RvnHf428f1uB5mIDGl0nqfDYNWmIXK3GWYZtInfpiKxtxK64c2DNpgFibnpaNyXDrKhSlZTKm0ZmjDoB1m4TJfOmYm7eGHqXjMzec86WyOk86EdwMAuC2vN5oUHVD45jcmfjoVnViFi87WvdHaH8xLb7ThahAuD7GWJ4LnorP1C9vtD2p7YXu4ohKXWLKWOM7tolOf29u1U7iYirWYMW4Xnfrc3q6cxaW0vKWMc7voTOt20RF4Fw/c/p8/dB/c7q0c+i/Nwpn2Wfn6UnPm3KR7VxbAt4ERRjpyQ/3PZ28j7S9+N7h8tn/3cO/8M06kySXfBiYx0pH70n8+/znS9cX+2lr31lKzfpATaXLSb47vCCL9f4fSpQeddrNgC+GWiFNRamJ2aAG1+/RgYyEzGoj2CN75Z8htHGgeGg7r0Y0hV2Og+cyYulFFQS+fvKgyQffQ0FifDnaqKbrbTakcGcY0jgwLVP+YoftnOCxXN4Zc3IHmM3Mqx5QpfWPKAt0/Q2P1OtipluhuHw6r143Bt5Sg+Qy5R0+VVGZB21QGWyNQCwDxZG19CpsGAA==";
var lightConesData = "H4sIAAAAAAACCp2c224bSZKG30XXxk5nZhV9uN+rxQCD3Yu9XBi9Rrex3fbA67kYDAYoUhRFikdZokhKpTNJiZJIFnUsFknxXWYqMquu/Aq7KS7GEb2iKSVguG2goR/Fiv/LyPiD/ssS/+GHH35YevOXpff/ufTm//72YunD21/fLb1ZijfzcXV36cXSp7ef3n/+89Ib8WLpj28//7z0ZulfP/70p3dLL5be//jxw//+n/o/v/vl/U8/f/6PHz9+ePe7hx/0T3/88NPSX188/FRGNNg3DZXrqI73qMYfPr1/99+fvy/CsAgnIvybCDQ74Nw/KvLvbz99ev/x0/dVOFYRREWgR6m0VNl5VOVfPugf+H0RgUUsImKhRxlO4tTyvEf55eOP//V9FQur2ETFRm9+UomPUo+q/NvPb399++H7IjYWSRCRxDcR2Qgg2HhU5Pdvf1pQXQks8ZJIvESvpD2Ccdu0gl9ijVdE4xV6I/Wc3HONK/gVFnlNRF5/EwmHFXB75hX8GqkwYniGDC+zRbg/NK1ghh3PiOMZcrz011Spb1zBDFueEcszZPlo0oPWumkFM+x4RhzPsOOTN/GXllkFM+x3RvzOkN/Vji/XaoYVzLDbGXE7Q26Pqssy2TetYIbdzojbGXJ7OB3IXtK4ghk2PCOGZ8jwMHbUVsa4grHjGXE8w44vTGEyMK9gbHlGLM+Q5SNvGb4UjCsYO54Tx3PkeLU7jU6SZhXMsd858TvHJ3x6e96n9ft3v3789Ofvi2C7c2J3juwugz5MM8Yi2O6c2J0ju0OtqS4eZ8o///L28/uP338lHDueE8dz5HjZy8urM3OVb55npLdjpLcLfQfcQLp9qJSgP4z6uM+znu5/hhs9Rho9Rho92diGXi70S2r3MD5yH1Vb7B6GWz5GWj5GWr5w0lCb+2o7rS4u9LM2O48qLoQCw90fI90fI90fbPalm5OXuXhUf1RqEa4ZbgEZaQEZaQGjngfTTOh31XZanh7Kg7tH9RZCguFukJFukNFucDyMxwewsi0vjqJpKZwczHt7CzDOcGvISGvISGv4d6cgs+t/d4pqOx3199Tm/qOKCxDFcJvISJvISJsIlULoO+qkCNNlubxi7ISXWO0VUUPHhyqU9K1nOx2dZFQwNXfCKyz3msihc0S6tTi5obbTsZOTeXMbvEZqjHAFt5BRL4DcuqEBGEYJIyjBHWTol6LDgqzvqx0/HG+bVj/DJGGEJLiTVCd16Geisw2YLhvXPcMQYQQiuKGE7HnU64T+lqoW4t1G6Oflbsus9BmGCSMwwf2l7DZl7VYmPWhNTOueYYwwghHcZkLmCqbL0E7JQU2VD6LsRVw7ixzH2AAMw4QRmODOE3qr0GuAnwI3iG7zsDY19QDDOGEEJ7gJValh6J/BypW8OoXKyddx0tQPGCiMAAX3o1F27+s4iX83tgRGCiNIwa0puKfRxi40O6GfN7cEBgonQMEdKjQ7MlcMRxdqOx2O12WmY+YHjtnCCVtIt9rNhaO7MGjK4pGpHzgGCydgwT0rjG7j6lSf5uU7Yw9wDBZOwIJbV5ldD0cXst4H11PJc1MDcAwVTqBCWth6S3rXkN2dd3AvLn3SxnLCFI6vrtNVuHekezaPk08oeo4xwglGOB5XDc6+jpOyeiy7LVm7jWvX84z2lOrnGCWcoIQjlMhaJ25WdOmPzmBclmnDRohjknBCEo5IIre3oOmGfjEcb8vxeVydGnsAk4QTknBMkkpJS7k56e6bewCTRBCSCNyaTBvgDWS9L7PrUG3Pe3tPsIHALBGEJQKxJF4tRtNNGE4g0zK0gcAoEQQlAqEkrqakm42Ok2GwHg7zMl02NYPAPBGEJwLzpHYAzTSU+7Fj3hQJTBNBaCIQTcLRmqy1wqCt8fWlAMMr7QffkTXD1khgtgjCFmHjK2RV5TqhH6g5tfkEGwjMFkHYIhBb1H1JHrXBK8fVVWieQOZL3OgYv0KMFkHQIjBaXAcqJX0NuTmC3q1pgWKwCAIW8Yp0DCp5rsWmLjTT5iWDsSIIVgTCihqtxs4BrE+iaSUc5ufdsp5idcwWi7DFwlHZxq28vJKX7bhxZ1yXFsaKRbBiIaxAayKzZRg7crxpzEwLg8UiYLEwWDa6Uc8LgxJMl/UwJWhDb9v47VkYLhaBiyXw/a4Z+mdhEOgBx3gTNgfzbnlPeIEWhoxFIGNZBGjR/VDujKPsnvmHisFiEbBYuGnxKuGwEu824lE9HOahUjKsFwwXi8DFQnCJ1q6gWIL7FZUcmzLFwkyxCFMsxJR4tA5NF9opmAzi7XJ0WDDEioWxYhGsWLhfOWprpnxpQPMMWqumlLYwVWxichs3EMsuZDtQPgP3VLq70KzGtevHX92imbP+wViTmN1mj19/4loPnIaxIHa8TRxvk6x8W94k5aD2dVwAb13/mUyjn6eJDW8Tw9u4m0hPZW0ldjal5+sDYret0remhrex4W1ieBsbvroSBvmHTiIf+k58eGP8kNj1NnG9beMk7xqynqyXoKmHf7M/mFasja1vE+vb2PrTSexU4mN9zMva7bzqeQIAbAwAmwDAfolZM4D0dHaBgGk96nnGnyomgE0IYL8iOUZ0WNB3wFpLo+DQMT6dbEyBBKFAAofkXlN6l3HQjtsN/bEetc3oncAASBAAJDAAkquy1pI31+AG328Nn3JCJTAEEgQCCZyeBKU4daxGWZUaQqZII8LncDyBAZAgZkzgSKO8GpVXoV7Sv0qZuNGZVzmLIzD9k7EoMWTC/u29QndTubz0Ns3lsBcTxIsJPD/YvA/9M7XfheSqudY3G3KS7nGS7sktT+by4WgEa4cwduAkD7miYdFwnPBxkvBxkvBBffp1rHMbPR6cNiBtODzgOOPjJOPjNOPzgzDIyHpp5v3ZEWIGOI5jPk5iPk5jvmkxDPIwqf7NOYr3r+A+r/IdVSgZUofj0I+T0I/Tva/ZELt5ojb3513vFyCH47yPk7yPk7xvdgo/XNbu4Gg5bnWNP1QbCyaIILJGfLwHlXV1mYtyl98/GhceHBxnfpxkfpxkfrOZoS5YNzebjuqj5ObO0Jocp3+cpH+crotV1tWuA66n5xjBVF+qHjBrBFiOQ0BBgCDoKufD/TTeSMbJDX3laOIA3n5qBQmMAkFQIAgK9IWx6Ua5y9DvPiq06MEEZoAgDBCEAXoQVe5DeSscHT80c27Umj4qudiMAkNAEAgIAoFwkpHZutyqRdO6dM/UaEPu7j8qutAjAgNAEAAIAoBw1Jrlgg83xuK8R1wAc4EZIAgDBGEAZG+jZc0AtXdBbzn205txgQEgCAAEAQCUz2LXUd0c3K+YP1kCa70kWviOunOqw/6daxpePVPrJdZ6RbTw/fRYzzBgZw82Hn9jCw9D8RuHvyZSeJKe9XTbHWS04GQMl765C14jRUaYQrZF8ynZeKBJrmhGE4ZpwghNGBl4DeHuMq51Q38NygXljk3LkWGoMAIVHPnrjPqqFa8cK/fAEF8Mk4QRkjAyR7+N1lKhX4TBimmBMAwQRgDym6Q/Cs5D/zf7Gc8rDYbpwQg9cNQv+5tx/QpWcnLnWtZLYdBT22lzUQwRRiCCc3613JbJsdp19ORi6Kt2We06pq8Ps4QRluCkXy6vxd3UvNP0Ke8Oc4QRjuCEX+VWITv6Oi6oakOP0t0xBFVDz2GcMIITHPHHVTf0u7K6IrPrpicbwxzhhCNkBzXoq8uhdHbV6Fp3f9c11RwbvjeOicIJUTjZQff1CN2rQ98zfTqOWcIJS3DKH68W4XBdD19WcpqVZEv1eYcOx0zhhClkTXUWe4xK0j2DlQsYXpnikmOycEIWHPdHh4UwKMmbZOzs6tNn/tGz+BExXzjhC479dVgWbMLkSxiUwkmVJkrPgwvHcOEELjj9n7Wz8iapoRYcwaRjXDcYLZygBSf/cedWXxUuLsKgIC8O1eY+rE9MXYEpwwllcPoPybL+5RekuyNrB+HozgwxHCOGE8Tg7D9OHcvagax6oX8m6y165Xtm2WDSCEIasgFQmehZWu02urmjOc/zakZgyghCGZz/61GIl9Gn0d0h3Cej6YQOCp7zCgWmjSC0wYsAsy3kuN3QLUzVuKUQmDSCkEbQYYi8qoK/9TfnSI274XCgDq7j7qZZ2QhMG0Fog9cBdDed9fQo1PV0KHK8R2OmZ5lRYN4Iwhu8CqD3tO76apSVbg4mX+iY6XmlKjBvBOEN3ggALwMrubh+rUarMluJR+l49fGDeOFIROCNAEE2AgTZCJiNJnQzWu7r5KDWmwfWxe8SE0cQ4pC1gHZK7rmzbSpZ7+ulDvcmWhsYv05MHkHIg9cDokNHJc+huqY7qtVltXwCuWJ01zcHAuaPRfhjkeXoDqyvQfZcj512rtV9KfSdMNgxfa8W5pBFOIQXBmZnB0w2woe8Wd9+Uxdm79XCGLIIhvDagExPo8ZQH5WeH3dGOvHqBMZPiWFkERjhrYHIK0WnDrin8XEp9LvxcV3mLoxtamEYWQRGeG0gHpX0/Dnp6UruNmfFZFxGFqaRRWiE9wfk5aHm0M6eXNNzb1g7gEzVXBQDySJAwlsEqpKRy1ezB9SirqfyA8PDzMI8sgiP8DaBvLmT13k95Z9UI6cguwXz14l5ZBEe4X2CeHU9OnTijS5kR7PINBwdm8LIwjCyCIwsDKPV67g6hab7MPneh5WcsVEwhWxCIbzGAPkpTOvQGurpXvJcpT3jj9XGALIJgPASgwpuVPoWBgN5eRX6q+o0b3ojsTF/bMIfvMSgsoOZISE7kp4vk19MP1Mbw8cm8MEbDNHaIFobzAa00fRO7y7NmVItjhIEXmEQZIVBkBUGmGzo0VjmCnrbys3TlPaZipg8NiEP2WEo9NSo8Y/ELcpdzrsIPUkUk8cm5MFLDLOvKs7wPotLYFg1JI+NyWMT8uA1htkX3eRuC7LeLDqB/ZL5c2L42AQ+eJUhTqViZ0XfaB82UkL/TG9TdI/NdTGAbAIgGy9LJsfgTVRqrPIDzaAtLz4zv8HbGEIJAiG8RaG7Ed+Jj2r6a1wrJ2HQ0wSc1yQsaksSmEMJwiG8S6G1kucylVbp2//33aPnyGEKJQiF8BaFzDnRSRKKV/NmaE85nhMYQAkCoASJpA7Ay+h7bXAuuwXYHJgSL4HhkyDwwSsbUFmXN7pCZeku9PNqZweaZeNSRSsbFokxLRJj6l1U3wknRf0mW3v6+tc4jSoTw0/XwnmmRfJMi355ub4vb+7g7jDKnhmRx8J5pkXyTIvkmbMv92q2Xp/KrYbZOWnhINMiQaZFtxm6TZXXq4VqqybTWUPTWzjDtEiGadEM0y/KZH+21at6NRPzWTjAtEiAaZEAc/ZBSs8P/WJUmcw7MhYawsIZpkUyTIv+czYXRzKdk6NDGRyp1q5qm7rB+keS+df/ASpoeouhSQAA";
var lightConePromotionsData = "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";
var lightConeRanksData = "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";
var relicsMetadata = {
  source: `${source}relics.json`,
  set_id: "101",
  entries: [
    { id: "31011", set_id: "101", name: "\u8FC7\u5BA2\u7684\u9022\u6625\u6728\u7C2A", rarity: 2, type: "HEAD", max_level: 6, main_affix_id: "21", sub_affix_id: "2", icon: "icon/relic/101_0.png" },
    { id: "31012", set_id: "101", name: "\u8FC7\u5BA2\u7684\u6E38\u9F99\u81C2\u97B2", rarity: 2, type: "HAND", max_level: 6, main_affix_id: "22", sub_affix_id: "2", icon: "icon/relic/101_1.png" },
    { id: "31013", set_id: "101", name: "\u8FC7\u5BA2\u7684\u6B8B\u7EE3\u98CE\u8863", rarity: 2, type: "BODY", max_level: 6, main_affix_id: "23", sub_affix_id: "2", icon: "icon/relic/101_2.png" },
    { id: "31014", set_id: "101", name: "\u8FC7\u5BA2\u7684\u51A5\u9014\u6E38\u5C65", rarity: 2, type: "FOOT", max_level: 6, main_affix_id: "24", sub_affix_id: "2", icon: "icon/relic/101_3.png" },
    { id: "61011", set_id: "101", name: "\u8FC7\u5BA2\u7684\u9022\u6625\u6728\u7C2A", rarity: 5, type: "HEAD", max_level: 15, main_affix_id: "51", sub_affix_id: "5", icon: "icon/relic/101_0.png" },
    { id: "61012", set_id: "101", name: "\u8FC7\u5BA2\u7684\u6E38\u9F99\u81C2\u97B2", rarity: 5, type: "HAND", max_level: 15, main_affix_id: "52", sub_affix_id: "5", icon: "icon/relic/101_1.png" },
    { id: "61013", set_id: "101", name: "\u8FC7\u5BA2\u7684\u6B8B\u7EE3\u98CE\u8863", rarity: 5, type: "BODY", max_level: 15, main_affix_id: "53", sub_affix_id: "5", icon: "icon/relic/101_2.png" },
    { id: "61014", set_id: "101", name: "\u8FC7\u5BA2\u7684\u51A5\u9014\u6E38\u5C65", rarity: 5, type: "FOOT", max_level: 15, main_affix_id: "54", sub_affix_id: "5", icon: "icon/relic/101_3.png" }
  ]
};
var relicMainAffixes = "H4sIAAAAAAAEAO2ZXU/cOhCG/0uukRV7ZmyHu7bo6PSOHir1sgpsKFHpgnaDdFDFf28+KHZCZoPt9GZVrlhWPOPY884+yf7MlMxOf2b1Jjvtfj3Jyuvr+v9q3/2xf6d//bV/v3v7fnd3X+2ax/blv+dn1W1Ttn+8LPdVdookJFk8yfZNdZ+dShI2J3x6ejrJlHJFVFCRd01TXn0fF1JKkCnU70JGFLkyaigErhAEXs27zaba/Fc29d1LpVy0ZI32d6n2dV5oY7pKE5yaW3cYEiZIGCPPqutqe1XNMwFJe0ipWmiLxAkSx8gPu7qpr8rbDzdlS37fwfx15gZ8aG4U2RZKEyjNQ8/KH+W3V1CUaJS/UiRJLVRPoHpyPFV521/0q0UqKUebaQzKlmcmPDPmXTRl87A/391dlpf1bd08vuLOHlLfY+h6DP/22FKPXdxX1WYcYCm0VC+rk8OukttV+rurS7t6fvO470LGrBOtBX+d1uTFcnL/qXfMIjngQmo/chfN8RZS+/nmYbupdmFMO2HaMfNLvd2EAYsJsBgDPz2U2+bhRxhT5tMmzydb2Q7TelvuHkO4fbC0C5YOCtb7XVV+H6a4K/rWeb6QsovzWZpUiD4tRyBaDljoCFgIV8wIWIhW+Ajozg6cnEGanGkjDJiXKgqEye3gTODkDNLlDEBYbd1wl8ISDiMenJzBOnIW2XyHzpdDpox4kk6LO6SViKlyBlLmI2hurU6VM61U7je3ksZAgpwBSOPzpGw/+FeQs/lD6nvMyRmsI2dH3WMzcqYESndz9ZxcJ2ewjpwd9a4eljMwoMiHQq4xRc44YKyccbwUOeOY0XLGAVPkjGOmytk8tw+WkzP4A3LGzfNIObNaj+RME6h4OePymiBnHDJFzmZHQHd26OQM0+SsyAVI/XJQ0N0fP9s7OjnDdDk78IgOnZzhOnJGpIqR1hZAmDbiOWTKiNeF9FtGdZ9+qXIW2YeH5cyqAv1OVEWe4mbtjRYYf42EFlZws/kzGlrM77GwJgs/wqEiehXDfDDmhIea2qsZNtQDD6sv513hOsJ71LmdEV4QSrn7bynk87564z14vodsw1DNi0bg/I2MhlN6XEfpj7pvDis9FkaP1mlQvuGbEl7pOWCs0nO8FKXnmNFKzwFTlJ5jpir9PLcPljf+/4DSMxYQZ/Tc0+hIo+fimmD0HDLF6NmZSG7kU5rRS6mEdQuHQpCE4ZkuOaOndKMnLdA9j5aFMKSHPiT3iULrCD0zORPmO0NMGe9W++mAlpkq88wzoBSXlzlo/74ctLJvGO+sHnIpSXV5PinOOmkd6zza5poxTmz/1z1hFYMCkhMyWkfIjnZLD8sY99ArWsYivxVhZYzjpcgYx4yWMQ6YImMcM1XG5rl9qJyM0foyxo3xOBnjvtGLlLG4+5yI9Keo2Ez6259fk9aAfpYoAAA=";
var relicSubAffixes = "H4sIAAAAAAAEALWWzW6jMBRG34V1ZPn6F9i1zWKWVfsAlROcGdS0icCVpqry7nXKALGdUS2bZhHFRDrXXO538EdBivqjaJuitr9Whdrt2r+6P1+D89fX+unrb7B/H7vDUXfm3S5/3a/13ih7caN6XdRAEWflquiNPtoVEhXlw+rp9e2lqMlpNdS6QBIXeWOM2j67WIGkZBhGLkYlE5KDT6Yembrktd7p161OQjMPzfw+3DSNbh6UaQ8TGiMMtCRsZmMMkpQ+m3tsfq0hGXzh8cXVtvynwMQb+ASEj5ceXrr4x6PWjTclMzFodOnRSpd217Wm3ar93R9l93x7xl3uFlPhbBdIFey38ipU1yus1Yv6HVQgWFLhNIRXxK8A2E8N9npilHnr77vDRm3afWvegxuJea4QhBOulXnQfdubq+2KquLnFbzA3nZaPQ/dmmcooW+nMcFTdtM9RDCihIz1iJWSLbiAiMBOrIDZb0TaJi6hoShwooSiZjZDQlH8HAnNvIFPx6nNkhAiP6YhzrmzYahYsOMsDVEA7CSXlmWY3GwNxdkuV0NxVRbRUETfTmPQpohlaEgiXE23RhEt5RISijhkJTkogpuqICmY82KmjAcv5hwFxfBzFDTzBj6jwYSmKOiCGfCyFBSVqSwFMWDSkRyHMpDcAgqKebL5CoqqsoiCIvp2GsMwxSBdQZSiUTpFzRChVAY3luIggSY7nA9YACJ8ASVJKAacaKGIEGc4KIKeY6AJ929qFjgCXQCDs2aefb4/sGW5Z47MwJ/Cu6R5Ip5ntndiaixinW87Zj+f8pXyPgcSAAA=";
var relicSets = "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";
var starRailData = {
  source,
  characters: decode(characters),
  characterPromotions: decode(characterPromotionsData),
  characterSkills: decode(characterSkillsData),
  characterSkillTrees: decode(characterSkillTreesData),
  lightCones: decode(lightConesData),
  lightConePromotions: decode(lightConePromotionsData),
  lightConeRanks: decode(lightConeRanksData),
  relicMainAffixes: decode(relicMainAffixes),
  relicSubAffixes: decode(relicSubAffixes),
  relics: relicsMetadata,
  relicIcons: {
    "101": ["icon/relic/101_0.png", "icon/relic/101_1.png", "icon/relic/101_2.png", "icon/relic/101_3.png"]
  },
  relicSets: decode(relicSets)
};
function mergeStarRailData(resource, value) {
  const target = starRailData[resource];
  if (!target || typeof value !== "object" || value === null) return false;
  Object.assign(target, value);
  return true;
}
__name(mergeStarRailData, "mergeStarRailData");

// src/fribbels-data.ts
var fribbelsScoringSource = {
  repository: "https://github.com/fribbels/hsr-optimizer",
  commit: "a44c5d3ae2f1ed5907055a16c264bdc2392cf131",
  license: "MIT",
  extractedAt: "2026-10-24"
};
var fribbelsPartMainStats = {
  Head: ["HP"],
  Hands: ["ATK"],
  Body: ["HP_P", "ATK_P", "DEF_P", "CR", "CD", "OHB", "EHR"],
  Feet: ["HP_P", "ATK_P", "DEF_P", "SPD"],
  PlanarSphere: ["HP_P", "ATK_P", "DEF_P", "Physical_DMG", "Fire_DMG", "Ice_DMG", "Lightning_DMG", "Wind_DMG", "Quantum_DMG", "Imaginary_DMG"],
  LinkRope: ["HP_P", "ATK_P", "DEF_P", "BE", "ERR"]
};
var fribbelsScoring = {
  "1001": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["DEF_P", "EHR"],
      Feet: ["DEF_P", "SPD"],
      PlanarSphere: ["DEF_P"],
      LinkRope: ["DEF_P", "ERR"]
    }
  },
  "1002": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1003": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Fire_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1004": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Imaginary_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1004b1": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Imaginary_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1005": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0.5,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1005b1": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1006": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["Quantum_DMG", "ATK_P", "HP_P", "DEF_P"],
      LinkRope: ["ERR", "ATK_P", "BE"]
    }
  },
  "1006b1": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["Quantum_DMG", "ATK_P", "HP_P", "DEF_P"],
      LinkRope: ["ERR", "ATK_P", "BE"]
    }
  },
  "1008": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1009": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0.25,
      DEF_P: 0.25,
      HP: 0.25,
      HP_P: 0.25,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1013": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Ice_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1014": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1015": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 0,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1101": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1102": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1102b1": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1103": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1104": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0.75,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["DEF_P"],
      Feet: ["DEF_P", "SPD"],
      PlanarSphere: ["DEF_P"],
      LinkRope: ["DEF_P", "ERR"]
    }
  },
  "1105": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "OHB"],
      Feet: ["HP_P", "SPD"],
      PlanarSphere: ["HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1106": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0.25,
      DEF_P: 0.25,
      HP: 0.25,
      HP_P: 0.25,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["EHR", "HP_P", "DEF_P"],
      Feet: ["SPD"],
      PlanarSphere: ["HP_P", "DEF_P", "Ice_DMG"],
      LinkRope: ["ERR"]
    }
  },
  "1107": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1108": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ERR", "ATK_P", "BE"]
    }
  },
  "1109": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Fire_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1110": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "OHB"],
      Feet: ["HP_P", "SPD"],
      PlanarSphere: ["HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1111": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "BE"]
    }
  },
  "1112": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["Fire_DMG", "ATK_P"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1201": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1202": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0.25,
      DEF_P: 0.25,
      HP: 0.25,
      HP_P: 0.25,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "HP_P", "DEF_P", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["HP_P", "DEF_P", "ATK_P"],
      LinkRope: ["ERR"]
    }
  },
  "1203": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["OHB", "ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "HP_P", "DEF_P"],
      LinkRope: ["ERR"]
    }
  },
  "1204": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1205": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["Wind_DMG", "HP_P"],
      LinkRope: ["HP_P"]
    }
  },
  "1205b1": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "HP_P"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["Wind_DMG", "HP_P"],
      LinkRope: ["HP_P"]
    }
  },
  "1206": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "BE"]
    }
  },
  "1207": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["ATK_P", "Imaginary_DMG"],
      LinkRope: ["ERR", "ATK_P"]
    }
  },
  "1208": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0.75,
      DEF_P: 0.75,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "DEF_P"],
      Feet: ["HP_P", "DEF_P", "SPD"],
      PlanarSphere: ["HP_P", "DEF_P"],
      LinkRope: ["HP_P", "DEF_P", "ERR"]
    }
  },
  "1209": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Ice_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1210": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0.25,
      DEF_P: 0.25,
      HP: 0.25,
      HP_P: 0.25,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["ATK_P", "Fire_DMG"],
      LinkRope: ["ERR", "ATK_P"]
    }
  },
  "1211": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["OHB"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1212": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Ice_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1212b1": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "HP_P"],
      Feet: ["HP_P", "SPD"],
      PlanarSphere: ["HP_P", "Ice_DMG"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1213": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Imaginary_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1214": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["Quantum_DMG", "ATK_P"],
      LinkRope: ["ATK_P", "BE"]
    }
  },
  "1215": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0.25,
      DEF_P: 0.25,
      HP: 0.25,
      HP_P: 0.25,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1217": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "OHB"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1217b1": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "OHB"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1218": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["EHR"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1220": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1221": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1222": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 1
    },
    parts: {
      Body: ["ATK_P", "OHB", "DEF_P", "HP_P", "EHR"],
      Feet: ["SPD"],
      PlanarSphere: ["ATK_P", "DEF_P", "HP_P", "Fire_DMG"],
      LinkRope: ["BE", "ERR", "ATK_P"]
    }
  },
  "1223": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1224": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: [],
      LinkRope: ["BE"]
    }
  },
  "1225": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR", "BE"]
    }
  },
  "1301": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 1
    },
    parts: {
      Body: ["OHB"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR", "BE"]
    }
  },
  "1302": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["Physical_DMG", "ATK_P"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1303": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: [],
      PlanarSphere: [],
      LinkRope: ["ERR", "BE"]
    }
  },
  "1304": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0.25,
      CD: 0.25,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["DEF_P", "CR", "CD"],
      Feet: ["DEF_P", "SPD"],
      PlanarSphere: ["Imaginary_DMG", "DEF_P"],
      LinkRope: ["DEF_P", "ERR"]
    }
  },
  "1305": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Imaginary_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1306": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1306b1": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1307": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["Wind_DMG", "ATK_P"],
      LinkRope: ["ATK_P"]
    }
  },
  "1307b1": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["Wind_DMG", "ATK_P"],
      LinkRope: ["ATK_P"]
    }
  },
  "1308": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["Lightning_DMG", "ATK_P"],
      LinkRope: ["ATK_P"]
    }
  },
  "1309": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1310": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P"],
      LinkRope: ["BE"]
    }
  },
  "1310b1": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P"],
      LinkRope: ["BE"]
    }
  },
  "1312": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Ice_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1313": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD"],
      Feet: [],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1314": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1315": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0.25,
      CD: 0.25,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["BE"]
    }
  },
  "1317": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["BE"]
    }
  },
  "1321": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR", "BE"]
    }
  },
  "1401": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Ice_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1402": {
    stats: {
      ATK: 0.5,
      ATK_P: 0.5,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1403": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "HP_P"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["Quantum_DMG", "HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1404": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "HP_P"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["Imaginary_DMG", "HP_P"],
      LinkRope: ["HP_P"]
    }
  },
  "1405": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1406": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0.5,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1407": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 0,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "HP_P"],
      Feet: ["HP_P"],
      PlanarSphere: ["HP_P", "Quantum_DMG"],
      LinkRope: ["HP_P"]
    }
  },
  "1408": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P"]
    }
  },
  "1409": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["CD", "HP_P", "OHB"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P", "Wind_DMG"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1410": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 1,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["Physical_DMG", "ATK_P"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1412": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0.75,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["ATK_P"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P", "Wind_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1413": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "HP_P"],
      Feet: ["HP_P", "SPD"],
      PlanarSphere: ["HP_P", "Ice_DMG"],
      LinkRope: ["HP_P"]
    }
  },
  "1414": {
    stats: {
      ATK: 1,
      ATK_P: 1,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["ATK_P", "EHR"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["ATK_P"],
      LinkRope: ["ERR", "ATK_P"]
    }
  },
  "1415": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["HP_P", "CR", "CD"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P", "Ice_DMG"],
      LinkRope: ["HP_P"]
    }
  },
  "1501": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["SPD", "ATK_P"],
      PlanarSphere: ["Fire_DMG", "ATK_P"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1502": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "1503": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["DEF_P", "OHB"],
      Feet: ["SPD", "DEF_P"],
      PlanarSphere: ["DEF_P"],
      LinkRope: ["ERR", "DEF_P"]
    }
  },
  "1504": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 0,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1505": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 0,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: [],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1506": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: []
    }
  },
  "1507": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CD", "CR", "HP_P"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["Fire_DMG", "HP_P"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1508": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Quantum_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1509": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Lightning_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1510": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "ATK_P"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Fire_DMG"],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "1511": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: []
    }
  },
  "1512": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 1,
      HP_P: 1,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "HP_P"],
      Feet: ["SPD", "HP_P"],
      PlanarSphere: ["HP_P", "Wind_DMG"],
      LinkRope: ["HP_P", "ERR"]
    }
  },
  "1513": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "8001": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "BE"]
    }
  },
  "8002": {
    stats: {
      ATK: 0.75,
      ATK_P: 0.75,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 1,
      CD: 1,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: ["CR", "CD", "EHR"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: ["ATK_P", "Physical_DMG"],
      LinkRope: ["ATK_P", "BE"]
    }
  },
  "8003": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0.75,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["DEF_P"],
      Feet: ["DEF_P", "SPD"],
      PlanarSphere: ["DEF_P"],
      LinkRope: ["DEF_P", "ERR"]
    }
  },
  "8004": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 1,
      DEF_P: 1,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0.75,
      RES: 0.5,
      BE: 0
    },
    parts: {
      Body: ["DEF_P"],
      Feet: ["DEF_P", "SPD"],
      PlanarSphere: ["DEF_P"],
      LinkRope: ["DEF_P", "ERR"]
    }
  },
  "8005": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["BE", "ERR"]
    }
  },
  "8006": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 0,
      EHR: 0,
      RES: 0.25,
      BE: 1
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["BE", "ERR"]
    }
  },
  "8007": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD", "OHB"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "8008": {
    stats: {
      ATK: 0,
      ATK_P: 0,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0,
      CD: 1,
      EHR: 0,
      RES: 0.25,
      BE: 0
    },
    parts: {
      Body: ["CD", "OHB"],
      Feet: ["ATK_P", "SPD"],
      PlanarSphere: [],
      LinkRope: ["ATK_P", "ERR"]
    }
  },
  "8009": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0.25,
      CD: 0.25,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  },
  "8010": {
    stats: {
      ATK: 0.25,
      ATK_P: 0.25,
      DEF: 0,
      DEF_P: 0,
      HP: 0,
      HP_P: 0,
      SPD: 1,
      CR: 0.25,
      CD: 0.25,
      EHR: 0,
      RES: 0,
      BE: 0
    },
    parts: {
      Body: [],
      Feet: ["SPD"],
      PlanarSphere: [],
      LinkRope: ["ERR"]
    }
  }
};

// src/fribbels-score.ts
var fribbelsScoreMetadata = Object.freeze({
  source: fribbelsScoringSource.repository,
  commit: fribbelsScoringSource.commit,
  license: fribbelsScoringSource.license,
  date: fribbelsScoringSource.extractedAt
});
var SLOT_PARTS = {
  HEAD: "Head",
  HAND: "Hands",
  BODY: "Body",
  FOOT: "Feet",
  NECK: "LinkRope",
  OBJECT: "PlanarSphere"
};
var PROPERTY_STATS = {
  HPDelta: "HP",
  AttackDelta: "ATK",
  DefenceDelta: "DEF",
  HPAddedRatio: "HP_P",
  AttackAddedRatio: "ATK_P",
  DefenceAddedRatio: "DEF_P",
  SpeedDelta: "SPD",
  CriticalChanceBase: "CR",
  CriticalDamageBase: "CD",
  StatusProbabilityBase: "EHR",
  StatusResistanceBase: "RES",
  BreakDamageAddedRatioBase: "BE",
  EnergyRecoveryRateBase: "ERR",
  SPRatioBase: "ERR",
  HealRatioBase: "OHB",
  PhysicalAddedRatio: "Physical_DMG",
  FireAddedRatio: "Fire_DMG",
  IceAddedRatio: "Ice_DMG",
  ThunderAddedRatio: "Lightning_DMG",
  WindAddedRatio: "Wind_DMG",
  QuantumAddedRatio: "Quantum_DMG",
  ImaginaryAddedRatio: "Imaginary_DMG",
  ElationDamageAddedRatioBase: "Elation"
};
var SUBSTATS = ["ATK_P", "ATK", "HP_P", "HP", "DEF_P", "DEF", "SPD", "CR", "CD", "EHR", "RES", "BE"];
var ALL_STATS = [
  "ATK_P",
  "ATK",
  "BE",
  "CD",
  "CR",
  "DEF_P",
  "DEF",
  "EHR",
  "ERR",
  "Fire_DMG",
  "HP_P",
  "HP",
  "Ice_DMG",
  "Imaginary_DMG",
  "Lightning_DMG",
  "OHB",
  "Physical_DMG",
  "Quantum_DMG",
  "RES",
  "SPD_P",
  "SPD",
  "Wind_DMG"
];
var RATING_TIERS = [
  [0, "F"],
  [5, "F+"],
  [10, "D"],
  [15, "D+"],
  [20, "C"],
  [25, "C+"],
  [30, "B"],
  [35, "B+"],
  [40, "A"],
  [45, "A+"],
  [50, "S"],
  [55, "S+"],
  [60, "SS"],
  [65, "SS+"],
  [70, "SSS"],
  [75, "SSS+"],
  [80, "WTF"],
  [85, "WTF+"],
  [90, "AEON"]
];
var tiers = {};
for (const affix2 of Object.values(starRailData.relicSubAffixes["5"].affixes)) {
  tiers[affix2.property] = { low: affix2.base, high: affix2.base + affix2.step * (affix2.step_num ?? 2) };
}
var unsupported = /* @__PURE__ */ __name((characterId) => ({
  status: "unsupported",
  characterId,
  reason: `\u6765\u6E90\u4E2D\u7F3A\u5C11\u89D2\u8272 ${characterId} \u7684\u8BC4\u5206\u6743\u91CD\uFF0C\u4E0D\u63D0\u4F9B\u63A8\u6D4B\u6570\u503C`,
  source: fribbelsScoringSource.repository,
  date: fribbelsScoringSource.extractedAt
}), "unsupported");
var incomplete = /* @__PURE__ */ __name((reason, characterId) => ({
  status: "incomplete",
  characterId,
  reason,
  source: fribbelsScoringSource.repository,
  date: fribbelsScoringSource.extractedAt
}), "incomplete");
function clampWeight(value) {
  return Math.min(1, Math.max(0, value ?? 0));
}
__name(clampWeight, "clampWeight");
function prepareWeights(characterId) {
  const meta = fribbelsScoring[characterId];
  if (!meta) return void 0;
  const weights = {};
  for (const stat of SUBSTATS) weights[stat] = clampWeight(meta.stats[stat]);
  weights.HP = weights.HP_P * 0.4;
  weights.ATK = weights.ATK_P * 0.4;
  weights.DEF = weights.DEF_P * 0.4;
  return weights;
}
__name(prepareWeights, "prepareWeights");
function hasMainStat(part) {
  return part === "Body" || part === "Feet" || part === "PlanarSphere" || part === "LinkRope";
}
__name(hasMainStat, "hasMainStat");
function mainStatWeight(part, mainStat, weights, parts) {
  if (!hasMainStat(part)) return 0;
  if ((parts[part] || []).includes(mainStat)) return 1;
  return weights[mainStat] ?? 0;
}
__name(mainStatWeight, "mainStatWeight");
function resolveOptimalMainstat(part, mainStat, weights, parts) {
  const ideal = parts[part] || [];
  if (ideal.includes(mainStat) || weights[mainStat] === 1 || !hasMainStat(part)) return mainStat;
  const entries = ALL_STATS.map((stat) => [stat, ideal.includes(stat) || weights[stat] === 1 ? 1 : weights[stat] ?? 0]).sort((a, b) => b[1] - a[1]);
  const possible = fribbelsPartMainStats[part] || [];
  const index = entries.findIndex(([name2]) => possible.includes(name2));
  if (index < 0) return mainStat;
  const topWeight = entries[index][1];
  let resolved = entries[index][0];
  let isIdeal = false;
  let isSubstat = true;
  for (let cursor = index; cursor < entries.length; cursor++) {
    const [name2, weight] = entries[cursor];
    if (weight !== topWeight) break;
    if (!possible.includes(name2)) continue;
    const nextIdeal = ideal.includes(name2);
    const nextSubstat = SUBSTATS.includes(name2);
    if (isIdeal && !nextIdeal) continue;
    if (!isSubstat && nextSubstat) continue;
    if (isIdeal === nextIdeal && isSubstat === nextSubstat) continue;
    resolved = name2;
    isIdeal = nextIdeal;
    isSubstat = nextSubstat;
  }
  return resolved;
}
__name(resolveOptimalMainstat, "resolveOptimalMainstat");
function optimalScore(part, mainStat, weights, parts) {
  const sorted = SUBSTATS.map((stat) => [stat, weights[stat] || 0]).sort((a, b) => b[1] - a[1]);
  const high = /* @__PURE__ */ __name((stat) => (weights[stat] || 0) * 6.48, "high");
  const none = sorted[0][1] === 0;
  if (none) return Infinity;
  const single = sorted[1][1] === 0;
  const normal = sorted[2][1] > 0;
  const pair = /* @__PURE__ */ __name((first, second) => sorted[0][0] === first && sorted[1][0] === second || sorted[0][0] === second && sorted[1][0] === first, "pair");
  if (single) {
    const stat = sorted[0][0];
    return stat === mainStat ? Infinity : 6 * high(stat);
  }
  if (!normal && (pair("HP_P", "HP") || pair("ATK_P", "ATK") || pair("DEF_P", "DEF"))) {
    const stat1 = sorted[0][0];
    const stat2 = sorted[1][0];
    const blocked1 = stat1 === mainStat;
    const blocked2 = stat2 === mainStat;
    if (blocked1 && blocked2) return Infinity;
    if (blocked1) return 6 * high(stat2);
    if (blocked2) return 6 * high(stat1);
    return 6 * high(stat1) + high(stat2);
  }
  const resolved = resolveOptimalMainstat(part, mainStat, weights, parts);
  const effective = sorted.filter(([stat]) => stat !== resolved).map(([stat]) => high(stat)).sort((a, b) => b - a);
  return 6 * (effective[0] || 0) + (effective[1] || 0) + (effective[2] || 0) + (effective[3] || 0);
}
__name(optimalScore, "optimalScore");
function toGrade(score, rarityOk, part, mainOk) {
  if (!rarityOk || score <= 0) return "?";
  if (part !== "Head" && part !== "Hands" && !mainOk) return "?";
  for (let index = RATING_TIERS.length - 1; index >= 0; index--) {
    if (score >= RATING_TIERS[index][0]) {
      return RATING_TIERS[index][1] === "AEON" ? "WTF+" : RATING_TIERS[index][1];
    }
  }
  return "?";
}
__name(toGrade, "toGrade");
var truncateTenth = /* @__PURE__ */ __name((value) => Math.trunc(value * 10) / 10, "truncateTenth");
function scoreFribbelsRelic(characterId, relic) {
  const prepared = prepareWeights(characterId);
  if (!prepared) return unsupported(characterId);
  const meta = fribbelsScoring[characterId];
  if (relic.rarity !== 5) return incomplete("\u8BC4\u5206\u6743\u91CD\u4E0E\u8BCD\u6761\u6863\u4F4D\u4EC5\u8986\u76D6\u4E94\u661F\u9057\u5668", characterId);
  const part = SLOT_PARTS[relic.slot];
  if (!part) return incomplete("\u672A\u77E5\u9057\u5668\u90E8\u4F4D", characterId);
  const mainStat = PROPERTY_STATS[relic.main];
  if (!mainStat) return incomplete("\u65E0\u6CD5\u8BC6\u522B\u4E3B\u8BCD\u6761\u7C7B\u578B", characterId);
  let raw = 0;
  let effectiveRolls = 0;
  for (const sub of relic.subStats) {
    const stat = PROPERTY_STATS[sub.type];
    const tier = tiers[sub.type];
    if (!stat || !tier) return incomplete(`\u65E0\u6CD5\u8BC6\u522B\u526F\u8BCD\u6761\u7C7B\u578B ${sub.type}`, characterId);
    if (!Number.isFinite(sub.value)) return incomplete("\u526F\u8BCD\u6761\u6570\u503C\u65E0\u6548", characterId);
    const weight = prepared[stat] || 0;
    raw += sub.value * weight * (6.48 / tier.high);
    effectiveRolls += sub.value / tier.low * weight;
  }
  const ideal = optimalScore(part, mainStat, prepared, meta.parts);
  const score = ideal === Infinity ? 0 : truncateTenth(Math.round(raw / ideal * 100 * 1e10) / 1e10);
  const mainOk = !hasMainStat(part) || mainStatWeight(part, mainStat, prepared, meta.parts) > 0;
  return {
    status: "supported",
    characterId,
    effectiveRolls,
    score,
    grade: toGrade(score, true, part, mainOk),
    mainOk
  };
}
__name(scoreFribbelsRelic, "scoreFribbelsRelic");
function scoreFribbelsSet(characterId, relics) {
  const prepared = prepareWeights(characterId);
  if (!prepared) return unsupported(characterId);
  if (relics.length !== 6) return incomplete(`\u6574\u5957\u8BC4\u5206\u9700\u8981\u516D\u4EF6\u9057\u5668\uFF0C\u5F53\u524D ${relics.length} \u4EF6`, characterId);
  if (new Set(relics.map((relic) => relic.slot)).size !== 6) return incomplete("\u9057\u5668\u90E8\u4F4D\u4E0D\u80FD\u91CD\u590D", characterId);
  const scores = [];
  for (const relic of relics) {
    const result = scoreFribbelsRelic(characterId, relic);
    if (result.status !== "supported") return result.status === "incomplete" ? result : unsupported(characterId);
    scores.push(result);
  }
  const averageScore = truncateTenth(scores.reduce((sum, score) => sum + score.score, 0) / scores.length);
  const part = "Body";
  return {
    status: "supported",
    characterId,
    relics: scores,
    averageScore,
    averageGrade: toGrade(averageScore, true, part, true),
    effectiveRolls: scores.reduce((sum, score) => sum + score.effectiveRolls, 0),
    source: fribbelsScoringSource.repository,
    date: fribbelsScoringSource.extractedAt
  };
}
__name(scoreFribbelsSet, "scoreFribbelsSet");
function fribbelsSlotOf(slot) {
  return { \u5934\u90E8: "HEAD", \u624B\u90E8: "HAND", \u8EAF\u5E72: "BODY", \u811A\u90E8: "FOOT", \u4F4D\u9762\u7403: "OBJECT", \u8FDE\u7ED3\u7EF3: "NECK" }[slot];
}
__name(fribbelsSlotOf, "fribbelsSlotOf");
function parseRemoteScoring(source2) {
  const statsBlock = source2.match(/stats\s*:\s*\{([\s\S]*?)\n\s*\},\s*parts\s*:/)?.[1];
  const partsBlock = source2.match(/parts\s*:\s*\{([\s\S]*?)\n\s*\},\s*\}\)/)?.[1];
  if (!statsBlock || !partsBlock) return void 0;
  const stats = {};
  for (const match of statsBlock.matchAll(/Stats\.([A-Za-z0-9_]+)\s*\]\s*:\s*(-?\d+(?:\.\d+)?)/g)) stats[match[1]] = Number(match[2]);
  const parts = {};
  for (const match of partsBlock.matchAll(/Parts\.([A-Za-z0-9_]+)\s*\]\s*:\s*\[([^\]]*)\]/g)) {
    parts[match[1]] = [...match[2].matchAll(/Stats\.([A-Za-z0-9_]+)/g)].map((item) => item[1]);
  }
  if (!Object.keys(stats).length || !Object.keys(parts).length) return void 0;
  return { stats, parts };
}
__name(parseRemoteScoring, "parseRemoteScoring");
async function ensureFribbelsScoring(characterId, cache) {
  if (fribbelsScoring[characterId] || !cache) return !!fribbelsScoring[characterId];
  const numericId = Number(characterId);
  const group = Number.isFinite(numericId) ? String(Math.floor(numericId / 100) * 100) : characterId.slice(0, -1);
  const id = `fribbels:scoring:${characterId}`;
  const value = await cache.getOrFetch(id, async () => {
    const api = `https://api.github.com/repos/fribbels/hsr-optimizer/contents/src/lib/conditionals/character/${group}`;
    const listingResponse = await fetch(api, { headers: { accept: "application/vnd.github+json", "user-agent": "koishi-miyoushe-sign" }, signal: AbortSignal.timeout(15e3) });
    if (!listingResponse.ok) throw new Error(`HTTP ${listingResponse.status}`);
    const listing = await listingResponse.json();
    if (!Array.isArray(listing)) throw new Error("invalid character directory");
    const file = listing.find((item) => item && typeof item === "object" && "name" in item && String(item.name).match(/\.ts$/i));
    if (!file?.download_url) throw new Error("character scoring source not found");
    const response = await fetch(file.download_url, { headers: { accept: "text/plain" }, signal: AbortSignal.timeout(15e3) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseRemoteScoring(await response.text());
    if (!parsed) throw new Error("invalid scoring source");
    return { source: file.download_url, version: "main", data: parsed };
  });
  if (!value || typeof value !== "object") return false;
  fribbelsScoring[characterId] = value;
  return true;
}
__name(ensureFribbelsScoring, "ensureFribbelsScoring");

// src/records.ts
var recordTypes = {
  sr: { panel: "avatar/info", roles: "avatar/basic", overview: "index", forgotten: "challenge", fiction: "challenge_story", apocalypse: "challenge_boss", anomaly: "challenge_peak" },
  gs: { panel: "character/detail", roles: "character/list", overview: "index", abyss: "spiralAbyss", theater: "role_combat", peril: "hard_challenge" },
  zzz: { roles: "avatar/basic", overview: "index" }
};
var mihomoPropertyNames = {
  hp: "\u751F\u547D\u503C",
  atk: "\u653B\u51FB\u529B",
  def: "\u9632\u5FA1\u529B",
  spd: "\u901F\u5EA6",
  crit_rate: "\u66B4\u51FB\u7387",
  crit_dmg: "\u66B4\u51FB\u4F24\u5BB3",
  break_dmg: "\u51FB\u7834\u7279\u653B",
  effect_hit: "\u6548\u679C\u547D\u4E2D",
  effect_res: "\u6548\u679C\u62B5\u6297",
  energy_regen_rate: "\u80FD\u91CF\u6062\u590D\u6548\u7387",
  healing_boost: "\u6CBB\u7597\u91CF\u52A0\u6210",
  physical_dmg_boost: "\u7269\u7406\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  fire_dmg_boost: "\u706B\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  ice_dmg_boost: "\u51B0\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  lightning_dmg_boost: "\u96F7\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  wind_dmg_boost: "\u98CE\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  quantum_dmg_boost: "\u91CF\u5B50\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  imaginary_dmg_boost: "\u865A\u6570\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8"
};
var mihomoTraceIcons = {
  "150301": "icon/skill/1503_basic_atk.png",
  "150302": "icon/skill/1503_skill.png",
  "150303": "icon/skill/1503_ultimate.png",
  "150304": "icon/skill/1503_talent.png",
  "150307": "icon/skill/1503_technique.png",
  "1503001": "icon/skill/1503_basic_atk.png",
  "1503002": "icon/skill/1503_skill.png",
  "1503003": "icon/skill/1503_ultimate.png",
  "1503004": "icon/skill/1503_talent.png",
  "1503007": "icon/skill/1503_technique.png",
  "1503008": "icon/skill/1503_elation.png",
  "1503101": "icon/skill/1503_skilltree1.png",
  "1503102": "icon/skill/1503_skilltree2.png",
  "1503103": "icon/skill/1503_skilltree3.png",
  "1503201": "icon/property/IconDefence.png",
  "1503202": "icon/property/IconSpeed.png",
  "1503203": "icon/property/IconStatusResistance.png",
  "1503204": "icon/property/IconJoy.png",
  "1503205": "icon/property/IconDefence.png",
  "1503206": "icon/property/IconSpeed.png",
  "1503207": "icon/property/IconStatusResistance.png",
  "1503208": "icon/property/IconJoy.png",
  "1503209": "icon/property/IconSpeed.png",
  "1503210": "icon/property/IconDefence.png",
  "150308": "icon/skill/1503_elation.png"
};
var propertyLabels = {
  HPDelta: "\u751F\u547D\u503C",
  AttackDelta: "\u653B\u51FB\u529B",
  DefenceDelta: "\u9632\u5FA1\u529B",
  SpeedDelta: "\u901F\u5EA6",
  HPAddedRatio: "\u751F\u547D\u503C\u767E\u5206\u6BD4",
  AttackAddedRatio: "\u653B\u51FB\u529B\u767E\u5206\u6BD4",
  DefenceAddedRatio: "\u9632\u5FA1\u529B\u767E\u5206\u6BD4",
  CriticalChanceBase: "\u66B4\u51FB\u7387",
  CriticalDamageBase: "\u66B4\u51FB\u4F24\u5BB3",
  StatusProbabilityBase: "\u6548\u679C\u547D\u4E2D",
  StatusResistanceBase: "\u6548\u679C\u62B5\u6297",
  BreakDamageAddedRatioBase: "\u51FB\u7834\u7279\u653B",
  HealRatioBase: "\u6CBB\u7597\u91CF\u52A0\u6210",
  EnergyRecoveryRateBase: "\u80FD\u91CF\u6062\u590D\u6548\u7387",
  SPRatioBase: "\u80FD\u91CF\u6062\u590D\u6548\u7387",
  PhysicalAddedRatio: "\u7269\u7406\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  FireAddedRatio: "\u706B\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  IceAddedRatio: "\u51B0\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  ThunderAddedRatio: "\u96F7\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  WindAddedRatio: "\u98CE\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  QuantumAddedRatio: "\u91CF\u5B50\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  ImaginaryAddedRatio: "\u865A\u6570\u5C5E\u6027\u4F24\u5BB3\u63D0\u9AD8",
  ElationDamageAddedRatioBase: "\u6B22\u6109\u5EA6"
};
var elementDamageTypes = {
  Physical: "PhysicalAddedRatio",
  Fire: "FireAddedRatio",
  Ice: "IceAddedRatio",
  Lightning: "ThunderAddedRatio",
  Thunder: "ThunderAddedRatio",
  Wind: "WindAddedRatio",
  Quantum: "QuantumAddedRatio",
  Imaginary: "ImaginaryAddedRatio"
};
var characterProfiles = starRailData.characters;
var characterPromotions = starRailData.characterPromotions;
var characterTrees = starRailData.characterSkillTrees;
var lightConePromotions = starRailData.lightConePromotions;
var lightConeRanks = starRailData.lightConeRanks;
var relicMainAffixes2 = starRailData.relicMainAffixes;
var relicSubAffixes2 = starRailData.relicSubAffixes;
var relicSets2 = starRailData.relicSets;
function parseStatValue(type, value) {
  const normalized = value.replace(/,/g, "").replace(/％/g, "%").trim();
  if (!normalized) return void 0;
  const amount = Number(normalized.replace(/%$/, ""));
  if (!Number.isFinite(amount)) return void 0;
  return type && /Ratio|Base$/.test(type) && !/Delta$/.test(type) && normalized.endsWith("%") ? amount / 100 : amount;
}
__name(parseStatValue, "parseStatValue");
function formatStatValue(type, value) {
  const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type);
  return ratio ? `${(value * 100).toFixed(1)}%` : String(Number(value.toFixed(2)));
}
__name(formatStatValue, "formatStatValue");
function promotionFor(level) {
  return Math.max(0, Math.min(6, Math.ceil(level / 10) - 2));
}
__name(promotionFor, "promotionFor");
function promotionValue(values, level, promotion) {
  const value = values[Math.max(0, Math.min(values.length - 1, promotion))];
  const offset = Math.max(0, level - 1);
  return {
    hp: value.hp.base + value.hp.step * offset,
    atk: value.atk.base + value.atk.step * offset,
    def: value.def.base + value.def.step * offset,
    spd: (value.spd?.base || 0) + (value.spd?.step || 0) * offset
  };
}
__name(promotionValue, "promotionValue");
function calculateStats(character) {
  const id = character.id;
  const lightCone = character.lightCone;
  const lightConeId = lightCone?.id;
  if (!id || !lightConeId) return [];
  const promotions = characterPromotions[id]?.values;
  const conePromotions = lightConePromotions[lightConeId]?.values;
  const coneRanks = lightConeRanks[lightConeId]?.properties;
  if (!promotions?.length || !conePromotions?.length || !coneRanks?.length) return [];
  const level = Number(character.level);
  if (!Number.isInteger(level) || level < 1 || level > 80) return [];
  if (character.relics.length !== 6 || new Set(character.relics.map((relic) => relic.slot)).size !== 6 || character.relics.some((relic) => !relic.mainComplete || !relic.subComplete)) return [];
  const charPromotion = Math.max(0, Math.min(6, Number(character.promotion ?? promotionFor(level))));
  const coneLevel = Number(lightCone.level);
  if (!Number.isInteger(coneLevel) || coneLevel < 1 || coneLevel > 80) return [];
  const conePromotion = Math.max(0, Math.min(6, Number(lightCone.promotion ?? promotionFor(coneLevel))));
  const superimposition = Number(lightCone.rank || 1);
  if (![charPromotion, conePromotion, superimposition].every(Number.isInteger) || superimposition < 1 || superimposition > 5) return [];
  const charBase = promotionValue(promotions, level, charPromotion);
  const coneBase = promotionValue(conePromotions, coneLevel, conePromotion);
  const base = {
    HPDelta: charBase.hp + coneBase.hp,
    AttackDelta: charBase.atk + coneBase.atk,
    DefenceDelta: charBase.def + coneBase.def,
    SpeedDelta: charBase.spd,
    CriticalChanceBase: 0.05,
    CriticalDamageBase: 0.5
  };
  const additions = {};
  const add = /* @__PURE__ */ __name((type, value) => {
    additions[type] = (additions[type] || 0) + value;
  }, "add");
  for (const trace of character.traces) {
    if (!trace.active || !trace.id) continue;
    const tree = characterTrees[trace.id];
    for (const property of tree?.levels?.flatMap((node) => node.properties || []) || []) {
      if (property.type && property.value !== void 0) add(property.type, property.value);
    }
  }
  for (const relic of character.relics) {
    if (relic.mainFinalPropertyType && relic.mainValue !== void 0) add(relic.mainFinalPropertyType, relic.mainValue);
    for (const property of relic.subProperties || []) if (property.exact && property.value !== void 0) add(property.type, property.value);
  }
  const setCounts = /* @__PURE__ */ new Map();
  for (const relic of character.relics) {
    if (relic.setId) setCounts.set(relic.setId, (setCounts.get(relic.setId) || 0) + 1);
  }
  for (const [setId, count] of setCounts) {
    const set = relicSets2[setId];
    for (const [index, properties] of (set?.properties || []).entries()) {
      if (count < (index + 1) * 2) continue;
      for (const property of properties || []) add(property.type, property.value);
    }
  }
  const hpBase = base.HPDelta;
  const attackBase = base.AttackDelta;
  const defenceBase = base.DefenceDelta;
  for (const property of coneRanks[superimposition - 1] || []) add(property.type, property.value);
  const totals = {};
  for (const type of Object.keys(propertyLabels)) totals[type] = additions[type] || 0;
  totals.EnergyRecoveryRateBase = 1 + (additions.SPRatioBase || 0) + (additions.EnergyRecoveryRateBase || 0);
  for (const key of ["HPDelta", "AttackDelta", "DefenceDelta"]) {
    const prefix = key === "HPDelta" ? "HP" : key === "AttackDelta" ? "Attack" : "Defence";
    const white = key === "HPDelta" ? hpBase : key === "AttackDelta" ? attackBase : defenceBase;
    totals[key] = white * (1 + (additions[`${prefix}AddedRatio`] || 0)) + (additions[key] || 0);
  }
  totals.SpeedDelta = (base.SpeedDelta + (additions.SpeedDelta || 0)) * (1 + (additions.SpeedAddedRatio || 0));
  totals.CriticalChanceBase = base.CriticalChanceBase + (additions.CriticalChanceBase || 0);
  totals.CriticalDamageBase = base.CriticalDamageBase + (additions.CriticalDamageBase || 0);
  const profile = characterProfiles[id];
  const elementType = elementDamageTypes[profile?.element || ""];
  const shown = [
    "HPDelta",
    "AttackDelta",
    "DefenceDelta",
    "SpeedDelta",
    "CriticalChanceBase",
    "CriticalDamageBase",
    "StatusProbabilityBase",
    "StatusResistanceBase",
    "BreakDamageAddedRatioBase",
    "EnergyRecoveryRateBase",
    elementType,
    "HealRatioBase"
  ].filter((type) => !!type);
  if (profile?.path === "Elation" || totals.ElationDamageAddedRatioBase) shown.push("ElationDamageAddedRatioBase");
  return shown.map((type) => {
    const value = totals[type] || 0;
    const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type);
    const display = ratio ? `${(Math.floor(value * 1e3 + 1e-9) / 10).toFixed(1)}%` : type === "SpeedDelta" ? String(Math.round(value)) : String(Math.floor(value + 1e-9));
    return { name: propertyLabels[type] || type, value: display };
  });
}
__name(calculateStats, "calculateStats");
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function roleList(data) {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  for (const key of ["list", "avatar_list", "avatars", "characters"]) {
    if (Array.isArray(data[key])) return data[key].filter(isRecord);
  }
  return [];
}
__name(roleList, "roleList");
function findRole(data, name2) {
  const target = name2.trim().toLowerCase();
  return roleList(data).find((role) => [role.name, role.avatar_name, role.id].some((value) => String(value ?? "").toLowerCase() === target));
}
__name(findRole, "findRole");
function text(value) {
  if (typeof value === "string" && value.length <= 80) return value.replace(/[\r\n\x00-\x1f]/g, " ").trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
}
__name(text, "text");
function valueOf(value, keys) {
  if (isRecord(value)) {
    for (const key of keys) {
      const result = text(value[key]);
      if (result) return result;
    }
  }
  return text(value);
}
__name(valueOf, "valueOf");
function imageOf(value) {
  if (!isRecord(value)) return void 0;
  for (const key of ["icon", "icon_url", "preview", "portrait", "image", "url"]) {
    const result = assetUrl(value[key]);
    if (result) return result;
  }
}
__name(imageOf, "imageOf");
var starRailAssetBase = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
function assetUrl(value) {
  const path = typeof value === "string" ? value.trim() : void 0;
  if (!path) return void 0;
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:\/\//i, "https://");
  if (/^(icon|image)\//.test(path)) return `${starRailAssetBase}${path.split("/").map(encodeURIComponent).join("/")}`;
}
__name(assetUrl, "assetUrl");
function staticIcon(path) {
  return assetUrl(path);
}
__name(staticIcon, "staticIcon");
function starRailIcon(kind, id, relicPosition, relicSetId) {
  if (kind === "character" && id) return staticIcon(`icon/character/${id}.png`);
  if (kind === "light_cone" && id) return staticIcon(`icon/light_cone/${id}.png`);
  if (kind === "skill" && id) {
    const skill = starRailData.characterSkills[id];
    return staticIcon(skill?.icon || mihomoTraceIcons[id] || "");
  }
  if (kind === "relic" && relicSetId && relicPosition) return staticIcon(`icon/relic/${relicSetId}_${relicPosition > 4 ? relicPosition - 5 : relicPosition - 1}.png`);
}
__name(starRailIcon, "starRailIcon");
function mihomoImage(value) {
  return imageOf(value) || (isRecord(value) ? assetUrl(value.icon) : void 0);
}
__name(mihomoImage, "mihomoImage");
function affix(value) {
  if (!isRecord(value)) return void 0;
  const name2 = valueOf(value, ["name", "type", "property", "property_name", "key"]);
  const result = valueOf(value, ["display_value", "display", "value", "val", "content"]);
  if (!name2 && !result) return void 0;
  return {
    name: name2 || "\u672A\u77E5\u5C5E\u6027",
    value: result,
    count: valueOf(value, ["count", "times", "add_count"])
  };
}
__name(affix, "affix");
function propertyName(value, propertyInfo) {
  const type = valueOf(value, ["property_type", "type", "key"]);
  if (!type || !isRecord(propertyInfo)) return type;
  const info = propertyInfo[type];
  if (isRecord(info)) return valueOf(info, ["property_name", "name", "property_name_filter", "filter_name"]) || type;
  return text(info) || type;
}
__name(propertyName, "propertyName");
function relicAffix(value, propertyInfo) {
  if (!isRecord(value)) return void 0;
  const name2 = valueOf(value, ["name"]) || propertyName(value, propertyInfo);
  const result = valueOf(value, ["display_value", "display", "value", "val", "content"]);
  if (!name2 && !result) return void 0;
  return {
    name: name2 || "\u672A\u77E5\u5C5E\u6027",
    value: result,
    count: valueOf(value, ["count", "times", "add_count"])
  };
}
__name(relicAffix, "relicAffix");
function relicAffixList(value, propertyInfo) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => relicAffix(item, propertyInfo)).filter((item) => !!item);
}
__name(relicAffixList, "relicAffixList");
function normalizeItem(value) {
  if (!isRecord(value)) return void 0;
  const name2 = valueOf(value, ["name", "equip_name", "light_cone_name", "weapon_name"]);
  if (!name2) return void 0;
  const pathData = isRecord(value.path) ? value.path : void 0;
  const path = valueOf(value, ["path_name", "career"]) || valueOf(pathData, ["name", "path_name"]);
  const elementData = isRecord(value.element) ? value.element : void 0;
  return {
    name: name2,
    id: valueOf(value, ["id", "item_id", "tid"]),
    level: valueOf(value, ["level", "lv"]),
    rarity: valueOf(value, ["rarity", "star"]),
    rank: valueOf(value, ["rank", "refinement", "superimposition"]),
    promotion: valueOf(value, ["promotion", "promote_level"]),
    icon: mihomoImage(value) || starRailIcon("light_cone", valueOf(value, ["id", "item_id", "tid"])),
    path,
    pathIcon: mihomoImage(pathData),
    pathId: valueOf(pathData, ["id"]),
    element: valueOf(elementData, ["name", "id"]),
    elementIcon: mihomoImage(elementData),
    stats: [...normalizeMihomoStats(value.attributes), ...normalizeMihomoStats(value.properties)]
  };
}
__name(normalizeItem, "normalizeItem");
function relicSlot(value) {
  const raw = valueOf(value, ["slot_name", "position_name", "type_name", "pos_name", "slot", "position", "type"]);
  if (raw) {
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 6) return ["\u5934\u90E8", "\u624B\u90E8", "\u8EAF\u5E72", "\u811A\u90E8", "\u4F4D\u9762\u7403", "\u8FDE\u7ED3\u7EF3"][numeric - 1];
    const names = {
      head: "\u5934\u90E8",
      hands: "\u624B\u90E8",
      body: "\u8EAF\u5E72",
      feet: "\u811A\u90E8",
      sphere: "\u4F4D\u9762\u7403",
      rope: "\u8FDE\u7ED3\u7EF3",
      head_piece: "\u5934\u90E8",
      hand_piece: "\u624B\u90E8",
      body_piece: "\u8EAF\u5E72",
      foot_piece: "\u811A\u90E8",
      planar_sphere: "\u4F4D\u9762\u7403",
      link_rope: "\u8FDE\u7ED3\u7EF3"
    };
    return names[raw.toLowerCase()] || raw;
  }
  const number = Number(valueOf(value, ["pos", "type", "position", "slot"]));
  return ["\u5934\u90E8", "\u624B\u90E8", "\u8EAF\u5E72", "\u811A\u90E8", "\u4F4D\u9762\u7403", "\u8FDE\u7ED3\u7EF3"][number - 1] || "\u9057\u5668";
}
__name(relicSlot, "relicSlot");
function displayedStat(type, value) {
  const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type);
  return ratio ? Math.floor(value * 1e3 + 1e-9) / 10 : Math.floor(value + 1e-9);
}
__name(displayedStat, "displayedStat");
function exactSubAffix(affix2, rolls, type, target) {
  const expected = displayedStat(type, target);
  const stepNum = Math.max(0, Math.floor(Number(affix2.step_num ?? 2)));
  const candidates = [];
  for (let index = 0; index <= stepNum * rolls; index++) {
    const value = affix2.base * rolls + affix2.step * index;
    const floatValue = Math.fround(affix2.base) * rolls + Math.fround(affix2.step) * index;
    const matches = displayedStat(type, value) === expected || displayedStat(type, floatValue) === expected;
    if (matches && (Number.isInteger(target) || Math.abs(value - target) < 1e-9 || type !== "SpeedDelta")) candidates.push(value);
  }
  if (!candidates.length) return void 0;
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  return { value: min, min, max };
}
__name(exactSubAffix, "exactSubAffix");
function normalizeRelic(value, propertyInfo) {
  if (!isRecord(value)) return void 0;
  const set = isRecord(value.set) ? value.set : void 0;
  const name2 = valueOf(value, ["name", "relic_name"]) || valueOf(set, ["name"]) || "\u9057\u5668";
  const mainSource = value.main_affix || value.mainAffix || value.main_stat || value.main_property;
  const relicId = valueOf(value, ["id", "relic_id"]);
  const standardId = relicId && /^[2-6]\d{4}$/.test(relicId) ? relicId : void 0;
  const setId = valueOf(value, ["set_id"]) || valueOf(set, ["id"]) || standardId?.slice(1, 4);
  const rarity = Number(valueOf(value, ["rarity", "star"]) || (standardId ? Number(standardId[0]) - 1 : 0));
  const position = Number(value.pos ?? value.type ?? value.position ?? value.slot ?? standardId?.slice(-1));
  const icon = mihomoImage(value) || starRailIcon("relic", void 0, position, setId);
  const mainIcon = isRecord(mainSource) ? mihomoImage(mainSource) : void 0;
  const subSource = value.properties ?? value.sub_affix_list ?? value.sub_affix ?? value.sub_affixes ?? value.sub_stats ?? value.subStats;
  const rawSubProperties = Array.isArray(subSource) ? subSource.filter((item) => !isRecord(item) || !item.is_preview) : [];
  const subAffixes = rarity >= 2 && rarity <= 5 ? Object.values(relicSubAffixes2[String(rarity)]?.affixes || {}) : [];
  const properties = rawSubProperties.flatMap((item) => {
    if (!isRecord(item)) return [];
    const type = propertyType(item, propertyInfo);
    if (!type) return [];
    let rawAmount = valueOf(item, ["value", "display_value", "display"]);
    if (type === "SpeedDelta" && rawAmount !== void 0) {
      const amount2 = parseStatValue(type, rawAmount);
      const display = valueOf(item, ["display_value", "display"]);
      const displayedAmount = display === void 0 ? void 0 : parseStatValue(type, display);
      if (amount2 !== void 0 && Number.isInteger(amount2) && displayedAmount !== void 0 && !Number.isInteger(displayedAmount) && Math.floor(displayedAmount) === amount2) {
        rawAmount = display;
      }
    }
    const normalizedAmount = String(rawAmount || "").replace(/,/g, "").replace(/％/g, "%").trim();
    const amount = Number(normalizedAmount.replace(/%$/, ""));
    const rolls = Number(valueOf(item, ["times", "count", "add_count"]));
    const ratio = /Ratio|Base$/.test(type) && !/Delta$/.test(type);
    const affix2 = subAffixes.find((entry) => entry.property === type);
    if (affix2 && Number.isInteger(rolls) && rolls > 0 && rawAmount && Number.isFinite(amount)) {
      const target = ratio && normalizedAmount.endsWith("%") ? amount / 100 : amount;
      const exact = exactSubAffix(affix2, rolls, type, target);
      if (exact !== void 0) return [{ type, ...exact, exact: true }];
    }
    if (rawAmount && Number.isFinite(amount)) {
      return [{ type, value: ratio && normalizedAmount.endsWith("%") ? amount / 100 : amount, exact: true }];
    }
    if (Number.isFinite(rolls) && rolls > 0) return [{ type, exact: false }];
    return [];
  });
  const rawMainType = mainSource ? propertyType(mainSource, propertyInfo) : void 0;
  const mainType = rawMainType === "EnergyRecoveryRateBase" ? "SPRatioBase" : rawMainType;
  const slotAffixOrder = {
    "3": { HPAddedRatio: "1", AttackAddedRatio: "2", DefenceAddedRatio: "3", CriticalChanceBase: "4", CriticalDamageBase: "5", HealRatioBase: "6", StatusProbabilityBase: "7" },
    "4": { HPAddedRatio: "1", AttackAddedRatio: "2", DefenceAddedRatio: "3", SpeedDelta: "4" },
    "5": { HPAddedRatio: "1", AttackAddedRatio: "2", DefenceAddedRatio: "3", IceAddedRatio: "6" },
    "6": { HPAddedRatio: "3", AttackAddedRatio: "4", DefenceAddedRatio: "5", BreakDamageAddedRatioBase: "1", SPRatioBase: "2" }
  };
  const mainAffixId = mainSource ? valueOf(mainSource, ["affix_id", "main_affix_id", "id"]) : void 0;
  const slotGroup = `${rarity}${position}`;
  const mainTableId = mainAffixId || (mainType ? slotAffixOrder[String(position)]?.[mainType] : position === 1 ? "1" : position === 2 ? "1" : void 0);
  const mainAffixes = relicMainAffixes2[slotGroup]?.affixes;
  const mainTable = mainType ? Object.values(mainAffixes || {}).find((affix2) => affix2.property === mainType) : mainSource && valueOf(mainSource, ["property_type", "type", "property_name", "name"]) ? void 0 : mainAffixes?.[mainTableId || ""];
  const mappedMainType = mainTable?.property || mainType;
  const displayMainType = mappedMainType || (position === 1 ? "HPDelta" : position === 2 ? "AttackDelta" : void 0);
  const mainLevelSource = valueOf(value, ["level", "lv"]);
  const mainLevel = Number(mainLevelSource);
  const mainCalculated = mainTable && mainLevelSource !== void 0 && Number.isInteger(mainLevel) && mainLevel >= 0 ? mainTable.base + mainTable.step * mainLevel : void 0;
  const mainValue = mainSource ? valueOf(mainSource, ["value", "display_value"]) : void 0;
  const parsedMainValue = mainValue ? parseStatValue(displayMainType, mainValue) : void 0;
  const mainComplete = !!mappedMainType && (parsedMainValue !== void 0 || !!mainSource && mainCalculated !== void 0);
  return {
    id: relicId,
    name: name2,
    slot: ["\u5934\u90E8", "\u624B\u90E8", "\u8EAF\u5E72", "\u811A\u90E8", "\u4F4D\u9762\u7403", "\u8FDE\u7ED3\u7EF3"][position - 1] || relicSlot(value),
    level: valueOf(value, ["level", "lv"]),
    rarity: valueOf(value, ["rarity", "star"]) || String(rarity || ""),
    icon,
    setName: valueOf(value, ["set_name", "relic_set_name"]) || valueOf(set, ["name"]) || (setId ? relicSets2[setId]?.name : void 0),
    setId,
    setCount: valueOf(value, ["set_count"]),
    main: displayMainType && (parsedMainValue ?? mainCalculated) !== void 0 ? { name: propertyLabels[displayMainType] || displayMainType, value: mainValue || formatStatValue(displayMainType, mainCalculated) } : relicAffix(mainSource, propertyInfo) || affix(mainSource),
    mainIcon,
    mainPropertyType: mappedMainType,
    mainFinalPropertyType: displayMainType,
    mainPropertyId: mainAffixId,
    mainValue: mainCalculated ?? parsedMainValue,
    mainComplete,
    subProperties: properties,
    subComplete: Array.isArray(subSource) && properties.length === rawSubProperties.length && properties.every((property) => property.exact),
    subStats: normalizeMihomoStats(value.sub_affix || value.sub_affixes, "affix").length ? normalizeMihomoStats(value.sub_affix || value.sub_affixes, "affix") : relicAffixList(value.sub_affix_list || value.sub_affixes || value.sub_stats || value.subStats || value.properties, propertyInfo)
  };
}
__name(normalizeRelic, "normalizeRelic");
function propertyType(value, propertyInfo) {
  const raw = valueOf(value, ["property_type", "type", "property_name", "name"]);
  if (!raw) return void 0;
  const knownTypes = /* @__PURE__ */ new Set([
    ...Object.keys(propertyLabels),
    ...Object.values(relicMainAffixes2).flatMap((group) => Object.values(group.affixes).map((affix2) => affix2.property)),
    ...Object.values(relicSubAffixes2).flatMap((group) => Object.values(group.affixes).map((affix2) => affix2.property))
  ]);
  if (knownTypes.has(raw)) return raw;
  if (!isRecord(propertyInfo)) return void 0;
  const entry = isRecord(propertyInfo[raw]) ? [raw, propertyInfo[raw]] : Object.entries(propertyInfo).find(([, info2]) => isRecord(info2) && ["property_name_filter", "property_name", "name"].some((key2) => text(info2[key2]) === raw));
  if (!entry || !isRecord(entry[1])) return void 0;
  const [key, info] = entry;
  if (knownTypes.has(key)) return key;
  for (const field of ["property_type", "type", "key", "property_name_filter", "property_name", "name"]) {
    const label = text(info[field]);
    if (!label) continue;
    if (knownTypes.has(label)) return label;
    const prefix = { "\u751F\u547D\u503C": "HP", "\u653B\u51FB\u529B": "Attack", "\u9632\u5FA1\u529B": "Defence" }[label];
    if (prefix && typeof info.is_percent === "boolean") return `${prefix}${info.is_percent ? "AddedRatio" : "Delta"}`;
    const type = Object.keys(propertyLabels).find((type2) => propertyLabels[type2] === label);
    if (type) return type;
  }
}
__name(propertyType, "propertyType");
function normalizeTraces(value) {
  const source2 = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
  const defaults = ["\u666E\u653B", "\u6218\u6280", "\u7EC8\u7ED3\u6280", "\u5929\u8D4B", "\u79D8\u6280"];
  const skillTypes = {
    Normal: "\u666E\u653B",
    BPSkill: "\u6218\u6280",
    Ultra: "\u7EC8\u7ED3\u6280",
    Talent: "\u5929\u8D4B",
    Maze: "\u79D8\u6280",
    ElationDamage: "\u6B22\u6109\u6280"
  };
  const mainLabels = [...defaults, "\u6B22\u6109\u6280"];
  return source2.filter(isRecord).flatMap((item, index) => {
    const nested = Array.isArray(item.skills) ? item.skills : Array.isArray(item.skill_list) ? item.skill_list : [];
    const values = nested.length ? nested : [item];
    return values.filter(isRecord).map((skill) => {
      const id = valueOf(skill, ["id", "point_id"]);
      const tree = starRailData.characterSkillTrees[id || ""];
      const linkedSkills = Array.isArray(tree?.level_up_skills) ? tree.level_up_skills : [];
      const metadata = starRailData.characterSkills[id || ""] || linkedSkills.map((link) => starRailData.characterSkills[link.id]).find(Boolean);
      const rawType = valueOf(skill, ["type_text", "type", "skill_type", "point_type"]);
      const type = skillTypes[rawType || ""] || rawType || valueOf(metadata, ["type_text", "type"]);
      const mainLabel = [type, valueOf(metadata, ["type_text"]), skillTypes[valueOf(metadata, ["type"]) || ""]].find((label2) => label2 && mainLabels.includes(label2));
      const category = mainLabel || linkedSkills.length ? "main" : /^Point0[678]$/.test(tree?.anchor || "") || /额外能力|额外行迹/.test(type || "") ? "major" : "minor";
      const label = mainLabel || (category === "main" ? defaults[index] || "\u6280\u80FD" : category === "major" ? "\u989D\u5916\u80FD\u529B" : "\u5C5E\u6027\u52A0\u6210");
      return {
        name: valueOf(skill, ["name", "skill_name", "title"]) || valueOf(metadata, ["name"]) || valueOf(tree, ["name"]) || "\u884C\u8FF9",
        category,
        label,
        level: valueOf(skill, ["level", "cur_level", "lv"]),
        type,
        id,
        icon: assetUrl(tree?.icon) || starRailIcon("skill", id) || mihomoImage(skill) || assetUrl(mihomoTraceIcons[id || ""]),
        active: skill.is_activated === true
      };
    });
  });
}
__name(normalizeTraces, "normalizeTraces");
function normalizeStats(value, propertyInfo) {
  const sources = [value, isRecord(value) ? value.stats : void 0, isRecord(value) ? value.attributes : void 0];
  const output = [];
  for (const source2 of sources) {
    if (Array.isArray(source2)) {
      output.push(...source2.map((item) => relicAffix(item, propertyInfo) || affix(item)).filter((item) => !!item));
    } else if (isRecord(source2)) {
      for (const [name2, item] of Object.entries(source2)) {
        const parsed = relicAffix(isRecord(item) ? { ...item, name: item.name || name2 } : { name: name2, value: item }, propertyInfo) || affix(isRecord(item) ? { ...item, name: item.name || name2 } : { name: name2, value: item });
        if (parsed) output.push(parsed);
      }
    }
  }
  return output.filter((item, index, list) => list.findIndex((other) => other.name === item.name && other.value === item.value) === index);
}
__name(normalizeStats, "normalizeStats");
function normalizeProperties(value, propertyInfo) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) return void 0;
    const name2 = propertyName(item, propertyInfo) || valueOf(item, ["name", "property_name"]);
    const result = valueOf(item, ["display_value", "value", "val", "content"]);
    return name2 && result ? { name: name2, value: result } : void 0;
  }).filter((item) => !!item);
}
__name(normalizeProperties, "normalizeProperties");
function normalizeMihomoStats(value, mode = "stat") {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!isRecord(item)) return void 0;
    const field = valueOf(item, ["field"]);
    const name2 = valueOf(item, ["name"]) || mihomoPropertyNames[field?.toLowerCase() || ""] || field;
    const result = valueOf(item, ["display_value", "display", "value"]);
    return name2 && result ? { name: name2, value: result, count: mode === "affix" ? valueOf(item, ["count"]) : void 0 } : void 0;
  }).filter((item) => !!item);
}
__name(normalizeMihomoStats, "normalizeMihomoStats");
function mihomoStatDetails(statistics, attributes, additions) {
  if (!Array.isArray(statistics)) return [];
  const values = /* @__PURE__ */ __name((source2) => new Map(Array.isArray(source2) ? source2.filter(isRecord).flatMap((item) => {
    const field = valueOf(item, ["field"]);
    return field ? [[field, item]] : [];
  }) : []), "values");
  const baseValues = values(attributes);
  const addedValues = values(additions);
  return statistics.flatMap((item) => {
    if (!isRecord(item)) return [];
    const field = valueOf(item, ["field"]);
    if (!field) return [];
    const base = Number(baseValues.get(field)?.value);
    const added = Number(addedValues.get(field)?.value);
    const total = Number(item.value);
    const display = valueOf(item, ["display"]) || (Number.isFinite(total) ? String(total) : "");
    return [{
      field: mihomoPropertyNames[field.toLowerCase()] || field,
      base: Number.isFinite(base) ? String(base) : "-",
      added: Number.isFinite(added) ? String(added) : "-",
      total: Number.isFinite(total) ? String(total) : display,
      display
    }];
  });
}
__name(mihomoStatDetails, "mihomoStatDetails");
function mihomoStatIcons(value) {
  if (!Array.isArray(value)) return {};
  const output = {};
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name2 = valueOf(item, ["name", "field"]);
    const icon = mihomoImage(item);
    if (name2 && icon) output[name2] = icon;
  }
  return output;
}
__name(mihomoStatIcons, "mihomoStatIcons");
function calculateRelicScores(character) {
  const incomplete2 = /* @__PURE__ */ __name((reason) => ({ status: "incomplete", characterId: character.id, reason, ...fribbelsScoreMetadata }), "incomplete");
  if (!character.id) {
    character.relicScore = incomplete2("\u7F3A\u5C11\u89D2\u8272 ID\uFF0C\u65E0\u6CD5\u8BC4\u5206");
    for (const relic of character.relics) relic.score = incomplete2("\u7F3A\u5C11\u89D2\u8272 ID\uFF0C\u65E0\u6CD5\u8BC4\u5206");
    return;
  }
  const support = scoreFribbelsSet(character.id, []);
  if (support.status === "unsupported") {
    character.relicScore = support;
    for (const relic of character.relics) relic.score = { ...support };
    return;
  }
  const inputs = [];
  for (const relic of character.relics) {
    const slot = fribbelsSlotOf(relic.slot);
    if (!slot || !relic.mainComplete || !relic.subComplete || !relic.mainFinalPropertyType || !relic.subProperties || relic.subProperties.some((property) => !property.exact || property.value === void 0)) {
      relic.score = incomplete2(`${relic.slot}\uFF1A\u90E8\u4F4D\u6216\u4E3B\u526F\u8BCD\u6761\u6570\u636E\u4E0D\u5B8C\u6574\uFF0C\u65E0\u6CD5\u8BC4\u5206`);
      continue;
    }
    const input = {
      slot,
      rarity: Number(relic.rarity),
      main: relic.mainFinalPropertyType,
      subStats: relic.subProperties.map((property) => ({ type: property.type, value: property.value }))
    };
    try {
      const score = scoreFribbelsRelic(character.id, input);
      relic.score = score;
      if (score.status === "supported") inputs.push(input);
    } catch (error) {
      relic.score = incomplete2(`${relic.slot}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const failed = character.relics.find((relic) => relic.score?.status === "incomplete" || relic.score?.status === "unsupported");
  if (failed?.score && failed.score.status !== "supported") {
    character.relicScore = failed.score.status === "unsupported" ? failed.score : incomplete2(failed.score.reason);
  } else if (inputs.length !== 6) {
    character.relicScore = incomplete2(`\u6574\u5957\u8BC4\u5206\u9700\u8981\u516D\u4E2A\u4E0D\u540C\u90E8\u4F4D\u7684\u5B8C\u6574\u9057\u5668\uFF0C\u5F53\u524D ${inputs.length} \u4EF6`);
  } else {
    character.relicScore = scoreFribbelsSet(character.id, inputs);
  }
}
__name(calculateRelicScores, "calculateRelicScores");
function normalizeCharacter(value, propertyInfo) {
  const base = isRecord(value.base) ? value.base : {};
  const character = { ...value, ...base };
  const lightConeSource = value.equip || value.light_cone || value.weapon || value.equipment;
  const lightCone = normalizeItem(lightConeSource);
  const relicSource = [
    ...Array.isArray(value.relic_list) ? value.relic_list : [],
    ...Array.isArray(value.relics) ? value.relics : [],
    ...Array.isArray(value.ornaments) ? value.ornaments : [],
    ...Array.isArray(value.artifacts) ? value.artifacts : []
  ];
  const statsSource = value.statistics || value.stats || value.attributes || value.attribute_list || value.attributeList || value.property_list || value.propertyList || value.extra;
  const normalizedProperties = normalizeProperties(statsSource, propertyInfo);
  const attributes = normalizedProperties.length ? normalizedProperties : normalizeStats(statsSource, propertyInfo);
  const mihomoStats = normalizeMihomoStats(value.statistics).length ? normalizeMihomoStats(value.statistics) : normalizeMihomoStats(value.attributes);
  const stats = mihomoStats.length ? mihomoStats : attributes;
  const relics = relicSource.map((item) => normalizeRelic(item, propertyInfo)).filter((item) => !!item);
  const normalized = {
    id: valueOf(character, ["id", "avatar_id", "character_id"]),
    name: valueOf(character, ["name", "avatar_name", "character_name"]) || "\u672A\u77E5\u89D2\u8272",
    level: valueOf(character, ["level", "lv"]),
    rank: valueOf(character, ["rank", "constellation", "eidolon"]),
    rarity: valueOf(character, ["rarity", "star"]),
    promotion: valueOf(character, ["promotion", "promote_level"]),
    icon: starRailIcon("character", valueOf(character, ["id", "avatar_id", "character_id"])) || mihomoImage(value) || mihomoImage(base),
    image: assetUrl(value.portrait) || assetUrl(value.preview) || assetUrl(base.portrait) || assetUrl(base.preview) || mihomoImage(value) || mihomoImage(base),
    element: valueOf(character, ["element_name", "attribute_name"]) || (isRecord(value.element) ? valueOf(value.element, ["name", "id"]) : valueOf(character, ["element", "attribute"])),
    elementIcon: isRecord(value.element) ? mihomoImage(value.element) : void 0,
    path: valueOf(character, ["path_name", "career"]) || (isRecord(value.path) ? valueOf(value.path, ["name", "id"]) : valueOf(character, ["path"])),
    pathId: isRecord(value.path) ? valueOf(value.path, ["id"]) : void 0,
    pathIcon: isRecord(value.path) ? mihomoImage(value.path) : void 0,
    statsIcon: Object.assign({}, mihomoStatIcons(value.attributes), mihomoStatIcons(value.additions), mihomoStatIcons(value.properties)),
    statDetails: mihomoStatDetails(value.statistics, value.attributes, value.additions),
    lightCone,
    stats,
    traces: normalizeTraces(value.skill_tree || value.skill_tree_list || value.skills || value.traces),
    relics
  };
  normalized.calculatedStats = calculateStats(normalized);
  if (!normalized.stats.length && normalized.calculatedStats.length) normalized.stats = normalized.calculatedStats;
  calculateRelicScores(normalized);
  return normalized;
}
__name(normalizeCharacter, "normalizeCharacter");
function normalizePanel(game, account, data) {
  const propertyInfo = isRecord(data) ? data.property_info : void 0;
  const avatars = roleList(data);
  return {
    game,
    uid: account.uid,
    server: account.region,
    characters: avatars.map((character) => normalizeCharacter(character, propertyInfo))
  };
}
__name(normalizePanel, "normalizePanel");
function panelRecord(role, label) {
  const lines = [];
  const fields = [
    ["\u89D2\u8272", ["name", "avatar_name"]],
    ["\u7B49\u7EA7", ["level"]],
    ["\u7A00\u6709\u5EA6", ["rarity"]],
    ["\u547D\u5EA7", ["rank", "constellation"]],
    ["\u7ECF\u9A8C", ["exp"]],
    ["\u7A81\u7834", ["promote_level", "promotion"]]
  ];
  for (const [label2, keys] of fields) {
    const value = keys.map((key) => text(role[key])).find(Boolean);
    if (value) lines.push(`${label2}\uFF1A${value}`);
  }
  for (const key of ["weapon", "equipment", "light_cone"]) {
    if (!isRecord(role[key])) continue;
    const item = role[key];
    const name2 = text(item.name) || text(item.weapon_name) || text(item.light_cone_name);
    const level = text(item.level);
    const rank = text(item.rank) || text(item.refinement);
    if (name2) lines.push(`${key === "light_cone" ? "\u5149\u9525" : "\u6B66\u5668"}\uFF1A${name2}${level ? ` Lv.${level}` : ""}${rank ? ` \u7CBE\u70BC${rank}` : ""}`);
  }
  for (const key of ["stats", "base", "extra"]) {
    if (!isRecord(role[key])) continue;
    const stats = role[key];
    for (const [stat, value] of Object.entries(stats)) {
      const parsed = text(value);
      if (parsed && lines.length < 30) lines.push(`${stat}\uFF1A${parsed}`);
    }
  }
  const relics = role.relic_list || role.relics || role.artifacts;
  if (Array.isArray(relics)) {
    lines.push(`\u9057\u5668\u6570\u91CF\uFF1A${relics.length}`);
    for (const item of relics.slice(0, 6)) {
      if (!isRecord(item)) continue;
      const name2 = text(item.name) || text(item.set_name) || "\u9057\u5668";
      const level = text(item.level);
      lines.push(`${name2}${level ? ` +${level}` : ""}`);
    }
  }
  return lines.length ? `${label}
${lines.join("\n")}` : `${label}\uFF1A\u6682\u65E0\u5177\u4F53\u9762\u677F\u6570\u636E\u3002`;
}
__name(panelRecord, "panelRecord");
function formatRecord(label, data) {
  if (!isRecord(data)) return `${label}\uFF1A\u6682\u65E0\u53EF\u5C55\u793A\u7684\u6570\u636E\u3002`;
  const fields = ["nickname", "name", "level", "active_days", "achievement_number", "reliquaries", "chests", "total_star", "max_floor", "max_score", "total_battle_times", "has_data"];
  const lines = fields.flatMap((key) => {
    const value = text(data[key]);
    return value ? [`${key}\uFF1A${value}`] : [];
  });
  const roles = roleList(data);
  if (roles.length) lines.push(`\u89D2\u8272\u6570\u91CF\uFF1A${roles.length}`, ...roles.slice(0, 15).map((role) => {
    const name2 = text(role.name) || text(role.avatar_name) || text(role.id) || "\u672A\u77E5\u89D2\u8272";
    const level = text(role.level);
    return `${name2}${level ? ` Lv.${level}` : ""}`;
  }));
  for (const key of ["all_floor", "floors", "floor_list"]) {
    if (!Array.isArray(data[key])) continue;
    const floors = data[key].filter(isRecord);
    lines.push(`\u5173\u5361\u6570\u91CF\uFF1A${floors.length}`);
    for (const floor of floors.slice(0, 12)) {
      const name2 = text(floor.name) || text(floor.floor_name) || text(floor.index) || text(floor.floor) || "\u5173\u5361";
      const score = text(floor.star_num) || text(floor.score) || text(floor.max_score);
      lines.push(`${name2}${score ? `\uFF1A${score}` : ""}`);
    }
    break;
  }
  for (const key of ["stats", "role", "data"]) {
    if (isRecord(data[key])) {
      for (const field of fields) {
        const value = text(data[key][field]);
        if (value) lines.push(`${field}\uFF1A${value}`);
      }
    }
  }
  return lines.length ? `${label}
${lines.slice(0, 22).join("\n")}` : `${label}\uFF1A\u63A5\u53E3\u8FD4\u56DE\u6570\u636E\uFF0C\u4F46\u6682\u65E0\u53EF\u5C55\u793A\u7684\u6458\u8981\u3002`;
}
__name(formatRecord, "formatRecord");
function formatChallenge(label, data, schedule) {
  if (!isRecord(data)) return `${label}\uFF1A\u6682\u65E0\u6311\u6218\u8BB0\u5F55\u3002`;
  const lines = [];
  const groups = Array.isArray(data.groups) ? data.groups.filter(isRecord) : [];
  const group = groups.find((item) => item.status === (schedule === 1 ? "New" : "End")) || groups[0];
  if (group) {
    for (const key of ["name", "begin_time", "end_time", "max_score", "total_star"]) {
      const value = text(group[key]);
      if (value) lines.push(`${key}\uFF1A${value}`);
    }
  }
  for (const key of ["max_floor", "total_star", "max_score"]) {
    const value = text(data[key]);
    if (value) lines.push(`${key}\uFF1A${value}`);
  }
  const details = Array.isArray(data.all_floor_detail) ? data.all_floor_detail.filter(isRecord) : [];
  if (details.length) {
    lines.push(`\u5173\u5361\u6570\u91CF\uFF1A${details.length}`);
    for (const floor of details.slice(0, 12)) {
      const name2 = text(floor.name) || text(floor.floor_name) || text(floor.index) || "\u5173\u5361";
      const nodes = ["node_1", "node_2", "node_3"].map((key) => floor[key]).filter(isRecord);
      const scores = nodes.map((node) => Number(node.score)).filter(Number.isFinite);
      const score = text(floor.score) || (scores.length ? String(scores.reduce((sum, item) => sum + item, 0)) : void 0);
      lines.push(`${name2}${score ? `\uFF1A${score}` : ""}`);
    }
  }
  const peaks = Array.isArray(data.challenge_peak_records) ? data.challenge_peak_records.filter(isRecord) : [];
  const peak = peaks[schedule === 1 ? 0 : schedule === 2 ? 1 : 2];
  if (peak) {
    const value = text(peak.score) || text(peak.total_score);
    lines.push(`\u5F02\u76F8\u8BB0\u5F55${value ? `\uFF1A${value}` : ""}`);
    const mobs = Array.isArray(peak.mob_records) ? peak.mob_records : [];
    lines.push(`\u9A91\u58EB\u8BB0\u5F55\uFF1A${mobs.length}`);
  }
  return lines.length ? `${label}
${lines.slice(0, 22).join("\n")}` : formatRecord(label, data);
}
__name(formatChallenge, "formatChallenge");
function createRecords(client, cache) {
  const cn = /* @__PURE__ */ __name((region) => region.startsWith("cn_") || region.endsWith("_cn"), "cn");
  const host = /* @__PURE__ */ __name((region) => cn(region) ? "https://api-takumi-record.mihoyo.com" : "https://sg-act-public-api.hoyolab.com", "host");
  async function warmStarRailData(data) {
    if (!cache || !isRecord(data)) return;
    const avatars = roleList(data);
    const ids = /* @__PURE__ */ new Set();
    const lightCones = /* @__PURE__ */ new Set();
    for (const avatar of avatars) {
      const id = valueOf(avatar, ["id", "avatar_id", "character_id"]);
      if (id) ids.add(id);
      const equip = avatar.equip || avatar.light_cone || avatar.weapon || avatar.equipment;
      if (isRecord(equip)) {
        const coneId = valueOf(equip, ["id", "equipment_id", "light_cone_id", "weapon_id"]);
        if (coneId) lightCones.add(coneId);
      }
    }
    const source2 = "https://cdn.jsdelivr.net/gh/Mar-7th/StarRailRes@master/index_new/cn/";
    const resources = [
      ["characters", "characters.json", ids],
      ["characterPromotions", "character_promotions.json", ids],
      ["characterSkillTrees", "character_skill_trees.json", ids],
      ["lightCones", "light_cones.json", lightCones],
      ["lightConePromotions", "light_cone_promotions.json", lightCones],
      ["lightConeRanks", "light_cone_ranks.json", lightCones]
    ];
    await Promise.all(resources.map(async ([resource, file, wanted]) => {
      const missing = [...wanted].some((id2) => !(id2 in starRailData[resource]));
      if (!missing) return;
      const id = `starrail:${file}`;
      const remote = await cache.getOrFetch(id, async () => {
        const response = await fetch(`${source2}${file}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15e3) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.json();
        if (!isRecord(value)) throw new Error("invalid JSON resource");
        return { source: `${source2}${file}`, version: "master", data: value };
      });
      if (remote) mergeStarRailData(resource, remote);
    }));
  }
  __name(warmStarRailData, "warmStarRailData");
  async function enrichStarRailPanel(account, panel) {
    try {
      const response = await fetch(`https://api.mihomo.me/sr_info_parsed/${encodeURIComponent(account.uid)}?lang=chs`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) return panel;
      const data = await response.json();
      const candidates = Array.isArray(data.characters) ? data.characters.filter(isRecord) : [];
      return {
        ...panel,
        characters: panel.characters.map((character) => {
          const match = candidates.find((item) => String(item.id ?? "") === String(character.id ?? ""));
          if (!match) return character;
          const supplement = normalizeCharacter(match);
          return {
            ...character,
            image: character.image || supplement.image,
            icon: character.icon || supplement.icon,
            elementIcon: character.elementIcon || supplement.elementIcon,
            pathIcon: character.pathIcon || supplement.pathIcon,
            traces: character.traces.map((trace) => ({
              ...trace,
              icon: trace.icon || supplement.traces.find((item) => item.id === trace.id)?.icon || assetUrl(mihomoTraceIcons[trace.id || ""])
            })),
            lightCone: character.lightCone ? {
              ...character.lightCone,
              icon: character.lightCone.icon || (character.lightCone.id && character.lightCone.id === supplement.lightCone?.id ? supplement.lightCone.icon : void 0)
            } : character.lightCone,
            relics: character.relics.map((relic) => {
              const related = supplement.relics.find((item) => item.id === relic.id);
              return { ...relic, icon: relic.icon || related?.icon };
            })
          };
        })
      };
    } catch {
      return panel;
    }
  }
  __name(enrichStarRailPanel, "enrichStarRailPanel");
  async function queryPanel(account, secret, device, character) {
    if (account.game !== "sr" && account.game !== "gs") return "\u8BE5\u6E38\u620F\u4E0D\u652F\u6301\u89D2\u8272\u9762\u677F\u3002";
    const game = account.game;
    const owned = await client.discover(secret);
    if (!owned.some((role) => role.game === game && role.uid === account.uid && role.region === account.region)) {
      return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u5F53\u524D\u51ED\u8BC1\u672A\u7ED1\u5B9A\u8BE5\u6E38\u620F UID\uFF0C\u62D2\u7EDD\u8BF7\u6C42\u3002";
    }
    const path = recordTypes[game].panel;
    const prefix = game === "gs" ? "/game_record/app/genshin/api/" : "/game_record/app/hkrpg/api/";
    const hostUrl = `${host(account.region)}${prefix}${path}`;
    const params = new URLSearchParams({ need_wiki: "true", role_id: account.uid, server: account.region });
    let body;
    let url = hostUrl;
    if (game === "gs") {
      body = { role_id: account.uid, server: account.region };
      const list = await client.record(`${host(account.region)}${prefix}${recordTypes.gs.roles}`, secret, body, device);
      if (list.retcode !== 0) return `\u89D2\u8272\u5217\u8868\u67E5\u8BE2\u5931\u8D25\uFF08${list.retcode}\uFF09\u3002`;
      const ids = roleList(list.data).map((role) => role.id).filter((id) => typeof id === "number" || typeof id === "string").slice(0, 60);
      if (!ids.length) return "\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u89D2\u8272\u9762\u677F\u3002";
      body = { ...body, character_ids: ids };
    } else {
      url = `${hostUrl}?${params}`;
    }
    const result = await client.record(url, secret, body, device);
    if (result.retcode !== 0) {
      if (result.retcode === 10102) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8BE5\u89D2\u8272\u7684\u7C73\u6E38\u793E\u6570\u636E\u672A\u516C\u5F00\u3002";
      if (result.retcode === 10101) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u4ECA\u65E5\u67E5\u8BE2\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650\u3002";
      if ([1034, 10035].includes(result.retcode)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u5E73\u53F0\u8981\u6C42\u9A8C\u8BC1\u7801\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u9A8C\u8BC1\u3002";
      if ([5003, 10041].includes(result.retcode)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8D26\u53F7\u6216\u8BBE\u5907\u72B6\u6001\u5F02\u5E38\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u68C0\u67E5\u3002";
      if (result.retcode === -10001 || result.retcode === 10001) {
        const message = result.message || "";
        if (/登录|login|token|cookie/i.test(message)) return "\u67E5\u8BE2\u5931\u8D25\uFF1ACookie \u6216\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A\u7C73\u6E38\u793E\u51ED\u8BC1\u3002";
        if (/device|fingerprint|risk|forbidden|风控|设备|异常/i.test(message)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8BF7\u6C42\u88AB\u8BBE\u5907\u6216\u98CE\u63A7\u7B56\u7565\u62D2\u7EDD\uFF0C\u8BF7\u5148\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u6253\u5F00\u5BF9\u5E94\u89D2\u8272\u9875\u9762\u540E\u91CD\u8BD5\u3002";
        return `\u67E5\u8BE2\u5931\u8D25\uFF08${result.retcode}\uFF09\uFF1A\u8BB0\u5F55\u63A5\u53E3\u62D2\u7EDD\u8BF7\u6C42\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u5907\u6307\u7EB9\u3001\u89D2\u8272\u5C55\u793A\u6743\u9650\u53CA\u7C73\u6E38\u793E\u5BA2\u6237\u7AEF\u72B6\u6001\u3002`;
      }
      return `\u67E5\u8BE2\u5931\u8D25\uFF08${result.retcode}\uFF09\uFF0C\u8BF7\u68C0\u67E5\u89D2\u8272\u5C55\u793A\u6743\u9650\u53CA\u5B98\u65B9\u5BA2\u6237\u7AEF\u72B6\u6001\u3002`;
    }
    if (game === "sr") {
      await warmStarRailData(result.data);
      if (cache && isRecord(result.data)) {
        await Promise.all(roleList(result.data).map(async (item) => {
          const id = valueOf(item, ["id", "avatar_id", "character_id"]);
          if (id) await ensureFribbelsScoring(id, cache);
        }));
      }
    }
    let panel = normalizePanel(game, account, result.data);
    if (game === "sr") panel = await enrichStarRailPanel(account, panel);
    if (character) {
      const selected = panel.characters.find((item) => [item.name, item.id].some((value) => String(value || "").toLowerCase() === character.trim().toLowerCase()));
      if (!selected) return `\u672A\u627E\u5230\u89D2\u8272\u201C${character}\u201D\uFF0C\u5F53\u524D\u63A5\u53E3\u8FD4\u56DE ${panel.characters.length} \u4E2A\u89D2\u8272\u3002`;
      return { ...panel, characters: [selected] };
    }
    return panel;
  }
  __name(queryPanel, "queryPanel");
  async function query(account, secret, type, schedule = 1, device, character) {
    if (!(account.game in recordTypes)) return "\u8BE5\u6E38\u620F\u4E0D\u652F\u6301\u8BB0\u5F55\u67E5\u8BE2\u3002";
    const game = account.game;
    const paths = recordTypes[game];
    if (!Object.hasOwn(paths, type)) return "\u8BE5\u6E38\u620F\u4E0D\u652F\u6301\u6B64\u8BB0\u5F55\u7C7B\u578B\u3002";
    const owned = await client.discover(secret);
    if (!owned.some((role) => role.game === game && role.uid === account.uid && role.region === account.region)) {
      return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u5F53\u524D\u51ED\u8BC1\u672A\u7ED1\u5B9A\u8BE5\u6E38\u620F UID\uFF0C\u62D2\u7EDD\u8BF7\u6C42\u3002";
    }
    const prefix = game === "gs" ? "/game_record/app/genshin/api/" : game === "sr" ? "/game_record/app/hkrpg/api/" : "/event/game_record_zzz/api/zzz/";
    const url = `${host(account.region)}${prefix}${paths[type]}`;
    const params = new URLSearchParams({ role_id: account.uid, server: account.region });
    if (game === "sr" && type === "overview") {
      const index = await client.record(`${url}?${params}`, secret, void 0, device);
      if (index.retcode !== 0) return `\u6982\u89C8\u67E5\u8BE2\u5931\u8D25\uFF08${index.retcode}\uFF09\u3002`;
      const brief = await client.record(`${host(account.region)}${prefix}challenge_brief?${params}`, secret, void 0, device);
      if (brief.retcode !== 0) return `\u6311\u6218\u6458\u8981\u67E5\u8BE2\u5931\u8D25\uFF08${brief.retcode}\uFF09\u3002`;
      const summary = formatRecord("sr overview", index.data);
      const schedules = Array.isArray(brief.data?.list) ? brief.data.list.filter(isRecord) : [];
      const lines = schedules.slice(0, 3).map((item) => {
        const current = isRecord(item.cur_schedule) ? item.cur_schedule : {};
        return `${text(item.challenge_type) || "\u6311\u6218"}\uFF1A${text(current.finish_star_count) || "0"}/${text(current.total_star_count) || "-"}`;
      });
      return lines.length ? `${summary}
${lines.join("\n")}` : summary;
    }
    let body;
    if (game === "gs" && (type === "roles" || type === "panel")) {
      body = { role_id: account.uid, server: account.region };
      if (type === "panel") {
        const list = await client.record(`${host(account.region)}${prefix}${paths.roles}`, secret, body, device);
        if (list.retcode !== 0) return `\u89D2\u8272\u5217\u8868\u67E5\u8BE2\u5931\u8D25\uFF08${list.retcode}\uFF09\u3002`;
        const ids = roleList(list.data).map((role) => role.id).filter((id) => typeof id === "number" || typeof id === "string").slice(0, 60);
        if (!ids.length) return "\u6CA1\u6709\u53EF\u66F4\u65B0\u7684\u89D2\u8272\u9762\u677F\u3002";
        body = { ...body, character_ids: ids };
      }
    } else {
      if (game === "zzz") params.set("lang", "zh-cn");
      if (game === "sr" && type === "panel") {
        const ordered = new URLSearchParams({ need_wiki: "true", role_id: account.uid, server: account.region });
        params.delete("role_id");
        params.delete("server");
        for (const [key, value] of ordered) params.set(key, value);
      }
      if (["forgotten", "fiction", "apocalypse", "anomaly", "abyss"].includes(type)) params.set("schedule_type", String(schedule));
      if (game === "sr" && ["forgotten", "fiction", "apocalypse", "anomaly"].includes(type)) {
        params.set("isPrev", "");
        params.set("need_all", "true");
      }
      if (game === "gs" && ["theater", "peril"].includes(type)) params.set("need_detail", "true");
    }
    let result = await client.record(body ? url : `${url}?${params}`, secret, body, device);
    if (result.retcode === 1034 && game === "sr" && ["forgotten", "fiction", "apocalypse", "anomaly"].includes(type)) {
      params.delete("isPrev");
      params.delete("need_all");
      result = await client.record(`${url}?${params}`, secret, void 0, device);
    }
    if (result.retcode !== 0) {
      if (result.retcode === 10102) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8BE5\u89D2\u8272\u7684\u7C73\u6E38\u793E\u6570\u636E\u672A\u516C\u5F00\u3002";
      if (result.retcode === 10101) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u4ECA\u65E5\u67E5\u8BE2\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650\u3002";
      if (result.retcode === 1008) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8BF7\u5148\u5728\u7C73\u6E38\u793E\u7ED1\u5B9A\u89D2\u8272\u3002";
      if ([1034, 10035].includes(result.retcode)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u5E73\u53F0\u8981\u6C42\u9A8C\u8BC1\u7801\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u9A8C\u8BC1\u3002";
      if ([5003, 10041].includes(result.retcode)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8D26\u53F7\u6216\u8BBE\u5907\u72B6\u6001\u5F02\u5E38\uFF0C\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u68C0\u67E5\u3002";
      if (result.retcode === -10001 || result.retcode === 10001) {
        const message = result.message || "";
        if (/登录|login|token|cookie/i.test(message)) return "\u67E5\u8BE2\u5931\u8D25\uFF1ACookie \u6216\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u7ED1\u5B9A\u7C73\u6E38\u793E\u51ED\u8BC1\u3002";
        if (/device|fingerprint|risk|forbidden|风控|设备|异常/i.test(message)) return "\u67E5\u8BE2\u5931\u8D25\uFF1A\u8BF7\u6C42\u88AB\u8BBE\u5907\u6216\u98CE\u63A7\u7B56\u7565\u62D2\u7EDD\uFF0C\u8BF7\u5148\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u6253\u5F00\u5BF9\u5E94\u89D2\u8272\u9875\u9762\u540E\u91CD\u8BD5\u3002";
        return `\u67E5\u8BE2\u5931\u8D25\uFF08${result.retcode}\uFF09\uFF1A\u8BB0\u5F55\u63A5\u53E3\u62D2\u7EDD\u8BF7\u6C42\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u5907\u6307\u7EB9\u3001\u89D2\u8272\u5C55\u793A\u6743\u9650\u53CA\u7C73\u6E38\u793E\u5BA2\u6237\u7AEF\u72B6\u6001\u3002`;
      }
      return `\u67E5\u8BE2\u5931\u8D25\uFF08${result.retcode}\uFF09\uFF0C\u8BF7\u68C0\u67E5\u89D2\u8272\u5C55\u793A\u6743\u9650\u53CA\u5B98\u65B9\u5BA2\u6237\u7AEF\u72B6\u6001\u3002`;
    }
    if (type === "panel" && character) {
      const selected = findRole(result.data, character);
      if (!selected) return `\u672A\u627E\u5230\u89D2\u8272\u201C${character}\u201D\uFF0C\u8BF7\u5148\u4F7F\u7528 mys.record ${game} panel \u67E5\u770B\u89D2\u8272\u540D\u79F0\u3002`;
      return panelRecord(selected, `${game} ${character} \u9762\u677F`);
    }
    const label = `${game} ${type}\uFF08${schedule === 2 ? "\u4E0A\u671F" : schedule === 3 ? "\u5F80\u671F" : "\u672C\u671F"}\uFF09`;
    return game === "sr" && ["forgotten", "fiction", "apocalypse", "anomaly"].includes(type) ? formatChallenge(label, result.data, schedule) : formatRecord(label, result.data);
  }
  __name(query, "query");
  return { query, queryPanel };
}
__name(createRecords, "createRecords");

// src/vault.ts
var import_node_crypto3 = require("node:crypto");
function accountId(platform, userId, slot) {
  return (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify([platform, userId, slot])).digest("hex");
}
__name(accountId, "accountId");
function createVault(ctx, keyText) {
  const key = Buffer.from(keyText, "base64");
  if (key.length !== 32 || key.toString("base64") !== keyText) {
    throw new Error("MIYOUSHE_SIGN_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282\u968F\u673A\u5BC6\u94A5\u7684\u6807\u51C6 base64 \u7F16\u7801\u3002");
  }
  ctx.model.extend("miyoushe_sign_account", {
    id: "string",
    platform: "string",
    userId: "string",
    slot: "string",
    kind: "string",
    uid: "string",
    region: "string",
    enabled: "boolean",
    ciphertext: "text",
    lastDay: "string"
  }, { primary: "id" });
  ctx.model.extend("miyoushe_sign_device", {
    id: "string",
    platform: "string",
    userId: "string",
    slot: "string",
    ciphertext: "text"
  }, { primary: "id" });
  function encrypt(value, aad) {
    const nonce = (0, import_node_crypto3.randomBytes)(12);
    const cipher = (0, import_node_crypto3.createCipheriv)("aes-256-gcm", key, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify(aad)));
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64");
  }
  __name(encrypt, "encrypt");
  function decrypt(ciphertext, aad) {
    const payload = Buffer.from(ciphertext, "base64");
    if (payload.length < 29) throw new Error("\u52A0\u5BC6\u6570\u636E\u635F\u574F\u3002");
    const decipher = (0, import_node_crypto3.createDecipheriv)("aes-256-gcm", key, payload.subarray(0, 12));
    decipher.setAAD(Buffer.from(JSON.stringify(aad)));
    decipher.setAuthTag(payload.subarray(12, 28));
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
  }
  __name(decrypt, "decrypt");
  const owned = /* @__PURE__ */ __name(async (platform, userId, slot) => {
    const rows = await ctx.database.get("miyoushe_sign_account", { id: accountId(platform, userId, slot) });
    const row = rows[0];
    return row?.platform === platform && row.userId === userId && row.slot === slot ? row : void 0;
  }, "owned");
  return {
    owned,
    async list(platform, userId) {
      return ctx.database.get("miyoushe_sign_account", { platform, userId });
    },
    async all() {
      return ctx.database.get("miyoushe_sign_account", { enabled: true });
    },
    async put(platform, userId, slot, kind, uid, region, secret) {
      const id = accountId(platform, userId, slot);
      const ciphertext = encrypt(secret, [platform, userId, slot, kind, uid, region]);
      await ctx.database.remove("miyoushe_sign_device", { id });
      await ctx.database.upsert("miyoushe_sign_account", [{
        id,
        platform,
        userId,
        slot,
        kind,
        uid,
        region,
        enabled: false,
        ciphertext,
        lastDay: ""
      }]);
    },
    async use(platform, userId, slot, callback) {
      const row = await owned(platform, userId, slot);
      if (!row) throw new Error("\u672A\u7ED1\u5B9A\u8BE5\u8D26\u53F7\u3002");
      const secret = decrypt(row.ciphertext, [platform, userId, slot, row.kind, row.uid, row.region]);
      return callback(secret, row);
    },
    async putDevice(platform, userId, slot, device) {
      if (!await owned(platform, userId, slot)) return false;
      const id = accountId(platform, userId, slot);
      const ciphertext = encrypt(JSON.stringify(device), ["device", platform, userId, slot]);
      await ctx.database.upsert("miyoushe_sign_device", [{ id, platform, userId, slot, ciphertext }]);
      return true;
    },
    async useDevice(platform, userId, slot, callback) {
      if (!await owned(platform, userId, slot)) throw new Error("\u672A\u7ED1\u5B9A\u8BE5\u8D26\u53F7\u3002");
      const [row] = await ctx.database.get("miyoushe_sign_device", { id: accountId(platform, userId, slot) });
      if (!row) return callback();
      if (row.platform !== platform || row.userId !== userId || row.slot !== slot) throw new Error("\u8BBE\u5907\u4E0D\u5C5E\u4E8E\u8BE5\u7528\u6237\u3002");
      const device = JSON.parse(decrypt(row.ciphertext, ["device", platform, userId, slot]));
      return callback(device);
    },
    async removeDevice(platform, userId, slot) {
      if (!await owned(platform, userId, slot)) return false;
      await ctx.database.remove("miyoushe_sign_device", { id: accountId(platform, userId, slot) });
      return true;
    },
    async enable(platform, userId, slot, enabled) {
      const row = await owned(platform, userId, slot);
      if (!row) return false;
      await ctx.database.set("miyoushe_sign_account", { id: row.id }, { enabled });
      return true;
    },
    async mark(platform, userId, slot, day2) {
      const row = await owned(platform, userId, slot);
      if (row) await ctx.database.set("miyoushe_sign_account", { id: row.id }, { lastDay: day2 });
    },
    async remove(platform, userId, slot) {
      const row = await owned(platform, userId, slot);
      if (!row) return false;
      await ctx.database.remove("miyoushe_sign_account", { id: row.id });
      await ctx.database.remove("miyoushe_sign_device", { id: row.id });
      return true;
    }
  };
}
__name(createVault, "createVault");

// src/panel.ts
function escape(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
__name(escape, "escape");
function image(value, className) {
  if (!value || !/^https:\/\//i.test(value)) return `<div class="${className} placeholder">\u6682\u65E0\u56FE\u7247</div>`;
  return `<img class="${className}" src="${escape(value)}">`;
}
__name(image, "image");
function affixList(items) {
  return items.length ? items.map((item) => `<div class="affix"><span>${escape(item.name)}</span><b>${escape(item.value || "-")}</b>${item.count ? `<em>\xD7${escape(item.count)}</em>` : ""}</div>`).join("") : '<div class="muted">\u6682\u65E0\u526F\u8BCD\u6761</div>';
}
__name(affixList, "affixList");
function scoreHtml(score, total = false) {
  if (!score) return "";
  const label = total ? "\u5E73\u5747\u8BC4\u5206" : "\u9057\u5668\u8BC4\u5206";
  if (score.status !== "supported") return `<div class="score-note">${label}\uFF1A${escape(score.status === "unsupported" ? "\u8BE5\u89D2\u8272\u6682\u65E0\u8BC4\u5206\u6743\u91CD" : "\u6570\u636E\u4E0D\u5B8C\u6574")}<small>${escape(score.reason)}</small></div>`;
  if (total && "averageScore" in score) {
    return `<div class="relic-score"><span>${label}</span><b>${score.averageScore.toFixed(1)} <em>${escape(score.averageGrade)}</em></b><small>\u603B\u6709\u6548\u8BCD\u6761 ${score.effectiveRolls.toFixed(1)}</small></div>`;
  }
  if ("score" in score) {
    return `<div class="relic-score"><span>${label}</span><b>${score.score.toFixed(1)} <em>${escape(score.grade)}</em></b><small>\u6709\u6548\u8BCD\u6761 ${score.effectiveRolls.toFixed(1)}${score.mainOk ? "" : " \xB7 \u4E3B\u8BCD\u6761\u4E0D\u5339\u914D"}</small></div>`;
  }
  return "";
}
__name(scoreHtml, "scoreHtml");
function relicCard(relic) {
  return `<div class="relic">
    <div class="relic-head">${image(relic.icon, "relic-icon")}<div><strong>${escape(relic.name)}</strong><small>${escape(relic.slot)}${relic.level ? ` \xB7 +${escape(relic.level)}` : ""}${relic.rarity ? ` \xB7 \u2605${escape(relic.rarity)}` : ""}${relic.setName ? ` \xB7 ${escape(relic.setName)}` : ""}</small></div></div>
    <div class="main-affix">${relic.mainIcon ? image(relic.mainIcon, "stat-icon") : ""}<span>${escape(relic.main?.name || "\u4E3B\u8BCD\u6761\u672A\u77E5")}</span><b>${escape(relic.main?.value || "-")}</b></div>
    <div class="sub-affixes">${affixList(relic.subStats)}</div>
    ${relic.score?.status === "supported" ? scoreHtml(relic.score) : ""}
  </div>`;
}
__name(relicCard, "relicCard");
function traceHtml(trace, main) {
  const active = main || trace.active === true;
  return `<div class="trace-node ${main ? "trace-main" : trace.category === "major" ? "trace-major" : "trace-minor"} ${active ? "is-active" : "is-inactive"}" title="${escape(trace.name)} \xB7 ${active ? "\u5DF2\u6FC0\u6D3B" : "\u672A\u6FC0\u6D3B"}"><div class="trace-medallion">${image(trace.icon, "trace-art")}${main ? `<b class="trace-level">${escape(trace.level || "-")}</b>` : ""}</div>${main ? `<strong class="trace-label">${escape(trace.label || trace.type || "\u6280\u80FD")}</strong>` : ""}<span class="trace-name">${escape(trace.name)}</span><span class="trace-status">${active ? "\u5DF2\u6FC0\u6D3B" : "\u672A\u6FC0\u6D3B"}</span></div>`;
}
__name(traceHtml, "traceHtml");
function tracesHtml(traces) {
  if (!traces.length) return '<div class="muted">\u63A5\u53E3\u672A\u8FD4\u56DE\u884C\u8FF9\u6570\u636E</div>';
  const main = traces.filter((trace) => trace.category === "main" || !trace.category && /普攻|战技|终结技|天赋|秘技|欢愉技/.test(trace.type || trace.name));
  const others = traces.filter((trace) => !main.includes(trace));
  const major = others.filter((trace) => trace.category === "major");
  const minor = others.filter((trace) => trace.category !== "major");
  const order = ["\u666E\u653B", "\u6218\u6280", "\u7EC8\u7ED3\u6280", "\u5929\u8D4B", "\u6B22\u6109\u6280", "\u79D8\u6280"];
  main.sort((a, b) => {
    const index = /* @__PURE__ */ __name((trace) => {
      const result = order.indexOf(trace.label || trace.type || trace.name);
      return result < 0 ? order.length : result;
    }, "index");
    return index(a) - index(b);
  });
  return `<div class="trace-skills">${main.map((trace) => traceHtml(trace, true)).join("")}</div><div class="trace-branches">${major.length ? `<div class="trace-majors">${major.map((trace) => traceHtml(trace, false)).join("")}</div>` : ""}${minor.length ? `<div class="trace-minors">${minor.map((trace) => traceHtml(trace, false)).join("")}</div>` : ""}</div><div class="trace-legend"><i></i>\u5DF2\u6FC0\u6D3B <i class="dim"></i>\u672A\u6FC0\u6D3B</div>`;
}
__name(tracesHtml, "tracesHtml");
function characterHtml(character) {
  const stats = character.stats.length ? character.stats.map((item) => `<div class="stat">${character.statsIcon?.[item.name] ? image(character.statsIcon[item.name], "stat-icon") : ""}<span>${escape(item.name)}</span><b>${escape(item.value || "-")}</b></div>`).join("") : '<div class="muted">\u63A5\u53E3\u672A\u8FD4\u56DE\u89D2\u8272\u5C5E\u6027</div>';
  const statDetails = character.statDetails?.length ? `<div class="stat-details">${character.statDetails.map((item) => `<div class="stat-detail"><span>${escape(item.field)}</span><span>\u57FA\u7840 ${escape(item.base)}</span><span>\u52A0\u6210 ${escape(item.added)}</span><b>${escape(item.display || item.total)}</b></div>`).join("")}</div>` : "";
  const traces = tracesHtml(character.traces);
  const relics = character.relics.length ? character.relics.slice(0, 6).map(relicCard).join("") : '<div class="muted">\u63A5\u53E3\u672A\u8FD4\u56DE\u9057\u5668\u6570\u636E</div>';
  const cone = character.lightCone ? `<div class="equipment">${image(character.lightCone.icon, "equipment-icon")}<div><strong>${escape(character.lightCone.name)}</strong><small>${character.lightCone.level ? `Lv.${escape(character.lightCone.level)}` : "\u7B49\u7EA7\u672A\u77E5"}${character.lightCone.rank ? ` \xB7 \u53E0\u5F71 ${escape(character.lightCone.rank)}` : ""}${character.lightCone.path ? ` \xB7 ${escape(character.lightCone.path)}` : ""}</small></div></div>` : '<div class="muted">\u672A\u88C5\u5907\u5149\u9525</div>';
  return `<section class="character">
    <div class="hero"><div class="portrait">${image(character.image || character.icon, "character-image")}</div><div class="hero-info"><h2>${escape(character.name)}</h2><div class="tags">${character.level ? `<span>Lv.${escape(character.level)}</span>` : ""}${character.rank !== void 0 ? `<span>\u661F\u9B42 ${escape(character.rank)}</span>` : ""}${character.rarity ? `<span>\u2605${escape(character.rarity)}</span>` : ""}</div><div class="element">${character.elementIcon ? image(character.elementIcon, "type-icon") : ""}${character.pathIcon ? image(character.pathIcon, "type-icon") : ""}${escape([character.element, character.path].filter(Boolean).join(" \xB7 ") || "\u5C5E\u6027\u4FE1\u606F\u672A\u77E5")}</div></div></div>
    <div class="block"><h3>\u5149\u9525</h3>${cone}${character.lightCone?.stats?.length ? `<div class="cone-stats">${affixList(character.lightCone.stats)}</div>` : ""}</div><div class="block trace-block"><h3>\u884C\u8FF9</h3>${traces}</div>
    <div class="block"><h3>\u89D2\u8272\u5C5E\u6027</h3><div class="source-note">${character.calculatedStats?.length ? "\u6309\u7C73\u6E38\u793E\u88C5\u5907\u4E0E\u884C\u8FF9\u8BA1\u7B97\u5E38\u9A7B\u5C5E\u6027\uFF1B\u751F\u547D\uFF0F\u653B\u51FB\uFF0F\u9632\u5FA1\uFF1D\u89D2\u8272\u4E0E\u5149\u9525\u767D\u503C\u4E4B\u548C\xD7\uFF081\uFF0B\u767E\u5206\u6BD4\u52A0\u6210\uFF09\uFF0B\u56FA\u5B9A\u52A0\u6210\u3002" : "\u5C5E\u6027\u6765\u81EA\u9762\u677F\u63A5\u53E3\u3002"}</div><div class="stats">${stats}</div>${statDetails}</div>
    <div class="block"><h3>\u9057\u5668</h3>${scoreHtml(character.relicScore, true)}${character.relicScore ? '<div class="source-note">\u8BC4\u5206\u6765\u6E90\uFF1Afribbels hsr-optimizer \xB7 \u6709\u6548\u8BCD\u6761\u4E3A\u52A0\u6743\u8BCD\u6761\u6570\uFF0C\u8BC4\u5206\u4E3A\u8BE5\u90E8\u4F4D\u7406\u8BBA\u6EE1\u503C\u7684\u767E\u5206\u6BD4\u3002</div>' : ""}<div class="relics">${relics}</div></div>
  </section>`;
}
__name(characterHtml, "characterHtml");
function structuredHtml(row, data) {
  return `<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:24px;background:#111827;color:#f5f7fb;font-family:Arial,'Microsoft YaHei',sans-serif;width:820px}.sheet{background:linear-gradient(145deg,#1f2937,#111827);border:1px solid #46536b;border-radius:18px;padding:24px;box-shadow:0 14px 36px #0008}header{border-bottom:1px solid #53617a;padding-bottom:18px;margin-bottom:20px}h1{margin:0 0 8px;font-size:28px}h2{margin:0 0 12px;font-size:26px}h3{margin:0 0 14px;font-size:18px;color:#d9e4ff}h4{margin:14px 0 8px;color:#aebbd2;font-size:13px;font-weight:500}.meta,.muted,small{color:#aebbd2}.character{margin-bottom:28px}.hero{display:flex;gap:20px;align-items:center;margin-bottom:18px}.portrait{width:220px;height:220px;border-radius:14px;overflow:hidden;background:#29354a;border:1px solid #7384a7}.character-image{width:100%;height:100%;object-fit:cover}.placeholder{display:flex;align-items:center;justify-content:center;color:#9caac2;font-size:14px}.hero-info{flex:1}.tags{display:flex;gap:8px;flex-wrap:wrap}.tags span{padding:6px 10px;border-radius:999px;background:#3b4964;color:#e9efff}.element{margin-top:16px;color:#b9c8e5}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.block{background:#1b2537;border:1px solid #3a4862;border-radius:12px;padding:16px;margin-top:16px}.source-note{margin:-4px 0 12px;color:#aebbd2;font-size:12px}.equipment{display:flex;gap:12px;align-items:center}.equipment-icon,.relic-icon,.trace-icon{object-fit:cover;background:#2c3951;border-radius:8px}.equipment-icon{width:58px;height:58px}.relic-icon{width:48px;height:48px}.trace-icon{width:32px;height:32px}.stat-icon{width:18px;height:18px;object-fit:contain;flex:none}.type-icon{width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:4px}.equipment strong,.relic-head strong{display:block}.equipment small,.relic-head small{display:block;margin-top:7px}.cone-stats{display:grid;gap:5px;margin-top:10px}.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.stat,.trace,.affix{display:flex;align-items:center;gap:8px;padding:9px 10px;background:#263149;border-radius:8px}.stat span,.affix span,.trace span{flex:1}.stat b,.affix b,.trace b{color:#f5d78b}.stat-details{display:grid;gap:6px;margin-top:12px}.stat-detail{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;padding:7px 9px;background:#263149;border-radius:6px;color:#aebbd2;font-size:12px}.stat-detail b{color:#f5d78b}.traces{display:grid;gap:8px}.trace{padding:6px 8px}.trace em{font-style:normal;color:#9fb0cf;font-size:12px}.trace.active em{color:#9fe3b1}.relics{display:grid;grid-template-columns:1fr 1fr;gap:12px}.relic{background:#263149;border-radius:10px;padding:12px}.relic-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.main-affix{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #43516b;border-bottom:1px solid #43516b}.main-affix span{flex:1}.main-affix b{color:#f5d78b}.sub-affixes{display:grid;gap:5px;margin-top:8px}.affix{padding:5px 7px;font-size:13px}.affix em{font-style:normal;color:#9fb0cf;font-size:12px}.muted{padding:10px 0}.footer{margin-top:20px;color:#9eabc0;font-size:13px;text-align:right}
  .trace-block{background:radial-gradient(ellipse at 50% 0,#34405a88,transparent 75%),#192235}.trace-skills{display:flex;justify-content:space-around;gap:12px;padding:4px 0 18px;border-bottom:1px solid #43516b}.trace-node{text-align:center;min-width:0}.trace-main{flex:1;max-width:104px}.trace-medallion{position:relative;width:64px;height:64px;margin:0 auto 8px;border:2px solid #a69569;border-radius:50%;background:radial-gradient(circle,#625132,#201e24 76%);box-shadow:inset 0 0 0 4px #242431,0 0 0 1px #bcad7544;display:flex;align-items:center;justify-content:center}.trace-art{width:86%;height:86%;object-fit:contain;border-radius:50%;font-size:10px}.trace-level{position:absolute;right:-5px;bottom:-3px;min-width:25px;height:25px;line-height:25px;border-radius:50%;background:#343944;color:white;font-size:15px;box-shadow:0 0 0 2px #192235}.trace-label{display:block;color:#e7dfcb;font-size:13px;margin-bottom:5px;font-weight:500}.trace-name{display:block;color:#bfc8d9;font-size:11px;line-height:1.45;overflow-wrap:anywhere}.trace-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.trace-branches{display:flex;gap:20px;align-items:flex-start;margin-top:16px}.trace-majors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;flex:0 0 38%}.trace-major .trace-medallion{width:54px;height:54px}.trace-minors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px 8px;flex:1}.trace-minor .trace-medallion{width:34px;height:34px;margin-bottom:5px}.trace-minor .trace-name{font-size:10px}.trace-node.is-inactive .trace-medallion{filter:grayscale(1) brightness(.45);opacity:.65;box-shadow:none}.trace-node.is-inactive .trace-name{color:#626e83}.trace-legend{display:flex;align-items:center;justify-content:flex-end;gap:7px;color:#8d9bb4;font-size:10px;margin-top:12px}.trace-legend i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e7d49e}.trace-legend i.dim{background:#4d5668}
  .trace-block{--trace-active:#e7d49e;--trace-inactive:#4d5668}.trace-node.is-active .trace-medallion{border-color:var(--trace-active);background:#4a412e;box-shadow:0 0 0 2px #e7d49e33,inset 0 0 0 2px #e7d49e44}.trace-node.is-active .trace-art{filter:sepia(1) saturate(1.3);opacity:1}.trace-node.is-inactive .trace-medallion{border-color:var(--trace-inactive);background:#303848;filter:none;opacity:1;box-shadow:none}.trace-node.is-inactive .trace-art{filter:grayscale(1) brightness(.5);opacity:.5}.trace-legend i{background:var(--trace-active)}.trace-legend i.dim{background:var(--trace-inactive)}.trace-medallion:after{content:'';position:absolute;right:-2px;top:-2px;width:7px;height:7px;border-radius:50%;background:var(--trace-active);box-shadow:0 0 0 2px #192235}.trace-node.is-inactive .trace-medallion:after{background:var(--trace-inactive)}.relic-score{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 0;color:#bfc8d9;border-top:1px solid #43516b;margin-top:10px}.relic-score b{margin-left:auto;color:#f5d78b;font-size:18px}.relic-score em{font-style:normal;font-size:13px;padding:3px 7px;border-radius:5px;background:#4a412e}.relic-score small{flex-basis:100%;font-size:11px}.score-note{color:#aebbd2;font-size:12px;margin:8px 0 12px}.score-note small{display:block;font-size:10px;margin-top:4px;overflow-wrap:anywhere}
  </style></head><body><div class="sheet"><header><h1>${escape(row.title)}</h1><div class="meta">${escape(data.game.toUpperCase())} \xB7 UID ${escape(data.uid)} \xB7 ${escape(data.server)}</div></header>${data.characters.map(characterHtml).join("")}<div class="footer">\u66F4\u65B0\u65F6\u95F4\uFF1A${escape(row.updatedAt)}</div></div></body></html>`;
}
__name(structuredHtml, "structuredHtml");
function renderHtml(ctx, html) {
  if (!ctx.puppeteer) throw new Error("\u9700\u8981\u542F\u7528 Koishi puppeteer \u670D\u52A1\u3002");
  return ctx.puppeteer.render(html, async (page, next) => {
    try {
      const failures = await page.evaluate(async () => {
        const images = Array.from(document.images);
        await Promise.all(images.map((image2) => image2.complete ? Promise.resolve() : new Promise((resolve) => {
          const done = /* @__PURE__ */ __name(() => {
            clearTimeout(timer);
            resolve();
          }, "done");
          const timer = setTimeout(done, 15e3);
          image2.addEventListener("load", done, { once: true });
          image2.addEventListener("error", done, { once: true });
        })));
        return images.filter((image2) => !image2.complete || image2.naturalWidth === 0).map((image2) => image2.src);
      });
      if (failures.length) throw new Error(`\u622A\u56FE\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF1A${failures.join("\u3001")}`);
      const body = await page.$("body");
      if (!body) throw new Error("\u622A\u56FE\u7ED3\u6784\u5316\u6E32\u67D3\u5931\u8D25\uFF1A\u672A\u627E\u5230 body\u3002");
      return next(body);
    } catch (error) {
      await page.close().catch(() => {
      });
      throw error;
    }
  });
}
__name(renderHtml, "renderHtml");
function createPanel(ctx) {
  ctx.model.extend("miyoushe_panel", {
    id: "string",
    platform: "string",
    userId: "string",
    game: "string",
    uid: "string",
    title: "string",
    lines: "text",
    data: "text",
    updatedAt: "string"
  }, { primary: "id" });
  return {
    async save(role, title, summary, data) {
      const lines = summary.split("\n").slice(0, 30).map((line) => line.slice(0, 120));
      const row = { id: role.id, platform: role.platform, userId: role.userId, game: role.game, uid: role.uid, title: title.slice(0, 80), lines: JSON.stringify(lines), data: data ? JSON.stringify(data) : void 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await ctx.database.upsert("miyoushe_panel", [row]);
      return row;
    },
    async get(platform, userId, role) {
      const [row] = await ctx.database.get("miyoushe_panel", { id: role.id, platform, userId });
      return row;
    },
    async remove(platform, userId, roles) {
      for (const role of roles) await ctx.database.remove("miyoushe_panel", { id: role.id, platform, userId });
    },
    async render(row) {
      if (!ctx.puppeteer) throw new Error("\u9700\u8981\u542F\u7528 Koishi puppeteer \u670D\u52A1\u3002");
      if (row.data) {
        const data = JSON.parse(row.data);
        return renderHtml(ctx, structuredHtml(row, data));
      }
      const lines = JSON.parse(row.lines).map((line) => `<li>${escape(line)}</li>`).join("");
      const html = `<html><head><meta charset="utf-8"><style>body{margin:0;padding:28px;background:#f5f7f8;color:#18252c;font-family:Arial,'Microsoft YaHei',sans-serif;width:680px;box-sizing:border-box}.sheet{background:white;border:1px solid #d9e0e4;padding:28px;border-radius:6px}h1{font-size:25px;margin:0 0 8px}header{border-bottom:2px solid #378e79;padding-bottom:18px}small{color:#53646d;font-size:14px}ul{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}li{border-bottom:1px solid #e8edef;padding:8px 0;font-size:15px;overflow-wrap:anywhere}</style></head><body><div class="sheet"><header><h1>${escape(row.title)}</h1><small>${escape(row.game.toUpperCase())} \xB7 UID ${escape(row.uid)} \xB7 ${escape(row.updatedAt)}</small></header><ul>${lines}</ul></div></body></html>`;
      return renderHtml(ctx, html);
    }
  };
}
__name(createPanel, "createPanel");

// src/automation.ts
async function runAutoPassport(passport, roles, date, accounts, attempted, active, signRole, runCommunitySign) {
  if (!passport.enabled || !passport.cookie || active.has(passport.id)) return;
  active.add(passport.id);
  try {
    for (const role of roles) {
      const previous = attempted.get(role.id);
      if (role.lastDay === date || previous?.date === date && previous.count >= 2) continue;
      const result = await signRole(role);
      attempted.set(role.id, { date, count: result.retry && previous?.date === date ? previous.count + 1 : result.retry ? 1 : 2 });
      if (passport.followMissions && passport.stoken && await accounts.markMissionDay(passport.platform, passport.userId, passport.ltuid, date, "follow")) {
        await runCommunitySign(role);
      }
    }
  } finally {
    active.delete(passport.id);
  }
}
__name(runAutoPassport, "runAutoPassport");

// src/data-cache.ts
var import_node_crypto4 = require("node:crypto");
function createStaticCache(ctx) {
  ctx.model.extend("miyoushe_static_cache", {
    id: "string",
    source: "string",
    version: "string",
    fetchedAt: "string",
    sha256: "string",
    payload: "text"
  }, { primary: "id" });
  const pending = /* @__PURE__ */ new Map();
  async function get(id) {
    const rows = await ctx.database.get("miyoushe_static_cache", { id });
    const row = rows[0];
    if (!row) return void 0;
    try {
      if ((0, import_node_crypto4.createHash)("sha256").update(row.payload).digest("hex") !== row.sha256) return void 0;
      return JSON.parse(row.payload);
    } catch {
      return void 0;
    }
  }
  __name(get, "get");
  async function put(id, source2, version, value) {
    const payload = JSON.stringify(value);
    await ctx.database.upsert("miyoushe_static_cache", [{
      id,
      source: source2,
      version,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sha256: (0, import_node_crypto4.createHash)("sha256").update(payload).digest("hex"),
      payload
    }]);
  }
  __name(put, "put");
  async function getOrFetch(id, fetcher) {
    const cached = await get(id);
    if (cached !== void 0) return cached;
    const running = pending.get(id);
    if (running) return running;
    const task = fetcher().then(async (result) => {
      await put(id, result.source, result.version, result.data);
      return result.data;
    }).catch(() => void 0).finally(() => pending.delete(id));
    pending.set(id, task);
    return task;
  }
  __name(getOrFetch, "getOrFetch");
  return { get, put, getOrFetch };
}
__name(createStaticCache, "createStaticCache");

// src/index.ts
var name = "miyoushe-sign";
var inject = ["database", "http", "puppeteer"];
var ConfigAccount = import_koishi.Schema.object({
  platform: import_koishi.Schema.string().default("onebot"),
  userId: import_koishi.Schema.string().description("\u63A5\u6536\u7B7E\u5230\u7ED3\u679C\u7684\u7528\u6237 ID\u3002"),
  ltuid: import_koishi.Schema.string().description("\u7C73\u54C8\u6E38\u901A\u884C\u8BC1 ID\u3002"),
  cookie: import_koishi.Schema.string().role("secret").description("\u6E38\u620F CK\uFF0C\u5EFA\u8BAE\u586B\u5199\u5B8C\u6574 Cookie\u3002"),
  stoken: import_koishi.Schema.string().role("secret").description("\u793E\u533A SToken Cookie\uFF0C\u9700\u5305\u542B stuid/stoken/ltoken\u3002")
});
var Config = import_koishi.Schema.object({
  encryptionKey: import_koishi.Schema.string().role("secret").description("\u51ED\u8BC1\u52A0\u5BC6\u5BC6\u94A5\uFF0C\u9700\u4E3A 32 \u5B57\u8282\u968F\u673A\u5BC6\u94A5\u7684 Base64\uFF1B\u7559\u7A7A\u5219\u4EC5\u672C\u6B21\u8FD0\u884C\u968F\u673A\u751F\u6210\u3002").default(process.env.MIYOUSHE_SIGN_KEY || ""),
  accounts: import_koishi.Schema.array(ConfigAccount).default([]).description("\u542F\u52A8\u65F6\u5BFC\u5165\u7684\u7C73\u6E38\u793E\u8D26\u53F7\u51ED\u8BC1\u3002"),
  timeout: import_koishi.Schema.natural().role("ms").default(12e3),
  interval: import_koishi.Schema.natural().role("ms").min(2e3).default(3e3),
  hour: import_koishi.Schema.number().min(0).max(23).step(1).default(9)
});
var forumNames = Object.keys(forums);
var gameNames = Object.keys(games);
var passportId = /^\d{1,20}$/;
async function renderQr(ctx, url) {
  if (!ctx.puppeteer) return url;
  const escaped = url.replace(/[&<>"]/g, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[value]);
  const image2 = await import_qrcode.default.toDataURL(url, { width: 360, margin: 0 });
  const html = `<html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#f5f7f8;font-family:Arial,'Microsoft YaHei',sans-serif;width:520px;box-sizing:border-box}.card{background:#fff;border:1px solid #d9e0e4;border-radius:12px;padding:24px;text-align:center}.title{font-size:22px;font-weight:700;color:#18252c;margin-bottom:16px}.qr{display:inline-block;padding:18px;background:#fff;border:1px solid #e4e9ec;border-radius:8px}.qr img{display:block;width:360px;height:360px}.url{margin-top:16px;color:#53646d;font-size:12px;line-height:1.5;overflow-wrap:anywhere}</style></head><body><div class="card"><div class="title">\u7C73\u6E38\u793E\u626B\u7801\u767B\u5F55</div><div class="qr"><img src="${image2}"></div><div class="url">${escaped}</div></div></body></html>`;
  return ctx.puppeteer.render(html, async (page, next) => {
    return next(await page.$("body"));
  });
}
__name(renderQr, "renderQr");
function identity(session) {
  return session.isDirect && session.platform && session.userId ? [session.platform, session.userId] : void 0;
}
__name(identity, "identity");
function day() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(/* @__PURE__ */ new Date());
  const part = /* @__PURE__ */ __name((name2) => parts.find((item) => item.type === name2)?.value || "", "part");
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}
__name(day, "day");
function apply(ctx, config) {
  const key = config.encryptionKey ? (() => {
    if (Buffer.from(config.encryptionKey, "base64").length !== 32) throw new Error("encryptionKey \u5FC5\u987B\u662F 32 \u5B57\u8282\u968F\u673A\u5BC6\u94A5\u7684 Base64\u3002");
    return config.encryptionKey;
  })() : (0, import_node_crypto5.randomBytes)(32).toString("base64");
  const accounts = createAccounts(ctx, key);
  const legacy = createVault(ctx, key);
  const client = createClient(ctx, config.timeout, config.interval);
  const cache = createStaticCache(ctx);
  const records = createRecords(client, cache);
  const panel = createPanel(ctx);
  const running = /* @__PURE__ */ new Set();
  const attempted = /* @__PURE__ */ new Map();
  const autoRunning = /* @__PURE__ */ new Set();
  const communityRunning = /* @__PURE__ */ new Set();
  const qrRunning = /* @__PURE__ */ new Set();
  function panelSummary(data) {
    return data.characters.map((character) => [
      `\u89D2\u8272\uFF1A${character.name}`,
      character.level ? `\u7B49\u7EA7\uFF1A${character.level}` : "",
      character.rank ? `\u661F\u9B42\uFF1A${character.rank}` : "",
      character.lightCone ? `\u5149\u9525\uFF1A${character.lightCone.name}${character.lightCone.level ? ` Lv.${character.lightCone.level}` : ""}` : "",
      ...character.stats.slice(0, 12).map((item) => `${item.name}\uFF1A${item.value || "-"}`),
      ...character.relics.slice(0, 6).map((item) => `${item.slot}\uFF1A${item.name}${item.level ? ` +${item.level}` : ""}`)
    ].filter(Boolean).join("\n")).join("\n\n");
  }
  __name(panelSummary, "panelSummary");
  ctx.on("ready", async () => {
    for (const item of config.accounts || []) {
      if (!item.userId || !/^\d{1,20}$/.test(item.ltuid) || !item.cookie && !item.stoken) {
        ctx.logger.warn("\u7C73\u6E38\u793E\u914D\u7F6E\u8D26\u53F7\u7F3A\u5C11\u6709\u6548\u7684 userId\u3001ltuid \u6216\u51ED\u8BC1\uFF0C\u5DF2\u8DF3\u8FC7\u3002");
        continue;
      }
      try {
        let ltuid = item.ltuid;
        if (item.cookie) {
          const parsed = parseCookie(item.cookie, "ck");
          if (parsed.ltuid !== ltuid) throw new Error("Cookie \u4E2D\u7684\u901A\u884C\u8BC1 ID \u4E0E\u914D\u7F6E\u4E0D\u4E00\u81F4\u3002");
          const roles = await client.discover(parsed.cookie);
          if (!roles.length) throw new Error("Cookie \u672A\u67E5\u8BE2\u5230\u6E38\u620F\u89D2\u8272\u3002");
          await accounts.save(item.platform, item.userId, ltuid, parsed.cookie, roles);
        }
        if (item.stoken) {
          const parsed = parseCookie(item.stoken, "stoken");
          if (parsed.ltuid !== ltuid) throw new Error("SToken \u4E2D\u7684\u901A\u884C\u8BC1 ID \u4E0E\u914D\u7F6E\u4E0D\u4E00\u81F4\u3002");
          await accounts.saveToken(item.platform, item.userId, ltuid, parsed.cookie);
        }
        ctx.logger.info(`\u7C73\u6E38\u793E\u914D\u7F6E\u8D26\u53F7 ${item.platform}:${item.userId}/${ltuid} \u5DF2\u5BFC\u5165\u3002`);
      } catch (error) {
        ctx.logger.warn(`\u7C73\u6E38\u793E\u914D\u7F6E\u8D26\u53F7 ${item.platform}:${item.userId}/${item.ltuid} \u5BFC\u5165\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u51ED\u8BC1\u65E0\u6548"}\u3002`);
      }
    }
  });
  async function refreshDevice(platform, userId, ltuid, region) {
    const row = await accounts.passport(platform, userId, ltuid);
    if (!row) return void 0;
    return accounts.device(platform, userId, ltuid, async (device) => {
      const current = device || { deviceId: (0, import_node_crypto5.randomUUID)().replace(/-/g, ""), deviceFp: "" };
      if (current.deviceFp && row.fpExpires && Number(row.fpExpires) > Date.now()) return current;
      try {
        const fp = await accounts.use(platform, userId, ltuid, "ck", (cookie) => client.fingerprint(current.deviceId, !(region.startsWith("cn_") || region.endsWith("_cn")), cookie));
        const updated = { deviceId: current.deviceId, deviceFp: fp };
        await accounts.saveFingerprint(platform, userId, ltuid, updated);
        if (process.env.MIYOUSHE_DEBUG_RECORD === "1") ctx.logger.info(`[record-debug] fingerprint refreshed region=${region} fp=present`);
        return updated;
      } catch (error) {
        if (process.env.MIYOUSHE_DEBUG_RECORD === "1") ctx.logger.warn(`[record-debug] fingerprint refresh failed region=${region}`);
        throw new Error(`\u8BBE\u5907\u6307\u7EB9\u5237\u65B0\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u8BF7\u91CD\u65B0\u7ED1\u5B9A Cookie \u540E\u91CD\u8BD5\u3002"}`);
      }
    });
  }
  __name(refreshDevice, "refreshDevice");
  async function signRole(role) {
    if (running.has(role.id)) return { text: `${role.game} ${role.uid}\uFF1A\u6B63\u5728\u7B7E\u5230\u3002`, retry: false };
    running.add(role.id);
    try {
      const result = await accounts.use(role.platform, role.userId, role.ltuid, "ck", async (cookie) => client.game(role, cookie, role.game, await refreshDevice(role.platform, role.userId, role.ltuid, role.region)));
      if (result.done) await accounts.mark(role, day().date);
      return { text: `${role.game} ${role.uid}\uFF1A${result.text}`, retry: false };
    } catch {
      return { text: `${role.game} ${role.uid}\uFF1A\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u51ED\u8BC1\u6216\u7F51\u7EDC\u3002`, retry: true };
    } finally {
      running.delete(role.id);
    }
  }
  __name(signRole, "signRole");
  async function signCommunity(platform, userId, ltuid, all) {
    try {
      return await accounts.use(platform, userId, ltuid, "stoken", (token) => accounts.device(platform, userId, ltuid, async (device) => {
        const output = [];
        for (const forum of all ? forumNames : ["gs"]) {
          try {
            output.push((await client.forum(token, forum, device)).text);
          } catch {
            output.push(`${forum}\u793E\u533A\uFF1A\u8BF7\u6C42\u5931\u8D25\u3002`);
          }
        }
        return output.join("\n");
      }));
    } catch {
      return "\u793E\u533A\u7B7E\u5230\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 SToken \u6216\u7F51\u7EDC\u3002";
    }
  }
  __name(signCommunity, "signCommunity");
  ctx.command("mys.bind <credential:text>", "\u79C1\u804A\u7ED1\u5B9A\u901A\u884C\u8BC1 Cookie \u5E76\u81EA\u52A8\u53D1\u73B0\u6E38\u620F\u89D2\u8272").action(async ({ session }, credential) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u5141\u8BB8\u5728\u79C1\u804A\u4E2D\u7ED1\u5B9A\u51ED\u8BC1\u3002";
    try {
      const { ltuid, cookie } = parseCookie(credential || "", "ck");
      const roles = await client.discover(cookie);
      if (!roles.length) return "Cookie \u65E0\u6548\u6216\u672A\u67E5\u8BE2\u5230\u5DF2\u7ED1\u5B9A\u7684\u6E38\u620F\u89D2\u8272\uFF0C\u672A\u4FDD\u5B58\u3002";
      await accounts.save(...owner, ltuid, cookie, roles);
      return `\u901A\u884C\u8BC1 ${ltuid} \u5DF2\u7ED1\u5B9A\uFF1A${roles.map((role) => `${role.game} ${role.uid}`).join("\u3001")}\u3002\u8BF7\u5220\u9664\u539F\u59CB\u79C1\u804A\u6D88\u606F\u3002`;
    } catch {
      return "\u7ED1\u5B9A\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u5B8C\u6574 Cookie\u3001\u6570\u5B57\u901A\u884C\u8BC1 ID \u53CA\u7F51\u7EDC\u3002";
    }
  });
  ctx.command("mys.qr", "\u79C1\u804A\u626B\u7801\u767B\u5F55\u5E76\u7ED1\u5B9A\u901A\u884C\u8BC1").action(async ({ session }) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u652F\u6301\u79C1\u804A\u626B\u7801\u767B\u5F55\u3002";
    const ownerKey = `${owner[0]}:${owner[1]}`;
    if (qrRunning.has(ownerKey)) return "\u5DF2\u6709\u626B\u7801\u6B63\u5728\u7B49\u5F85\u786E\u8BA4\u3002";
    qrRunning.add(ownerKey);
    try {
      const { url, ticket } = await client.qrCreate();
      const qrMessage = await renderQr(ctx, url);
      await session.send(`${qrMessage}
\u8BF7\u7528\u7C73\u6E38\u793E\u5B98\u65B9\u5BA2\u6237\u7AEF\u626B\u63CF\u5E76\u786E\u8BA4\uFF0C\u4E8C\u7EF4\u7801\u7EA6 100 \u79D2\u540E\u5931\u6548\u3002`);
      let scanned = false;
      for (let count = 0; count < 19; count++) {
        await new Promise((resolve) => setTimeout(resolve, 5e3));
        const result = await client.qrStatus(ticket);
        if (result.retcode !== 0) {
          ctx.logger.warn(`\u626B\u7801\u72B6\u6001\u67E5\u8BE2\u5931\u8D25\uFF1Aretcode=${result.retcode} message=${result.message || "-"}`);
          return `\u626B\u7801\u72B6\u6001\u67E5\u8BE2\u5931\u8D25\uFF08${result.retcode}\uFF09\uFF1A${result.message || "\u8BF7\u91CD\u65B0\u53D1\u8D77\u3002"}`;
        }
        if (result.data?.status === "Scanned") {
          if (!scanned) await session.send("\u4E8C\u7EF4\u7801\u5DF2\u626B\u63CF\uFF0C\u8BF7\u5728\u7C73\u6E38\u793E\u624B\u673A\u5BA2\u6237\u7AEF\u786E\u8BA4\u767B\u5F55\u3002");
          scanned = true;
          continue;
        }
        if (result.data?.status !== "Confirmed") continue;
        const tokens = result.data.tokens;
        const info = result.data.user_info;
        const stoken = Array.isArray(tokens) && typeof tokens[0]?.token === "string" ? tokens[0].token : void 0;
        const ltuid = info && typeof info === "object" ? String(info.aid || "") : "";
        const mid = info && typeof info === "object" ? String(info.mid || "") : "";
        if (!stoken || !/^\d{1,20}$/.test(ltuid) || !mid) return "\u626B\u7801\u8FD4\u56DE\u7684\u8D26\u53F7\u4FE1\u606F\u4E0D\u5B8C\u6574\uFF0C\u672A\u4FDD\u5B58\u3002";
        const ltoken = await client.qrExchange(stoken, mid);
        const token = `stuid=${ltuid};stoken=${stoken};mid=${mid};ltoken=${ltoken};`;
        const cookie = await client.exchangeCookie(token, ltuid);
        const roles = await client.discover(cookie);
        if (!roles.length) return "\u5DF2\u786E\u8BA4\u626B\u7801\uFF0C\u4F46\u672A\u67E5\u8BE2\u5230\u6E38\u620F\u89D2\u8272\uFF0C\u672A\u4FDD\u5B58\u51ED\u8BC1\u3002";
        await accounts.save(...owner, ltuid, cookie, roles);
        await accounts.saveToken(...owner, ltuid, token);
        return `\u901A\u884C\u8BC1 ${ltuid} \u5DF2\u7ED1\u5B9A\uFF1A${roles.map((role) => `${role.game} ${role.uid}`).join("\u3001")}\u3002`;
      }
      return "\u626B\u7801\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u3002";
    } catch (error) {
      ctx.logger.warn(`\u626B\u7801\u767B\u5F55\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u672A\u77E5\u9519\u8BEF"}`);
      return `\u626B\u7801\u767B\u5F55\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u8BF7\u68C0\u67E5\u5E73\u53F0\u8D26\u53F7\u72B6\u6001\u540E\u91CD\u8BD5\u3002"}`;
    } finally {
      qrRunning.delete(ownerKey);
    }
  });
  ctx.command("mys.refresh <ltuid:string>", "\u4F7F\u7528\u5DF2\u7ED1\u5B9A SToken \u5237\u65B0\u6E38\u620F CK").action(async ({ session }, ltuid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.refresh \u901A\u884C\u8BC1ID\u3002";
    try {
      const roles = (await accounts.roles(...owner)).filter((role) => role.ltuid === ltuid);
      const biz = roles.some((role) => role.region.startsWith("cn_") || role.region.endsWith("_cn")) ? "hk4e_cn" : "hk4e_global";
      const cookie = await accounts.use(...owner, ltuid, "stoken", (token) => client.exchangeCookie(token, ltuid, biz));
      const discovered = await client.discover(cookie);
      if (!discovered.length) return "\u65B0 CK \u672A\u901A\u8FC7\u89D2\u8272\u9A8C\u8BC1\uFF0C\u65E7 CK \u4FDD\u6301\u4E0D\u53D8\u3002";
      await accounts.save(...owner, ltuid, cookie, discovered);
      return `\u901A\u884C\u8BC1 ${ltuid} \u7684 CK \u5DF2\u5237\u65B0\uFF0C\u89D2\u8272\u5217\u8868\u5DF2\u540C\u6B65\u3002`;
    } catch {
      return "\u5237\u65B0\u5931\u8D25\uFF0C\u539F CK \u4FDD\u6301\u4E0D\u53D8\uFF1B\u8BF7\u68C0\u67E5 SToken \u662F\u5426\u6709\u6548\u3002";
    }
  });
  ctx.command("mys.device.fp <ltuid:string>", "\u83B7\u53D6\u5E76\u4FDD\u5B58\u901A\u884C\u8BC1\u8BBE\u5907\u6307\u7EB9").action(async ({ session }, ltuid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.device.fp \u901A\u884C\u8BC1ID\u3002";
    try {
      const roles = (await accounts.roles(...owner)).filter((role) => role.ltuid === ltuid);
      const device = await accounts.device(...owner, ltuid, async (current) => {
        const deviceId = current?.deviceId || (0, import_node_crypto5.randomUUID)().replace(/-/g, "");
        const overseas = roles.length ? !(roles[0].region.startsWith("cn_") || roles[0].region.endsWith("_cn")) : false;
        const fp = await accounts.use(...owner, ltuid, "ck", (cookie) => client.fingerprint(deviceId, overseas, cookie));
        const next = { deviceId, deviceFp: fp };
        await accounts.saveFingerprint(...owner, ltuid, next);
        return next;
      });
      return device ? "\u8BBE\u5907\u6307\u7EB9\u5DF2\u52A0\u5BC6\u4FDD\u5B58\u5E76\u5173\u8054\u5230\u8BE5\u901A\u884C\u8BC1\u3002" : "\u83B7\u53D6\u8BBE\u5907\u6307\u7EB9\u5931\u8D25\u3002";
    } catch {
      return "\u8BBE\u5907\u6307\u7EB9\u83B7\u53D6\u5931\u8D25\uFF0C\u539F\u8BBE\u5907\u8D44\u6599\u4FDD\u6301\u4E0D\u53D8\u3002";
    }
  });
  ctx.command("mys.token <credential:text>", "\u79C1\u804A\u7ED1\u5B9A\u901A\u884C\u8BC1 SToken").action(async ({ session }, credential) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u5141\u8BB8\u5728\u79C1\u804A\u4E2D\u7ED1\u5B9A\u51ED\u8BC1\u3002";
    try {
      const { ltuid, cookie } = parseCookie(credential || "", "stoken");
      await accounts.saveToken(...owner, ltuid, cookie);
      return `\u901A\u884C\u8BC1 ${ltuid} \u7684\u793E\u533A\u51ED\u8BC1\u5DF2\u52A0\u5BC6\u4FDD\u5B58\u3002\u8BF7\u5220\u9664\u539F\u59CB\u79C1\u804A\u6D88\u606F\u3002`;
    } catch {
      return "SToken \u683C\u5F0F\u65E0\u6548\uFF1B\u9700\u5305\u542B stuid\u3001stoken\u3001ltoken\u3002";
    }
  });
  ctx.command("mys.accounts", "\u67E5\u770B\u5DF2\u7ED1\u5B9A\u901A\u884C\u8BC1\u53CA\u6E38\u620F\u89D2\u8272").action(async ({ session }) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u652F\u6301\u79C1\u804A\u3002";
    const passports = await accounts.passports(...owner);
    const roles = await accounts.roles(...owner);
    return passports.length ? passports.map((row) => `${row.ltuid}\uFF08\u6E38\u620F\u81EA\u52A8${row.enabled ? "\u5F00\u542F" : "\u5173\u95ED"} / \u7C73\u6E38\u5E01\u5B9A\u65F6${row.communityEnabled ? "\u5F00\u542F" : "\u5173\u95ED"} / \u8DDF\u968F\u6E38\u620F${row.followMissions ? "\u5F00\u542F" : "\u5173\u95ED"}\uFF09
${roles.filter((role) => role.ltuid === row.ltuid).map((role) => `  ${role.game} ${role.uid} ${role.region}${role.current ? " \u5F53\u524D" : ""}`).join("\n")}`).join("\n") : "\u5C1A\u672A\u7ED1\u5B9A\u901A\u884C\u8BC1\u3002";
  });
  ctx.command("mys.uid <game:string> <uid:string>", "\u5207\u6362\u5F53\u524D\u6E38\u620F UID").action(async ({ session }, game, uid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !gameNames.includes(game) || !passportId.test(uid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.uid \u6E38\u620F\u4EE3\u53F7 UID\u3002";
    return await accounts.choose(...owner, game, uid) ? `${game} \u5F53\u524D UID \u5DF2\u5207\u6362\u4E3A ${uid}\u3002` : "\u8BE5 UID \u4E0D\u5C5E\u4E8E\u4F60\u5DF2\u7ED1\u5B9A\u7684\u901A\u884C\u8BC1\u3002";
  });
  ctx.command("mys.remove <ltuid:string>", "\u5220\u9664\u901A\u884C\u8BC1\u53CA\u5176\u6E38\u620F\u89D2\u8272").action(async ({ session }, ltuid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.remove \u901A\u884C\u8BC1ID\u3002";
    const roles = (await accounts.roles(...owner)).filter((role) => role.ltuid === ltuid);
    if (!await accounts.remove(...owner, ltuid)) return "\u672A\u627E\u5230\u6E38\u620F CK\u3002";
    await panel.remove(...owner, roles);
    return "\u6E38\u620F CK\u3001\u8BBE\u5907\u3001\u89D2\u8272\u53CA\u9762\u677F\u5FEB\u7167\u5DF2\u5220\u9664\uFF1B\u72EC\u7ACB\u7ED1\u5B9A\u7684 SToken \u4E0D\u53D7\u5F71\u54CD\u3002";
  });
  ctx.command("mys.token.remove <ltuid:string>", "\u5220\u9664\u901A\u884C\u8BC1\u7684\u793E\u533A SToken").action(async ({ session }, ltuid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.token.remove \u901A\u884C\u8BC1ID\u3002";
    return await accounts.removeToken(...owner, ltuid) ? "SToken \u5DF2\u5220\u9664\uFF0C\u6E38\u620F CK \u4E0D\u53D7\u5F71\u54CD\u3002" : "\u672A\u627E\u5230\u8BE5 SToken\u3002";
  });
  ctx.command("mys.auto <ltuid:string> <state:string>", "\u542F\u505C\u5F53\u524D\u901A\u884C\u8BC1\u6E38\u620F\u81EA\u52A8\u7B7E\u5230").action(async ({ session }, ltuid, state) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "") || !["on", "off"].includes(state)) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.auto \u901A\u884C\u8BC1ID on|off\u3002";
    return await accounts.setEnabled(...owner, ltuid, state === "on") ? "\u81EA\u52A8\u7B7E\u5230\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002" : "\u672A\u627E\u5230\u8BE5\u901A\u884C\u8BC1\u3002";
  });
  ctx.command("mys.community.auto <ltuid:string> <state:string>", "\u542F\u505C\u72EC\u7ACB\u5B9A\u65F6\u793E\u533A\u7B7E\u5230").action(async ({ session }, ltuid, state) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "") || !["on", "off"].includes(state)) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.community.auto \u901A\u884C\u8BC1ID on|off\u3002";
    return await accounts.setCommunityEnabled(...owner, ltuid, state === "on") ? `\u793E\u533A\u72EC\u7ACB\u5B9A\u65F6\u7B7E\u5230\u5DF2${state === "on" ? "\u5F00\u542F\uFF0C\u8DDF\u968F\u6A21\u5F0F\u5DF2\u5173\u95ED" : "\u5173\u95ED"}\u3002` : "\u672A\u627E\u5230\u8BE5\u901A\u884C\u8BC1\u7684 SToken\u3002";
  });
  ctx.command("mys.community.follow <ltuid:string> <state:string>", "\u542F\u505C\u8DDF\u968F\u6E38\u620F\u7B7E\u5230\u7684\u793E\u533A\u7B7E\u5230").action(async ({ session }, ltuid, state) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "") || !["on", "off"].includes(state)) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.community.follow \u901A\u884C\u8BC1ID on|off\u3002";
    return await accounts.setFollowMissions(...owner, ltuid, state === "on") ? `\u8DDF\u968F\u6E38\u620F\u7684\u793E\u533A\u7B7E\u5230\u5DF2${state === "on" ? "\u5F00\u542F\uFF0C\u72EC\u7ACB\u5B9A\u65F6\u5DF2\u5173\u95ED" : "\u5173\u95ED"}\u3002` : "\u672A\u627E\u5230\u8BE5\u901A\u884C\u8BC1\u7684 SToken\u3002";
  });
  ctx.command("mys.device.bind <ltuid:string> <deviceId:string> <deviceFp:string>", "\u7ED1\u5B9A\u5F53\u524D\u901A\u884C\u8BC1\u7684\u8BBE\u5907\u8D44\u6599").action(async ({ session }, ltuid, deviceId, deviceFp) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "") || !/^[a-zA-Z0-9_-]{8,128}$/.test(deviceId || "") || !/^[a-zA-Z0-9_-]{8,128}$/.test(deviceFp || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.device.bind \u901A\u884C\u8BC1ID \u8BBE\u5907ID \u8BBE\u5907\u6307\u7EB9\u3002";
    return await accounts.setDevice(...owner, ltuid, { deviceId, deviceFp }) ? "\u8BBE\u5907\u8D44\u6599\u5DF2\u52A0\u5BC6\u7ED1\u5B9A\u5230\u901A\u884C\u8BC1\uFF0C\u4F9B\u6240\u5C5E\u89D2\u8272\u8BF7\u6C42\u590D\u7528\u3002\u8BF7\u5220\u9664\u539F\u59CB\u6D88\u606F\u3002" : "\u672A\u627E\u5230\u8BE5\u901A\u884C\u8BC1\u3002";
  });
  ctx.command("mys.device.remove <ltuid:string>", "\u5220\u9664\u901A\u884C\u8BC1\u7684\u8BBE\u5907\u8D44\u6599").action(async ({ session }, ltuid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !passportId.test(ltuid || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.device.remove \u901A\u884C\u8BC1ID\u3002";
    return await accounts.setDevice(...owner, ltuid) ? "\u672C\u5730\u8BBE\u5907\u8D44\u6599\u5DF2\u5220\u9664\u3002" : "\u672A\u627E\u5230\u8BE5\u901A\u884C\u8BC1\u3002";
  });
  ctx.command("mys.sign [game:string]", "\u4E3A\u81EA\u5DF1\u7684\u6240\u6709\u6E38\u620F\u89D2\u8272\u7B7E\u5230\uFF0C\u53EF\u9650\u5B9A\u6E38\u620F").action(async ({ session }, game) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u652F\u6301\u79C1\u804A\u3002";
    if (game && !gameNames.includes(game)) return `\u6E38\u620F\u4EE3\u53F7\uFF1A${gameNames.join("\u3001")}\u3002`;
    const roles = (await accounts.roles(...owner)).filter((role) => !game || role.game === game);
    if (!roles.length) return "\u6CA1\u6709\u5DF2\u7ED1\u5B9A\u7684\u6E38\u620F\u89D2\u8272\u3002";
    const output = [];
    for (const role of roles) output.push((await signRole(role)).text);
    return output.join("\n");
  });
  ctx.command("mys.community [forum:string]", "\u793E\u533A\u7B7E\u5230\uFF0C\u9ED8\u8BA4\u539F\u795E\u5206\u533A").action(async ({ session }, forum) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner) return "\u4EC5\u652F\u6301\u79C1\u804A\u3002";
    const passports = (await accounts.passports(...owner)).filter((row) => row.stoken);
    if (!passports.length) return "\u5C1A\u672A\u7ED1\u5B9A SToken\u3002";
    if (forum && forum !== "all" && !Object.hasOwn(forums, forum)) return `\u793E\u533A\u4EE3\u53F7\uFF1A${forumNames.join("\u3001")}\u3001all\u3002`;
    const output = [];
    for (const row of passports) {
      try {
        if (forum && forum !== "all") {
          output.push(await accounts.use(...owner, row.ltuid, "stoken", (secret) => accounts.device(...owner, row.ltuid, (device) => client.forum(secret, forum, device).then((result) => result.text))));
        } else output.push(await signCommunity(...owner, row.ltuid, forum === "all"));
      } catch {
        output.push(`\u901A\u884C\u8BC1 ${row.ltuid}\uFF1A\u793E\u533A\u7B7E\u5230\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5B98\u65B9\u5BA2\u6237\u7AEF\u8D26\u53F7\u72B6\u6001\u3002`);
      }
    }
    return output.join("\n");
  });
  ctx.command("mys.record <game:string> <type:string> [uid:string] [period:string]", "\u67E5\u8BE2\u5F53\u524D\u6E38\u620F UID \u7684\u8BB0\u5F55").action(async ({ session }, game, type, uid, period) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !(game in recordTypes) || !type || !["1", "2", "3", void 0].includes(period)) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.record \u6E38\u620F\u4EE3\u53F7 \u7C7B\u578B [UID] [1|2|3]\u3002";
    const roles = (await accounts.roles(...owner)).filter((role2) => role2.game === game);
    if (["1", "2", "3"].includes(uid || "") && !period) {
      period = uid;
      uid = void 0;
    }
    const role = uid ? roles.find((role2) => role2.uid === uid) : roles.find((role2) => role2.current);
    if (!role) return "\u6CA1\u6709\u6B64\u6E38\u620F\u7684\u5F53\u524D UID \u6216\u6307\u5B9A UID \u672A\u7ED1\u5B9A\u3002";
    if (!Object.hasOwn(recordTypes[game], type)) return `\u53EF\u7528\u7C7B\u578B\uFF1A${Object.keys(recordTypes[game]).join("\u3001")}\u3002`;
    try {
      const summary = await accounts.use(...owner, role.ltuid, "ck", async (cookie) => records.query(role, cookie, type, period === "2" ? 2 : period === "3" ? 3 : 1, await refreshDevice(...owner, role.ltuid, role.region)));
      if (type !== "panel" || /失败|无法|未能|没有|不支持/.test(summary)) return summary;
      const structured = await accounts.use(...owner, role.ltuid, "ck", async (cookie) => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region)));
      if (typeof structured === "string") return structured;
      const snapshot = await panel.save(role, `${game === "gs" ? "\u539F\u795E" : "\u661F\u7A79\u94C1\u9053"}\u89D2\u8272\u9762\u677F`, panelSummary(structured), structured);
      try {
        return await panel.render(snapshot);
      } catch {
        return `${summary}
\u9762\u677F\u5FEB\u7167\u5DF2\u4FDD\u5B58\uFF0C\u4F46 Puppeteer \u6E32\u67D3\u4E0D\u53EF\u7528\u3002`;
      }
    } catch (error) {
      return `\u8BB0\u5F55\u67E5\u8BE2\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u8BF7\u68C0\u67E5\u51ED\u8BC1\u3001\u7F51\u7EDC\u4E0E\u6570\u636E\u516C\u5F00\u6743\u9650\u3002"}`;
    }
  });
  ctx.command("mys.character <game:string> <character:text> [uid:string]", "\u67E5\u8BE2\u6307\u5B9A\u89D2\u8272\u7684\u8BE6\u7EC6\u9762\u677F").action(async ({ session }, game, character, uid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !["gs", "sr"].includes(game) || !character?.trim()) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.character gs|sr \u89D2\u8272\u540D [UID]\u3002";
    const roles = (await accounts.roles(...owner)).filter((role2) => role2.game === game);
    const role = uid ? roles.find((item) => item.uid === uid) : roles.find((item) => item.current);
    if (!role) return "\u6CA1\u6709\u6B64\u6E38\u620F\u7684\u5F53\u524D UID \u6216\u6307\u5B9A UID \u672A\u7ED1\u5B9A\u3002";
    try {
      const structured = await accounts.use(...owner, role.ltuid, "ck", async (cookie) => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region), character.trim()));
      if (typeof structured === "string") return structured;
      const snapshot = await panel.save(role, `${game === "gs" ? "\u539F\u795E" : "\u661F\u7A79\u94C1\u9053"} ${character.trim()} \u89D2\u8272\u9762\u677F`, panelSummary(structured), structured);
      return await panel.render(snapshot);
    } catch (error) {
      return `\u89D2\u8272\u9762\u677F\u67E5\u8BE2\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u8BF7\u68C0\u67E5\u51ED\u8BC1\u3001\u7F51\u7EDC\u4E0E\u6570\u636E\u516C\u5F00\u6743\u9650\u3002"}`;
    }
  });
  ctx.command("mys.panel <game:string> [uid:string]", "\u67E5\u770B\u5DF2\u4FDD\u5B58\u7684\u56FE\u7247\u9762\u677F").action(async ({ session }, game, uid) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !["gs", "sr"].includes(game)) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.panel gs|sr [UID]\u3002";
    const roles = (await accounts.roles(...owner)).filter((role2) => role2.game === game);
    const role = uid ? roles.find((role2) => role2.uid === uid) : roles.find((role2) => role2.current);
    if (!role) return "\u6CA1\u6709\u5DF2\u7ED1\u5B9A\u7684\u6E38\u620F\u89D2\u8272\u3002";
    try {
      let snapshot = await panel.get(...owner, role);
      if (!snapshot) {
        const structured = await accounts.use(...owner, role.ltuid, "ck", async (cookie) => records.queryPanel(role, cookie, await refreshDevice(...owner, role.ltuid, role.region)));
        if (typeof structured === "string") return structured;
        snapshot = await panel.save(role, `${game === "gs" ? "\u539F\u795E" : "\u661F\u7A79\u94C1\u9053"}\u89D2\u8272\u9762\u677F`, panelSummary(structured), structured);
      }
      return await panel.render(snapshot);
    } catch (error) {
      return `\u9996\u6B21\u67E5\u8BE2\u6216\u9762\u677F\u6E32\u67D3\u5931\u8D25\uFF1A${error instanceof Error ? error.message : "\u8BF7\u68C0\u67E5\u51ED\u8BC1\u3001\u7F51\u7EDC\u3001\u6570\u636E\u516C\u5F00\u6743\u9650\u53CA Puppeteer \u670D\u52A1\u3002"}`;
    }
  });
  ctx.command("mys.migrate <slot:string>", "\u663E\u5F0F\u8FC1\u79FB\u65E7\u7248\u69FD\u4F4D\u51ED\u8BC1").action(async ({ session }, slot) => {
    if (!session) return;
    const owner = identity(session);
    if (!owner || !/^[a-zA-Z0-9_-]{1,32}$/.test(slot || "")) return "\u7528\u6CD5\uFF1A\u79C1\u804A mys.migrate \u65E7\u69FD\u4F4D\u3002";
    try {
      return await legacy.use(...owner, slot, async (cookie, row) => {
        if (row.kind === "community") return "\u65E7\u793E\u533A\u69FD\u4F4D\u4E0D\u80FD\u81EA\u52A8\u786E\u8BA4\u901A\u884C\u8BC1\uFF0C\u8BF7\u4F7F\u7528 mys.token \u91CD\u65B0\u7ED1\u5B9A\u3002";
        const { ltuid } = parseCookie(cookie, "ck");
        const roles = await client.discover(cookie);
        if (!roles.some((role) => role.game === row.kind && role.uid === row.uid && role.region === row.region)) return "\u65E7\u69FD\u4F4D\u4E0E\u5B98\u65B9\u89D2\u8272\u5217\u8868\u4E0D\u7B26\uFF0C\u672A\u8FC1\u79FB\u3002";
        await accounts.save(...owner, ltuid, cookie, roles);
        await legacy.useDevice(...owner, slot, async (device) => {
          if (device) await accounts.setDevice(...owner, ltuid, device);
        });
        return `\u5DF2\u8FC1\u79FB\u901A\u884C\u8BC1 ${ltuid}\uFF1B\u65E7\u69FD\u4F4D\u4ECD\u4FDD\u7559\uFF0C\u68C0\u67E5\u540E\u53EF\u624B\u52A8\u6E05\u7406\u3002`;
      });
    } catch {
      return "\u8FC1\u79FB\u5931\u8D25\uFF1A\u65E7\u51ED\u8BC1\u4E0D\u53EF\u8BFB\u3001\u65E0\u6548\u6216\u5C1A\u672A\u7ED1\u5B9A\u3002";
    }
  });
  ctx.setInterval(async () => {
    const now = day();
    if (now.hour < config.hour) return;
    try {
      for (const passport of await accounts.all()) {
        if (passport.enabled && passport.cookie) {
          const roles = (await accounts.roles(passport.platform, passport.userId)).filter((role) => role.ltuid === passport.ltuid);
          await runAutoPassport(passport, roles, now.date, accounts, attempted, autoRunning, signRole, async (role) => {
            try {
              await accounts.use(passport.platform, passport.userId, passport.ltuid, "stoken", (token) => accounts.device(passport.platform, passport.userId, passport.ltuid, (device) => client.forum(token, role.game, device)));
            } catch {
              ctx.logger.warn("\u8DDF\u968F\u6A21\u5F0F\u793E\u533A\u7B7E\u5230\u672A\u5B8C\u6210\u3002");
            }
          });
        }
        if (passport.communityEnabled && !passport.followMissions && passport.stoken && !communityRunning.has(passport.id)) {
          communityRunning.add(passport.id);
          try {
            if (await accounts.markMissionDay(passport.platform, passport.userId, passport.ltuid, now.date, "scheduled")) {
              await accounts.use(passport.platform, passport.userId, passport.ltuid, "stoken", (token) => accounts.device(passport.platform, passport.userId, passport.ltuid, (device) => client.forum(token, "gs", device)));
            }
          } catch {
            ctx.logger.warn("\u72EC\u7ACB\u5B9A\u65F6\u793E\u533A\u7B7E\u5230\u672A\u5B8C\u6210\u3002");
          } finally {
            communityRunning.delete(passport.id);
          }
        }
      }
    } catch {
      ctx.logger.warn("\u81EA\u52A8\u7B7E\u5230\u626B\u63CF\u5931\u8D25\u3002");
    }
  }, 60 * 60 * 1e3);
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});

/**
 * bili-api.mjs
 * ---------------------------------------------------------------------------
 * 极简 Bilibili 公开 Web API 客户端（含 WBI 签名），仅供本项目做资料核实使用。
 *
 * 设计原则：
 *   - 只读：仅调用公开接口获取昵称、UID、粉丝数、签名、公开投稿标题/简介/标签。
 *   - 不下载、不缓存、不重新发布任何头像、封面或视频内容。
 *   - 失败时重试并降级，绝不伪造数据；调用方需记录核实状态。
 *
 * WBI 签名算法参考 B 站 Web 端公开实现（mixinKey 重排 + 参数排序 + MD5）。
 */

import { createHash } from 'node:crypto';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class BiliClient {
  constructor() {
    this.cookie = '';
    this.wbiKeys = null;
  }

  /** 获取 buvid3 等基础 cookie，缺少时部分接口会拒绝。 */
  async bootstrap() {
    try {
      const res = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA } });
      this.#absorbCookies(res);
      // 访问一次空间页，通常能补齐 buvid4 / b_nut
      const res2 = await fetch('https://space.bilibili.com/2', { headers: { 'User-Agent': UA, Cookie: this.cookie } });
      this.#absorbCookies(res2);
      return this.cookie;
    } catch {
      return this.cookie;
    }
  }

  #absorbCookies(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const kv = c.split(';')[0];
      const name = kv.split('=')[0];
      if (!/^(buvid3|buvid4|b_nut|sid|DedeUserID|bili_ticket)$/.test(name)) continue;
      const re = new RegExp(`(^|;\\s*)${name}=`);
      if (re.test(this.cookie)) this.cookie = this.cookie.replace(new RegExp(`(^|;\\s*)${name}=[^;]*`), `$1${kv}`);
      else this.cookie += (this.cookie ? '; ' : '') + kv;
    }
  }

  async #raw(url, params) {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    const res = await fetch(u, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
        Cookie: this.cookie,
      },
    });
    this.#absorbCookies(res);
    const text = await res.text();
    if (!text) throw new Error('empty response body');
    return JSON.parse(text);
  }

  /** 带重试的接口调用。 */
  async get(url, params, { retries = 4 } = {}) {
    let last = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const data = await this.#raw(url, params);
        if (data.code === 0) return data;
        last = data;
        if (data.code === -352 || data.code === -412) {
          // 风控：等待并刷新一次 cookie
          await sleep(1500 * (i + 1));
          await this.bootstrap();
          continue;
        }
        return data;
      } catch (err) {
        last = { code: -1, message: err.message };
        await sleep(700 * (i + 1));
      }
    }
    return last ?? { code: -1, message: 'unknown failure' };
  }

  async #loadWbiKeys() {
    if (this.wbiKeys) return this.wbiKeys;
    const data = await this.get('https://api.bilibili.com/x/web-interface/nav', {});
    const img = data?.data?.wbi_img?.img_url || '';
    const sub = data?.data?.wbi_img?.sub_url || '';
    const pick = (s) => s.slice(s.lastIndexOf('/') + 1).split('.')[0];
    const raw = pick(img) + pick(sub);
    const mixin = MIXIN_KEY_ENC_TAB.map((i) => raw[i] ?? '').join('').slice(0, 32);
    this.wbiKeys = { imgKey: pick(img), subKey: pick(sub), mixinKey: mixin };
    return this.wbiKeys;
  }

  /** 带 WBI 签名的接口调用。 */
  async getSigned(url, params) {
    const { mixinKey } = await this.#loadWbiKeys();
    const wts = Math.floor(Date.now() / 1000);
    const merged = { ...params, wts };
    const sorted = Object.keys(merged)
      .sort()
      .map((k) => {
        const v = String(merged[k]).replace(/[!'()*]/g, '');
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      })
      .join('&');
    const w_rid = createHash('md5').update(sorted + mixinKey).digest('hex');
    return this.get(url, { ...merged, w_rid });
  }

  /** 用户搜索：用于从昵称定位真实 UID。 */
  async searchUser(keyword, page = 1) {
    const data = await this.get('https://api.bilibili.com/x/web-interface/search/type', {
      search_type: 'bili_user',
      keyword,
      page,
      page_size: 20,
    });
    if (data.code !== 0 || !data.data?.result) return [];
    return data.data.result.map((u) => ({
      mid: Number(u.mid),
      name: u.uname,
      fans: u.fans,
      videoCount: u.videos,
      sign: clean(u.usign),
      official: u.official_verify?.desc || '',
      level: u.level,
      source: `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(keyword)}`,
    }));
  }

  /** 空间公开资料（需要 WBI 签名，部分账号会触发风控）。 */
  async spaceAccInfo(mid) {
    const data = await this.getSigned('https://api.bilibili.com/x/space/wbi/acc/info', { mid });
    if (data.code !== 0) return { ok: false, code: data.code, message: data.message };
    const d = data.data;
    return {
      ok: true,
      mid: d.mid,
      name: d.name,
      sign: d.sign,
      level: d.level,
      official: d.official?.title || '',
      source: `https://api.bilibili.com/x/space/wbi/acc/info?mid=${mid}`,
    };
  }

  /** 公开卡片信息（含粉丝数），作为 acc/info 的降级方案。 */
  async cardInfo(mid) {
    const data = await this.get('https://api.bilibili.com/x/web-interface/card', { mid, photo: false });
    if (data.code !== 0) return { ok: false, code: data.code, message: data.message };
    return {
      ok: true,
      mid: data.data.card.mid,
      name: data.data.card.name,
      sign: data.data.card.sign,
      fans: data.data.follower,
      level: data.data.card.level_info?.current_level,
      official: data.data.card.Official?.title || '',
      source: `https://api.bilibili.com/x/web-interface/card?mid=${mid}`,
    };
  }

  /** 拉取最近投稿（WBI 签名版）。 */
  async spaceVideos(mid, ps = 30, pn = 1) {
    const data = await this.getSigned('https://api.bilibili.com/x/space/wbi/arc/search', {
      mid,
      ps: Math.min(50, ps),
      pn,
      order: 'pubdate',
      index: 0,
      tid: 0,
      platform: 'web',
      web_location: 1550101,
    });
    if (data.code !== 0 || !data.data?.list?.vlist) {
      return { ok: false, code: data.code, message: data.message, videos: [], total: null };
    }
    const videos = data.data.list.vlist.map((v) => ({
      bvid: v.bvid,
      title: clean(v.title),
      description: (v.description || '').slice(0, 400),
      tag: v.tag || '',
      tname: v.typename ?? v.tname ?? '',
      tid: v.typeid ?? v.tid ?? null,
      length: v.length,
      play: v.play,
      comment: v.comment,
      created: v.created,
      url: `https://www.bilibili.com/video/${v.bvid}`,
    }));
    return { ok: true, code: 0, total: data.data.page?.count ?? null, videos };
  }

  /** 获取头图/代表作式的 top 视频（用于补充内容画像，可选）。 */
  async topVideos(mid) {
    const data = await this.getSigned('https://api.bilibili.com/x/space/wbi/top/arc', { mid });
    if (data.code !== 0 || !Array.isArray(data.data)) return { ok: false, code: data.code, videos: [] };
    return {
      ok: true,
      videos: data.data.map((v) => ({
        bvid: v.bvid,
        title: clean(v.title),
        play: v.stat?.view,
        tname: v.tname,
        url: `https://www.bilibili.com/video/${v.bvid}`,
      })),
    };
  }
}

function clean(s) {
  return String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * 极简哈希路由
 * ---------------------------------------------------------------------------
 * 纯静态站点用哈希路由最省事：
 *   - 不需要服务端做 history fallback 配置
 *   - 部署到 Cloudflare Pages 时直接可用，不会 404
 *   - 分享链接形如 https://你的域名/#/result
 */

export type RouteName = 'home' | 'test' | 'result' | 'gallery' | 'up' | 'about' | 'settings' | 'not-found';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  /** 原始 hash，用于调试 */
  raw: string;
}

const ROUTES: Array<{ pattern: RegExp; name: RouteName; keys: string[] }> = [
  { pattern: /^\/?$/, name: 'home', keys: [] },
  { pattern: /^\/test\/?$/, name: 'test', keys: [] },
  { pattern: /^\/result\/?$/, name: 'result', keys: [] },
  { pattern: /^\/gallery\/?$/, name: 'gallery', keys: [] },
  { pattern: /^\/up\/([^/]+)\/?$/, name: 'up', keys: ['uid'] },
  { pattern: /^\/about\/?$/, name: 'about', keys: [] },
  { pattern: /^\/settings\/?$/, name: 'settings', keys: [] },
];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0] || '/';

  for (const route of ROUTES) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1] ?? '');
    });
    return { name: route.name, params, raw };
  }

  return { name: 'not-found', params: {}, raw };
}

export function currentRoute(): Route {
  return parseHash(window.location.hash);
}

export function navigate(path: string, options: { replace?: boolean; keepScroll?: boolean } = {}): void {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) {
    // 同样的地址：手动触发一次渲染
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (options.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'auto' });
}

export function routeHref(name: Exclude<RouteName, 'not-found'>, params?: Record<string, string>): string {
  switch (name) {
    case 'home':
      return '#/';
    case 'test':
      return '#/test';
    case 'result':
      return '#/result';
    case 'gallery':
      return '#/gallery';
    case 'about':
      return '#/about';
    case 'settings':
      return '#/settings';
    case 'up':
      return `#/up/${params?.uid ?? ''}`;
    default:
      return '#/';
  }
}

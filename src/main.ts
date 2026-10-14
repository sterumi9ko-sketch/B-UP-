import './styles/main.css';
import { siteConfig } from '@config';
import { state } from '@state';
import { createLayout, mountPage } from '@ui/layout';
import { create, toast } from '@ui/dom';
import { currentRoute, navigate, type RouteName } from '@ui/router';
import { renderHome } from '@pages/home';
import { renderTest } from '@pages/test';
import { renderResult } from '@pages/result';
import { renderGallery } from '@pages/gallery';
import { renderAbout } from '@pages/about';
import type { PageRenderer, PageResult } from '@ui/page-types';

/**
 * 应用入口
 * ---------------------------------------------------------------------------
 * 职责很窄：初始化状态、按路由挑选页面、挂载到 DOM、清理上一次页面。
 * 页面本身不关心路由怎么来，只负责把自己的内容画出来。
 */

const root = document.getElementById('app');
if (!root) throw new Error('找不到 #app 容器');

const layout = createLayout(root);

const pages: Record<Exclude<RouteName, 'not-found'>, PageRenderer> = {
  home: renderHome,
  test: renderTest,
  result: renderResult,
  gallery: renderGallery,
  up: renderGallery,
  about: renderAbout,
};

let currentCleanup: (() => void) | undefined;

function renderNotFound(): PageResult {
  const container = create('div', { class: 'container reading', style: 'margin: 0 auto; text-align: center;' }, [
    create('h1', { text: '页面走丢了' }),
    create('p', { class: 'text-soft', text: '这个地址没有对应的页面，可能是链接复制不完整。' }),
    create('div', { class: 'btn-row', style: 'justify-content: center;' }, [
      create('a', { class: 'btn', href: '#/', text: '回到首页' }),
      create('a', { class: 'btn btn--secondary', href: '#/gallery', text: '看看 UP 主图鉴' }),
    ]),
  ]);
  return { element: container };
}

function render(): void {
  // 清理上一个页面注册的事件监听
  currentCleanup?.();
  currentCleanup = undefined;

  const route = currentRoute();
  const renderer = route.name === 'not-found' ? undefined : pages[route.name];
  const result = renderer ? renderer({ route }) : renderNotFound();

  mountPage(layout.main, result.element);
  currentCleanup = result.cleanup;
  layout.updateActiveNav();

  // 标题随页面变化，方便分享和浏览器历史记录
  const titles: Record<string, string> = {
    home: siteConfig.name,
    test: `答题中 · ${siteConfig.name}`,
    result: `我的 UP 主匹配结果 · ${siteConfig.name}`,
    gallery: `UP 主图鉴 · ${siteConfig.name}`,
    up: `UP 主资料 · ${siteConfig.name}`,
    about: `关于测试 · ${siteConfig.name}`,
    'not-found': `页面不存在 · ${siteConfig.name}`,
  };
  document.title = titles[route.name] ?? siteConfig.name;
}

/** 首次进入时把上次的进度读回来 */
state.hydrate();

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
});

// 没有 hash 时补一个，保证路由状态一致
if (!window.location.hash) {
  navigate('/', { replace: true, keepScroll: true });
} else {
  render();
}

// 全局错误提示：出问题时给用户一个可操作的提示，而不是白屏
window.addEventListener('error', (event) => {
  console.error('[app] 未捕获错误', event.error ?? event.message);
  toast('页面出现了一点问题，可以刷新重试');
});

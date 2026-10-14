import { siteConfig } from '@config';
import { create } from '@ui/dom';
import { currentRoute, navigate, routeHref } from '@ui/router';

/**
 * 全站布局：顶部导航 + 主内容区 + 页脚 + 跳转主内容链接。
 * 导航用哈希路由，纯静态部署不需要任何服务端配置。
 */

export interface Layout {
  app: HTMLElement;
  main: HTMLElement;
  updateActiveNav: () => void;
}

const NAV_ITEMS = [
  { name: 'home', label: '开始测试' },
  { name: 'gallery', label: 'UP主图鉴' },
  { name: 'about', label: '关于测试' },
] as const;

export function createLayout(root: HTMLElement): Layout {
  root.innerHTML = '';

  const skipLink = create('a', { class: 'skip-link', href: '#main-content', text: '跳到主要内容' });

  const navLinks = NAV_ITEMS.map((item) =>
    create('a', {
      class: 'nav__link',
      href: routeHref(item.name),
      text: item.label,
      'data-route': item.name,
    }),
  );

  const nav = create('nav', { class: 'nav', 'aria-label': '主导航' }, navLinks);

  const header = create('header', { class: 'site-header' }, [
    create('div', { class: 'container' }, [
      create('div', { class: 'site-header__inner' }, [
        create('a', { class: 'brand', href: '#/' }, [
          create('span', { class: 'brand__mark', text: '动画区', 'aria-hidden': 'true' }),
          create('span', { class: 'brand__text' }, [
            create('span', { class: 'brand__name', text: '测测你是哪位动画区UP主' }),
            create('span', { class: 'brand__sub', text: '8 个创作风格维度 · 40 道题' }),
          ]),
        ]),
        nav,
      ]),
    ]),
  ]);

  const main = create('main', { class: 'site-main', id: 'main-content', tabindex: '-1' });

  const footer = create('footer', { class: 'site-footer' }, [
    create('div', { class: 'container reading' }, [
      create('p', { text: siteConfig.disclaimer }),
      create('p', { class: 'text-muted', text: '本站数据来自公开创作内容，不含任何 UP 主的私人信息；用户答题数据仅保存在你自己的浏览器中。' }),
    ]),
  ]);

  const app = create('div', { class: 'app' }, [skipLink, header, main, footer]);
  root.append(app);

  const updateActiveNav = () => {
    const route = currentRoute();
    const active = route.name === 'up' ? 'gallery' : route.name === 'result' ? 'home' : route.name;
    for (const link of navLinks) {
      const isActive = link.dataset.route === active;
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  // 导航链接用普通 hash 跳转即可，不需要拦截
  nav.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest('a');
    if (!target) return;
    // 让浏览器处理 hash 变化，同时保证滚动到顶部
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 0);
  });

  updateActiveNav();
  return { app, main, updateActiveNav };
}

/** 把新页面放进主区域，并触发进场动画 */
export function mountPage(main: HTMLElement, element: HTMLElement): void {
  main.innerHTML = '';
  element.classList.add('page-enter');
  main.append(element);
  main.focus({ preventScroll: true });
}

export { navigate };

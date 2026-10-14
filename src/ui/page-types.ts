import type { Route } from '@ui/router';

/**
 * 页面模块的统一接口。
 * 每个页面导出一个 render 函数：接收路由参数，返回要插入 <main> 的元素。
 * 需要做清理（例如移除事件监听、取消动画）时，返回一个 cleanup 函数。
 */
export interface PageContext {
  route: Route;
}

export interface PageResult {
  element: HTMLElement;
  cleanup?: () => void;
}

export type PageRenderer = (context: PageContext) => PageResult;

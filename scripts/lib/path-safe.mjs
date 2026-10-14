/**
 * 路径工具（不依赖 node:path）—— 纯 JavaScript，供 Node 脚本与 Vite 配置共用
 * ===========================================================================
 * 为什么不用 node:path：
 *
 * 本机 Node v24 (Windows) 实测，只要路径里含中文，node:path 就会算错，例如：
 *
 *   path.join('E:/PythonLearning/网站/src', '../core/storage')
 *     => 'E:\PythonLearning\网站\core\storage'   // 错误：把 src 这一层整个丢掉了
 *     正确结果应为 'E:\PythonLearning\网站\src\core\storage' 折叠后 = '网站/core/storage'
 *
 *   path.relative('E:/PythonLearning/网站/src', 'E:/PythonLearning/网站/core/x')
 *     => '..\core\x'                             // 错误：忽略了"网站"这一层
 *
 * 这类错误会连锁影响 TypeScript / Vite / Rollup 的模块解析，导致构建失败，
 * 典型报错是：Could not resolve "../core/storage" from "src/state.ts"。
 *
 * 因此这里用纯字符串运算实现需要的几个路径操作，行为与 Node 版本无关。
 * 约定：内部一律使用正斜杠 '/'。
 */

/** 统一分隔符为 '/'，并去掉重复斜杠 */
export function toPosix(value) {
  return String(value).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

/** 取目录部分（'a/b/c.ts' → 'a/b'） */
export function dirName(file) {
  const normalized = toPosix(file).replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

/** 取文件名部分 */
export function baseName(file) {
  const normalized = toPosix(file).replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

/**
 * 按段拼接并折叠 '.' 与 '..'。
 * 这是本文件存在的核心理由：不能交给 node:path。
 */
export function joinPath(base, relative) {
  const combined = [...(base ? toPosix(base).split('/') : []), ...toPosix(relative).split('/')];
  const out = [];

  for (const segment of combined) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
      continue;
    }
    out.push(segment);
  }

  return out.join('/');
}

/** 相对路径计算：把 target 表示成相对 from 的路径 */
export function relativePath(from, target) {
  const fromParts = toPosix(from).replace(/\/+$/, '').split('/');
  const targetParts = toPosix(target).split('/');

  let common = 0;
  while (common < fromParts.length && common < targetParts.length && fromParts[common] === targetParts[common]) {
    common++;
  }

  const ups = fromParts.length - common;
  return [...Array(ups).fill('..'), ...targetParts.slice(common)].join('/');
}

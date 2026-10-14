import { fileURLToPath } from 'node:url';
import { dirName, toPosix } from './scripts/lib/path-safe.mjs';

/**
 * 路径别名（Vite 与 Vitest 共用）
 * ===========================================================================
 * 为什么用别名而不是 "../.." 多级相对路径：
 *   本机 node:path 在含中文的路径上会算错（详见 scripts/lib/path-safe.mjs），
 *   连 path.join / path.resolve 都会丢掉中间目录，导致 Vite / Rollup / TypeScript
 *   解析多级相对路径失败，构建直接报错。
 *   别名由打包器直接映射成绝对路径，绕开这个问题，同时让导入更清晰。
 *
 * 注意：这里也用 path-safe 计算项目根目录，不使用 node:path。
 */
const configFile = toPosix(fileURLToPath(import.meta.url));
const projectRoot = dirName(configFile);
const src = `${projectRoot}/src`;

export const projectSrc = src;

export const aliasList = [
  { find: /^@config$/, replacement: `${src}/config.ts` },
  { find: /^@state$/, replacement: `${src}/state.ts` },
  { find: /^@core\//, replacement: `${src}/core/` },
  { find: /^@data\//, replacement: `${src}/data/` },
  { find: /^@ui\//, replacement: `${src}/ui/` },
  { find: /^@pages\//, replacement: `${src}/pages/` },
  { find: /^@share\//, replacement: `${src}/share/` },
  { find: /^@\//, replacement: `${src}/` },
];

/** 以对象形式返回，便于 tsconfig/vitest 复用 */
export const aliasMap = {
  '@config': `${src}/config.ts`,
  '@state': `${src}/state.ts`,
  '@core': `${src}/core`,
  '@data': `${src}/data`,
  '@ui': `${src}/ui`,
  '@pages': `${src}/pages`,
  '@share': `${src}/share`,
};

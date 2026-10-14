/**
 * 诊断：打印 7 种极端作答下的真实分数与距离
 * 用法：node scripts/diagnose-scores.mjs
 */
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const dir = join(root, '.tmp-diag');
await mkdir(dir, { recursive: true });
const entryFile = join(dir, 'entry.ts');
const outFile = join(dir, 'entry.mjs');

const aliasDir = (name) => join(root, 'src', name);
await writeFile(
  entryFile,
  `
  export { QUESTIONS } from '@data/questions';
  export { UPS, MATCHABLE_UPS } from '@data/ups';
  export { evaluateTest } from '@core/match';
  export { scoreTest, weightedEuclideanDistance, distanceToSimilarity } from '@core/scoring';
  export { DIMENSION_IDS } from '@core/dimensions';
  export { siteConfig } from '@config';
`,
  'utf8',
);

await build({
  entryPoints: [entryFile],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
  alias: {
    '@config': join(root, 'src', 'config.ts'),
    '@state': join(root, 'src', 'state.ts'),
    '@core': aliasDir('core'),
    '@data': aliasDir('data'),
    '@ui': aliasDir('ui'),
    '@pages': aliasDir('pages'),
    '@share': aliasDir('share'),
  },
});

const mod = await import(`file://${outFile.replace(/\\/g, '/')}`);
const { QUESTIONS, MATCHABLE_UPS, evaluateTest, scoreTest, distanceToSimilarity, DIMENSION_IDS, siteConfig } = mod;

console.log('match.maxDistance =', siteConfig.match.maxDistance, ' minSimilarity =', siteConfig.match.minSimilarity);
console.log('参与匹配的 UP 主数量 =', MATCHABLE_UPS.length);
console.log('');

function dot(level) {
  const answers = {};
  for (const q of QUESTIONS) answers[q.id] = level;
  return answers;
}

for (const level of [0, 1, 2, 3, 4, 5, 6]) {
  const answers = dot(level);
  const breakdown = scoreTest(QUESTIONS, answers);
  const outcome = evaluateTest(QUESTIONS, answers, MATCHABLE_UPS);
  const scores = DIMENSION_IDS.map((id) => Math.round(breakdown.normalized[id]));
  console.log(
    `level=${level}  维度分=[${scores.join(',')}]  最佳=${outcome.best.up.name}(${outcome.best.similarity})  距离=${outcome.best.distance}  ` +
      `前三=[${outcome.top3.map((m) => m.similarity).join(', ')}]`,
  );
}

// 用统一权重复算一次，看看和 evaluateTest 的差异来自哪里
console.log('');
console.log('对照：等权距离 → 相似指数');
for (const level of [0, 3, 6]) {
  const breakdown = scoreTest(QUESTIONS, dot(level));
  const distances = MATCHABLE_UPS.map((up) => weightedEuclideanDistance(breakdown.normalized, up.scores)).sort((a, b) => a - b);
  console.log(
    `  level=${level}  等权最近距离=${distances[0].toFixed(2)} → ${distanceToSimilarity(distances[0])}  ` +
      `最远=${distances[distances.length - 1].toFixed(2)} → ${distanceToSimilarity(distances[distances.length - 1])}`,
  );
}

// 加权距离（evaluateTest 内部使用的方式）
console.log('');
console.log('对照：加权距离（每题权重 1，维度权重 = 该维度题数）');
const weights = {};
for (const id of DIMENSION_IDS) weights[id] = 0;
for (const q of QUESTIONS) weights[q.dimension] += q.weight;
console.log('  维度权重 =', JSON.stringify(weights));
for (const level of [0, 3, 6]) {
  const breakdown = scoreTest(QUESTIONS, dot(level));
  const distances = MATCHABLE_UPS.map((up) => weightedEuclideanDistance(breakdown.normalized, up.scores, weights)).sort(
    (a, b) => a - b,
  );
  console.log(
    `  level=${level}  加权最近距离=${distances[0].toFixed(2)} → ${distanceToSimilarity(distances[0])}  ` +
      `最远=${distances[distances.length - 1].toFixed(2)} → ${distanceToSimilarity(distances[distances.length - 1])}`,
  );
}

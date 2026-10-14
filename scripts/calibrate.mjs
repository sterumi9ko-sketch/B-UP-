/**
 * calibrate.mjs
 * ---------------------------------------------------------------------------
 * 用真实的题目与 UP 主数据，统计「用户画像 ↔ UP 主画像」的加权欧氏距离分布，
 * 用来校准 src/config.ts 里的 match.maxDistance / minSimilarity，
 * 让「风格相似指数」在不同作答下有合理的区分度，而不是大量挤在下限。
 *
 * 用法：node scripts/calibrate.mjs
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

// 直接跑 TypeScript 比较麻烦，这里用 esbuild 先把需要的模块打包成临时 ESM 再导入
import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadModules() {
  const entry = `
    export { QUESTIONS } from '${__dirname.replace(/\\/g, '/')}/../src/data/questions.ts';
    export { UPS } from '${__dirname.replace(/\\/g, '/')}/../src/data/ups.ts';
    export { scoreTest, weightedEuclideanDistance } from '${__dirname.replace(/\\/g, '/')}/../src/core/scoring.ts';
    export { DIMENSION_IDS } from '${__dirname.replace(/\\/g, '/')}/../src/core/dimensions.ts';
  `;

  // 输出到项目内的临时目录（系统临时目录在部分环境下不可写）
  const dir = join(__dirname, '..', '.tmp-calibrate');
  await mkdir(dir, { recursive: true });
  const entryFile = join(dir, 'entry.ts');
  const outFile = join(dir, 'entry.mjs');
  await writeFile(entryFile, entry, 'utf8');

  await build({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
    alias: {
      '@config': join(__dirname, '..', 'src', 'config.ts'),
      '@state': join(__dirname, '..', 'src', 'state.ts'),
      '@core': join(__dirname, '..', 'src', 'core'),
      '@data': join(__dirname, '..', 'src', 'data'),
      '@ui': join(__dirname, '..', 'src', 'ui'),
      '@pages': join(__dirname, '..', 'src', 'pages'),
      '@share': join(__dirname, '..', 'src', 'share'),
    },
  });

  return import(`file://${outFile.replace(/\\/g, '/')}`);
}

function flat(questions, level) {
  const answers = {};
  for (const q of questions) answers[q.id] = level;
  return answers;
}

function zigzag(questions) {
  const answers = {};
  questions.forEach((q, i) => (answers[q.id] = i % 7));
  return answers;
}

const { QUESTIONS, UPS, scoreTest, weightedEuclideanDistance, DIMENSION_IDS } = await loadModules();

const matchable = UPS.filter((u) => u.matchable);
console.log(`参与匹配的 UP 主：${matchable.length} 位，题目：${QUESTIONS.length} 道\n`);

/** 收集所有「可能出现的用户画像」样本：7 种极端作答 + 若干混合规律 */
const samples = [];
for (const level of [0, 1, 2, 3, 4, 5, 6]) {
  const result = scoreTest(QUESTIONS, flat(QUESTIONS, level));
  samples.push({ name: `全选 level=${level}`, normalized: result.normalized });
}
samples.push({ name: '锯齿作答', normalized: scoreTest(QUESTIONS, zigzag(QUESTIONS)).normalized });

// 随机作答若干次，覆盖中间分布
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let n = 0; n < 200; n++) {
  const answers = {};
  for (const q of QUESTIONS) answers[q.id] = Math.floor(rand() * 7);
  samples.push({ name: `随机作答#${n}`, normalized: scoreTest(QUESTIONS, answers).normalized });
}

// UP 主之间的两两距离（作为"正常人之间差异"的参照）
const pairDistances = [];
for (let i = 0; i < matchable.length; i++) {
  for (let j = i + 1; j < matchable.length; j++) {
    pairDistances.push(weightedEuclideanDistance(matchable[i].scores, matchable[j].scores));
  }
}

// 每个样本到所有 UP 主的距离
const allDistances = [];
const perSampleBest = [];
for (const sample of samples) {
  const distances = matchable.map((up) => weightedEuclideanDistance(sample.normalized, up.scores));
  allDistances.push(...distances);
  const sorted = [...distances].sort((a, b) => a - b);
  perSampleBest.push({ name: sample.name, best: sorted[0], median: sorted[Math.floor(sorted.length / 2)], worst: sorted[sorted.length - 1] });
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

const stat = (values) => ({
  min: Math.min(...values).toFixed(1),
  p10: percentile(values, 10).toFixed(1),
  p50: percentile(values, 50).toFixed(1),
  p90: percentile(values, 90).toFixed(1),
  max: Math.max(...values).toFixed(1),
});

console.log('UP 主两两距离（画像之间的天然差异）：', stat(pairDistances));
console.log('用户 → UP 主 距离（全部样本 × 全部 UP 主）：', stat(allDistances));
console.log('每个用户样本的「最近 UP 主」距离分布：', stat(perSampleBest.map((s) => s.best)));
console.log('');

console.log('各样本的最佳匹配距离（决定分数上限体验）：');
for (const row of perSampleBest.slice(0, 8)) {
  console.log(`  ${row.name.padEnd(14)} 最近=${row.best.toFixed(1).padStart(6)}  中位=${row.median.toFixed(1).padStart(6)}  最远=${row.worst.toFixed(1).padStart(6)}`);
}
console.log('');

// 用不同的 maxDistance 预览相似指数分布
console.log('不同 maxDistance 下，「最佳匹配」的相似指数：');
for (const maxDistance of [100, 120, 140, 160, 180, 200]) {
  const scores = perSampleBest.map((s) => Math.max(30, Math.min(100, (1 - s.best / maxDistance) * 100)));
  const rounded = scores.map((s) => Math.round(s));
  console.log(
    `  maxDistance=${String(maxDistance).padStart(3)}  min=${Math.min(...rounded)}  p50=${percentile(rounded, 50)}  max=${Math.max(...rounded)}`,
  );
}
console.log('');

// 检查：全选同一档时，各 UP 主的分数是否出现大量并列
const agree = scoreTest(QUESTIONS, flat(QUESTIONS, 0));
const agreeDistances = matchable
  .map((up) => ({ name: up.name, d: weightedEuclideanDistance(agree.normalized, up.scores) }))
  .sort((a, b) => a.d - b.d);
console.log('「全部完全认同」作答下的距离排序（前 8 位，看是否出现并列）：');
for (const row of agreeDistances.slice(0, 8)) console.log(`  ${row.name.padEnd(12)} ${row.d.toFixed(2)}`);

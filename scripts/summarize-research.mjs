/**
 * summarize-research.mjs
 * ---------------------------------------------------------------------------
 * 读取 scripts/out/*.json 里每个 UP 主的核实记录，输出一份便于人工复核的摘要，
 * 同时做基础的内容方向判断（用于筛选"是否真的属于动画/番剧/二次元内容"）。
 *
 * 用法：node scripts/summarize-research.mjs
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');

/** 关键词 → 内容类型线索（只用于辅助判断，最终由人工复核） */
const ANIME_HINTS = [
  '动画', '番剧', '新番', '动漫', '二次元', '声优', '作画', '演出', '分镜', '监督', '剧场版',
  '漫画', '轻小说', 'MAD', 'AMV', '混剪', 'ova', 'OVA', '追番', '补番', '考据', '解析', '吐槽', '杂谈',
];
const OTHER_HINTS = [
  '游戏', '王者荣耀', '英雄联盟', '原神', 'lol', '电竞', '美食', '数码', '手机', 'NBA', '篮球', '足球',
  '汽车', '旅游', 'vlog', '美妆', '穿搭', '考研', '编程', '股票', '基金', '历史', '科普',
];

function classify(title) {
  const lower = title.toLowerCase();
  const anime = ANIME_HINTS.filter((h) => lower.includes(h.toLowerCase()));
  const other = OTHER_HINTS.filter((h) => lower.includes(h.toLowerCase()));
  return { anime, other };
}

async function main() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.startsWith('batch'));
  const rows = [];

  for (const file of files) {
    let record;
    try {
      record = JSON.parse(await readFile(join(OUT_DIR, file), 'utf8'));
    } catch (err) {
      rows.push({ file, error: err.message });
      continue;
    }
    const titles = (record.videos ?? []).map((v) => v.title);
    const hits = titles.map(classify);
    const animeScore = hits.reduce((n, h) => n + (h.anime.length ? 1 : 0), 0);
    const otherScore = hits.reduce((n, h) => n + (h.other.length ? 1 : 0), 0);

    rows.push({
      file,
      mid: record.space?.mid ?? record.searchHits?.[0]?.mid ?? null,
      name: record.space?.name ?? record.searchHits?.[0]?.name ?? null,
      fans: record.searchHits?.[0]?.fans ?? null,
      official: record.space?.official ?? record.searchHits?.[0]?.official ?? '',
      sign: record.space?.sign ?? '',
      status: record.status,
      note: record.note ?? '',
      videoTotal: record.videoTotal ?? null,
      sampled: titles.length,
      animeHitRate: titles.length ? +(animeScore / titles.length).toFixed(2) : null,
      otherHitRate: titles.length ? +(otherScore / titles.length).toFixed(2) : null,
      animeHints: [...new Set(hits.flatMap((h) => h.anime))].slice(0, 8),
      otherHints: [...new Set(hits.flatMap((h) => h.other))].slice(0, 8),
      titles: titles.slice(0, 8),
    });
  }

  rows.sort((a, b) => (b.fans ?? 0) - (a.fans ?? 0));
  await writeFile(join(OUT_DIR, '_review.json'), JSON.stringify(rows, null, 2), 'utf8');

  console.log('mid\t名称\t粉丝\t动画命中率\t其他命中率\t状态');
  for (const r of rows) {
    console.log(
      [r.mid, r.name, r.fans, r.animeHitRate, r.otherHitRate, r.status].join('\t'),
    );
  }
  console.log(`\n共 ${rows.length} 条，明细见 scripts/out/_review.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

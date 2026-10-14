/**
 * verify-ups.mjs
 * ---------------------------------------------------------------------------
 * 核实候选 UP 主的公开资料（只读，不下载、不转载任何内容）：
 *   1. 用 B 站用户搜索接口把昵称解析成真实 UID
 *   2. 取空间公开资料（签名、认证、粉丝数）
 *   3. 取最近投稿标题，并粗略统计"动画方向命中率"供人工复核
 *
 * 用法：
 *   node scripts/verify-ups.mjs --in scripts/names-a.txt --out _hmoe-A.json --limit 10
 *   node scripts/verify-ups.mjs --names "泛式,瓶子君152" --limit 10
 *
 * 注意：中文参数在部分 Windows 终端会被转码，推荐用 --in 传入 UTF-8 名单文件。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BiliClient, sleep } from './bili-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');

/** 默认名单：公开资料中提到的 H萌 相关账号 */
const DEFAULT_NAMES = ['H萌团队', '尕丶天堂', '依然小智', 'Hazx', '赫萝老师', '噩梦D', '泛式', '瓶子君152', '凉风Kaze'];

function parseArgs(argv) {
  const args = { names: null, limit: 10, out: '_hmoe-candidates.json', input: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--names') args.names = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--in') args.input = argv[++i];
  }
  return args;
}

/** 读取 UTF-8 名单文件（每行一个昵称，# 开头为注释） */
async function readNamesFromFile(file) {
  const text = await readFile(file, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, '').trim())
    .filter((line) => line && !line.startsWith('#'));
}

/** 粗略判断投稿标题是否属于动画/番剧/二次元方向（仅供人工复核参考） */
const ANIME_HINTS = [
  '动画', '番剧', '新番', '动漫', '二次元', '声优', '作画', '演出', '分镜', '监督', '剧场版',
  '漫画', '轻小说', 'MAD', 'AMV', '混剪', '追番', '补番', '考据', '解析', '吐槽', '杂谈', 'OP', 'ED',
];
const OTHER_HINTS = [
  '游戏攻略', '王者荣耀', '英雄联盟', '原神', '电竞', '美食', '数码', '手机', 'NBA', '篮球',
  '足球', '汽车', '旅游', 'vlog', '美妆', '穿搭', '考研', '编程', '股票', '基金', '韩剧', '影视剧',
];

function classify(titles) {
  let anime = 0;
  let other = 0;
  for (const title of titles) {
    const lower = title.toLowerCase();
    if (ANIME_HINTS.some((h) => lower.includes(h.toLowerCase()))) anime++;
    if (OTHER_HINTS.some((h) => lower.includes(h.toLowerCase()))) other++;
  }
  const total = titles.length || 1;
  return { animeHitRate: +(anime / total).toFixed(2), otherHitRate: +(other / total).toFixed(2) };
}

async function main() {
  const { names, limit, out, input } = parseArgs(process.argv.slice(2));
  const targets = input ? await readNamesFromFile(input) : (names ?? DEFAULT_NAMES);

  await mkdir(OUT_DIR, { recursive: true });
  const client = new BiliClient();
  await client.bootstrap();

  const results = [];
  for (const keyword of targets) {
    process.stdout.write(`\n=== ${keyword} ===\n`);
    const hits = await client.searchUser(keyword, 1);
    if (!hits.length) {
      console.log('  搜索无结果');
      results.push({ keyword, status: 'not_found' });
      await sleep(1200);
      continue;
    }

    const top = hits[0];
    const info = await client.spaceAccInfo(top.mid);
    await sleep(600);
    const card = info.ok ? null : await client.cardInfo(top.mid);
    await sleep(600);
    const posts = await client.spaceVideos(top.mid, limit, 1);
    await sleep(800);

    const fans = card?.fans ?? top.fans;
    const titles = posts.videos.map((v) => v.title);
    const rates = classify(titles);

    const record = {
      keyword,
      queryMatchedName: top.name,
      exactNameMatch: top.name === keyword,
      mid: top.mid,
      name: info.ok ? info.name : (card?.name ?? top.name),
      fans,
      official: info.ok ? info.official : (card?.official ?? top.official),
      sign: info.ok ? info.sign : (card?.sign ?? top.sign),
      videoTotal: posts.total,
      sampled: titles.length,
      titles,
      ...rates,
      spaceUrl: `https://space.bilibili.com/${top.mid}`,
      sources: [top.source, `https://space.bilibili.com/${top.mid}`],
      fetchedAt: new Date().toISOString(),
      status: posts.ok ? 'verified' : 'partial',
      note: posts.ok ? '' : `投稿接口 code=${posts.code} ${posts.message ?? ''}`,
      searchAlternatives: hits.slice(1, 4).map((h) => ({ mid: h.mid, name: h.name, fans: h.fans })),
    };
    results.push(record);

    console.log(`  mid=${record.mid} name=${record.name} fans=${record.fans} 同名=${record.exactNameMatch}`);
    console.log(`  动画命中率=${record.animeHitRate} 其他命中率=${record.otherHitRate}`);
    for (const t of titles.slice(0, 4)) console.log(`    - ${t}`);
    await sleep(1200);
  }

  const sorted = [...results].sort((a, b) => (b.fans ?? -1) - (a.fans ?? -1));
  await writeFile(
    join(OUT_DIR, out),
    JSON.stringify({ generatedAt: new Date().toISOString(), results, sortedByFans: sorted }, null, 2),
    'utf8',
  );

  console.log('\n=== 按粉丝数从高到低 ===');
  for (const r of sorted) {
    if (r.status === 'not_found') {
      console.log(`  未找到\t${r.keyword}`);
      continue;
    }
    console.log(`  ${r.fans}\t${r.name}\t(uid ${r.mid})\t动画率=${r.animeHitRate}`);
  }
  console.log(`\n共 ${results.length} 条，输出 scripts/out/${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

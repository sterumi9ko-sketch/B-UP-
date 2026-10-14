/**
 * fetch-by-uid.mjs
 * ---------------------------------------------------------------------------
 * 按 UID 直接核实 UP 主的公开资料（用于已经知道 UID、不需要再搜索的情况）。
 *
 * 用法：node scripts/fetch-by-uid.mjs 1351379 137952 18030567
 * 输出：scripts/out/<uid>.json（与 verify-ups.mjs 相同结构）
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BiliClient, sleep } from './bili-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');

async function main() {
  const uids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
  if (!uids.length) {
    console.error('用法：node scripts/fetch-by-uid.mjs <uid> [uid...]');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const client = new BiliClient();
  await client.bootstrap();

  for (const mid of uids) {
    process.stdout.write(`\n=== uid ${mid} ===\n`);
    const info = await client.spaceAccInfo(Number(mid));
    await sleep(600);
    const card = info.ok ? null : await client.cardInfo(Number(mid));
    await sleep(600);
    const posts = await client.spaceVideos(Number(mid), 20, 1);
    await sleep(800);

    const record = {
      keyword: `uid:${mid}`,
      queryMatchedName: info.ok ? info.name : (card?.name ?? ''),
      exactNameMatch: true,
      mid: Number(mid),
      name: info.ok ? info.name : (card?.name ?? ''),
      fans: card?.fans ?? null,
      official: info.ok ? info.official : (card?.official ?? ''),
      sign: info.ok ? info.sign : (card?.sign ?? ''),
      videoTotal: posts.total,
      sampled: posts.videos.length,
      titles: posts.videos.map((v) => v.title),
      spaceUrl: `https://space.bilibili.com/${mid}`,
      sources: [`https://space.bilibili.com/${mid}`],
      fetchedAt: new Date().toISOString(),
      status: posts.ok ? 'verified' : 'partial',
      note: posts.ok ? '' : `投稿接口 code=${posts.code} ${posts.message ?? ''}`,
    };

    await writeFile(join(OUT_DIR, `${mid}.json`), JSON.stringify(record, null, 2), 'utf8');
    console.log(`  name=${record.name} fans=${record.fans} official=${record.official || '(无)'}`);
    console.log(`  videos=${record.sampled}/${record.videoTotal} ${record.note}`);
    console.log(`  sign: ${(record.sign || '').slice(0, 80)}`);
    for (const t of record.titles.slice(0, 5)) console.log(`    - ${t}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

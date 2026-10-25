#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ORG_ID = 'lZHQ2oggO6j4W45vcGjT';
const DEFAULT_SPACE_ID = 'PvV0Wl8B1sGKlplExkQj';
const MAX_BATCH_SIZE = 50;

const options = parseArgs(process.argv.slice(2));
const projectRoot = path.resolve(options.root ?? process.cwd());
const organizationId = options.org ?? process.env.GITBOOK_ORG_ID ?? DEFAULT_ORG_ID;
const spaceId = options.space ?? process.env.GITBOOK_SPACE_ID ?? DEFAULT_SPACE_ID;
const subject = options.subject ?? `Sync local Markdown content ${new Date().toISOString()}`;

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!existsSync(path.join(projectRoot, 'README.md'))) {
  fail(`项目根目录缺少 README.md：${projectRoot}`);
}

try {
  runGitBook(['--version'], { stdio: 'ignore' });
} catch {
  fail('未找到新版 @gitbook/cli。请先安装并登录：npm i -g @gitbook/cli && gitbook auth --token <token>');
}

const targetSpace = confirmSpaceOwnership(organizationId, spaceId);
const localPages = buildLocalPages(projectRoot);
if (localPages.length === 0) {
  fail(`没有找到可同步的 Markdown 文件：${projectRoot}`);
}

console.log(`GitBook Space: ${targetSpace.title} (${spaceId})`);
console.log(`Organization: ${organizationId}`);
console.log(`Local root: ${projectRoot}`);
console.log(`Local pages: ${localPages.length}`);

if (options.dryRun) {
  printPlan(localPages);
  process.exit(0);
}

const changeRequest = createChangeRequest(spaceId, subject);
const changeRequestId = changeRequest.id ?? changeRequest.number;
if (!changeRequestId) {
  fail(`创建变更请求成功，但响应中没有 id/number：${JSON.stringify(changeRequest, null, 2)}`);
}

console.log(`Change request created: ${changeRequestId}`);

const existingTree = listSpacePages(spaceId);
const existingPages = flattenPages(existingTree);
const existingByPath = new Map(existingPages.map((page) => [page.path, page]));
const knownIds = new Map();

const rootLocalPage = localPages[0];
const rootExistingPage = pickExistingRootPage(existingPages, rootLocalPage);
if (rootExistingPage) {
  knownIds.set(rootLocalPage.key, rootExistingPage.id);
}

for (const page of localPages) {
  if (knownIds.has(page.key)) {
    continue;
  }
  const existing = existingByPath.get(page.remotePath);
  if (existing) {
    knownIds.set(page.key, existing.id);
  }
}

let applied = 0;
let inserted = 0;
let updated = 0;

for (const page of localPages) {
  const parentId = page.parentKey ? knownIds.get(page.parentKey) : undefined;
  if (page.parentKey && !parentId) {
    fail(`父页面尚未创建，无法同步 ${page.sourcePath}。缺失父页面 key：${page.parentKey}`);
  }

  const existingId = knownIds.get(page.key);
  const change = existingId
    ? {
        operation: 'update_page',
        page: existingId,
        title: page.title,
        slug: page.slug,
        document: { markdown: page.markdown },
        ...(page.parentKey ? { into: parentId } : { into: null }),
      }
    : {
        operation: 'insert_page',
        ref: page.ref,
        title: page.title,
        slug: page.slug,
        document: { markdown: page.markdown },
        ...(page.parentKey ? { into: parentId } : {}),
      };

  const result = applyChanges(spaceId, changeRequestId, [change]);
  applied += 1;
  if (existingId) {
    updated += 1;
  } else {
    inserted += 1;
    const created = findCreatedPage(result, page.ref);
    if (!created?.id) {
      fail(`已插入 ${page.sourcePath}，但未能从响应中解析新页面 ID：${JSON.stringify(result, null, 2)}`);
    }
    knownIds.set(page.key, created.id);
  }

  console.log(`${existingId ? 'updated' : 'inserted'}: ${page.sourcePath} -> ${page.remotePath}`);
}

console.log('');
console.log('Sync change request is ready.');
console.log(`- Change request: ${changeRequestId}`);
console.log(`- Applied pages: ${applied}`);
console.log(`- Inserted pages: ${inserted}`);
console.log(`- Updated pages: ${updated}`);
console.log('- Merge was NOT executed by this script. Review the change request, then merge explicitly in GitBook.');

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--root') parsed.root = takeValue(args, ++index, arg);
    else if (arg === '--org') parsed.org = takeValue(args, ++index, arg);
    else if (arg === '--space') parsed.space = takeValue(args, ++index, arg);
    else if (arg === '--subject') parsed.subject = takeValue(args, ++index, arg);
    else fail(`未知参数：${arg}`);
  }
  return parsed;
}

function takeValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    fail(`${flag} 需要提供参数值`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/sync-to-gitbook-space.mjs [options]\n\n同步当前项目 Markdown 到 mhc 组织的 GitBook Space。脚本只创建并填充变更请求，不会自动合并或发布。\n\nOptions:\n  --dry-run           只打印将要同步的页面树，不创建变更请求\n  --root <path>       Markdown 项目根目录，默认当前目录\n  --org <id>          GitBook 组织 ID，默认 ${DEFAULT_ORG_ID}\n  --space <id>        GitBook Space ID，默认 ${DEFAULT_SPACE_ID}\n  --subject <text>    变更请求标题\n  -h, --help          显示帮助\n`);
}

function confirmSpaceOwnership(orgId, targetSpaceId) {
  const spaces = runGitBookJson(['spaces', 'list', '--organization', orgId, '--json']);
  const items = Array.isArray(spaces.items) ? spaces.items : [];
  const space = items.find((item) => item.id === targetSpaceId);
  if (!space || space.organization !== orgId) {
    fail(`该资源不属于授权组织 mhc（${orgId}），无法操作。`);
  }
  return space;
}

function buildLocalPages(rootDir) {
  const markdownFiles = listMarkdownFiles(rootDir);
  const markdownByDir = new Map();
  for (const file of markdownFiles) {
    const relativeDir = path.dirname(file) === '.' ? '' : path.dirname(file);
    const base = path.basename(file).toLowerCase();
    if (!markdownByDir.has(relativeDir)) markdownByDir.set(relativeDir, new Set());
    markdownByDir.get(relativeDir).add(base);
  }

  const dirs = collectMarkdownDirs(markdownFiles);
  const pagesByKey = new Map();

  for (const dir of dirs) {
    const readmePath = dir ? `${dir}/README.md` : 'README.md';
    const hasReadme = markdownFiles.includes(readmePath);
    const sourcePath = hasReadme ? readmePath : `${dir}/README.md`;
    const key = pageKeyForReadme(dir);
    const parentDir = dir ? path.dirname(dir) : null;
    const parentKey = dir ? pageKeyForReadme(parentDir === '.' ? '' : parentDir) : null;
    const slug = dir ? slugify(path.basename(dir)) : slugify(projectName(rootDir));
    const markdown = hasReadme
      ? normalizeMarkdown(readFileSync(path.join(rootDir, readmePath), 'utf8'))
      : syntheticDirectoryMarkdown(dir);
    const title = firstHeading(markdown) ?? humanizeSlug(slug);
    pagesByKey.set(key, {
      key,
      parentKey,
      sourcePath,
      slug,
      title,
      markdown,
      ref: makeRef(key),
      depth: dir ? dir.split('/').length : 0,
    });
  }

  for (const file of markdownFiles) {
    if (path.basename(file).toLowerCase() === 'readme.md') continue;
    const dir = path.dirname(file) === '.' ? '' : path.dirname(file);
    const key = file.replace(/\.md$/i, '');
    const parentKey = pageKeyForReadme(dir);
    const slug = slugify(path.basename(file, path.extname(file)));
    const markdown = normalizeMarkdown(readFileSync(path.join(rootDir, file), 'utf8'));
    const title = firstHeading(markdown) ?? humanizeSlug(slug);
    pagesByKey.set(key, {
      key,
      parentKey,
      sourcePath: file,
      slug,
      title,
      markdown,
      ref: makeRef(key),
      depth: dir ? dir.split('/').length + 1 : 1,
    });
  }

  const pages = [...pagesByKey.values()].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.sourcePath.localeCompare(b.sourcePath);
  });

  const rootPage = pages.find((page) => page.key === 'README');
  if (!rootPage) {
    fail('缺少根页面 README.md');
  }

  const remotePathByKey = new Map([[rootPage.key, rootPage.slug]]);
  for (const page of pages) {
    if (page.key === rootPage.key) continue;
    const parentPath = remotePathByKey.get(page.parentKey);
    if (!parentPath) {
      fail(`无法计算远程路径，缺失父页面：${page.sourcePath}`);
    }
    remotePathByKey.set(page.key, `${parentPath}/${page.slug}`);
  }

  for (const page of pages) {
    page.remotePath = remotePathByKey.get(page.key);
  }

  return pages;
}

function listMarkdownFiles(rootDir) {
  const output = [];
  walk(rootDir, '');
  return output.sort();

  function walk(currentDir, relativeDir) {
    for (const entry of readdirSync(currentDir).sort()) {
      if (shouldSkip(entry)) continue;
      const absolute = path.join(currentDir, entry);
      const relative = relativeDir ? `${relativeDir}/${entry}` : entry;
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        walk(absolute, relative);
      } else if (stats.isFile() && entry.toLowerCase().endsWith('.md') && entry !== 'AGENTS.md') {
        output.push(relative);
      }
    }
  }
}

function shouldSkip(entry) {
  return entry === '.git' || entry === 'node_modules' || entry === '.DS_Store';
}

function collectMarkdownDirs(files) {
  const dirs = new Set(['']);
  for (const file of files) {
    let dir = path.dirname(file) === '.' ? '' : path.dirname(file);
    while (dir) {
      dirs.add(dir);
      const parent = path.dirname(dir);
      dir = parent === '.' ? '' : parent;
    }
  }
  return [...dirs].sort((a, b) => {
    const depthA = a ? a.split('/').length : 0;
    const depthB = b ? b.split('/').length : 0;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });
}

function pageKeyForReadme(dir) {
  return dir ? `${dir}/README` : 'README';
}

function syntheticDirectoryMarkdown(dir) {
  const title = inferDirectoryTitle(dir);
  return `# ${title}\n\n本页由同步脚本根据目录 \`${dir}/\` 自动生成，用作子页面分组。\n`;
}

function inferDirectoryTitle(dir) {
  const base = path.basename(dir);
  const knownTitles = new Map([
    ['ai-office-productivity', 'AI 办公提效'],
    ['mother-baby', '母婴和养生赛道'],
    ['content-planning', '内容规划'],
    ['assets', '素材索引'],
    ['prompts', '代理提示词'],
    ['templates', '模板'],
  ]);

  if (knownTitles.has(base)) {
    return knownTitles.get(base);
  }

  const videoPlan = path.join(projectRoot, dir, 'video-plan.md');
  if (existsSync(videoPlan)) {
    const title = firstHeading(readFileSync(videoPlan, 'utf8'));
    if (title) return title;
  }

  const phaseMatch = base.match(/^phase-(\d+)$/);
  if (phaseMatch) {
    return `第 ${phaseMatch[1]} 期`;
  }

  const videoMatch = base.match(/^video-(\d+)(?:-(.+))?$/);
  if (videoMatch) {
    return `视频 ${videoMatch[1]}${videoMatch[2] ? `：${humanizeSlug(videoMatch[2])}` : ''}`;
  }

  return humanizeSlug(base);
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd() + '\n';
}

function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function projectName(rootDir) {
  return path.basename(rootDir);
}

function slugify(value) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'page';
}

function humanizeSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function makeRef(key) {
  return `local-${slugify(key)}`;
}

function createChangeRequest(targetSpaceId, crSubject) {
  return runGitBookJson(['spaces', 'change-requests', 'create', targetSpaceId, '--subject', crSubject, '--json']);
}

function listSpacePages(targetSpaceId) {
  const result = runGitBookJson(['spaces', 'content', 'pages', 'list', targetSpaceId, '--json']);
  return Array.isArray(result.pages) ? result.pages : [];
}

function flattenPages(pages, output = []) {
  for (const page of pages) {
    output.push(page);
    if (Array.isArray(page.pages) && page.pages.length > 0) {
      flattenPages(page.pages, output);
    }
  }
  return output;
}

function pickExistingRootPage(existingPages, rootLocalPage) {
  const byDesiredPath = existingPages.find((page) => page.path === rootLocalPage.remotePath);
  if (byDesiredPath) return byDesiredPath;

  if (existingPages.length === 1) {
    const onlyPage = existingPages[0];
    const looksLikePlaceholder = onlyPage.title === 'Page' || onlyPage.path === 'page';
    if (looksLikePlaceholder) return onlyPage;
  }

  return null;
}

function applyChanges(targetSpaceId, crId, changes) {
  if (changes.length > MAX_BATCH_SIZE) {
    fail(`单批 changes 不能超过 ${MAX_BATCH_SIZE}`);
  }
  return runGitBookJson([
    'spaces',
    'change-requests',
    'content',
    'update',
    targetSpaceId,
    String(crId),
    '--compat',
    'false',
    '--changes',
    JSON.stringify(changes),
    '--json',
  ]);
}

function findCreatedPage(result, ref) {
  const changes = Array.isArray(result.changes) ? result.changes : [];
  const created = changes.find((change) => change.object === 'created_page' && change.ref === ref);
  return created?.page;
}

function printPlan(pages) {
  console.log('Dry run page tree:');
  const pagesByParent = new Map();
  for (const page of pages) {
    const parent = page.parentKey ?? '__root__';
    if (!pagesByParent.has(parent)) pagesByParent.set(parent, []);
    pagesByParent.get(parent).push(page);
  }

  printChildren('__root__', 0);

  function printChildren(parentKey, depth) {
    for (const page of pagesByParent.get(parentKey) ?? []) {
      const indent = '  '.repeat(depth);
      console.log(`${indent}- ${page.title} [${page.sourcePath}] -> ${page.remotePath}`);
      printChildren(page.key, depth + 1);
    }
  }
}

function runGitBookJson(args) {
  const output = runGitBook(args, { encoding: 'utf8' });
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`GitBook CLI 返回的不是 JSON：${error.message}\n${output}`);
  }
}

function runGitBook(args, options = {}) {
  try {
    return execFileSync('gitbook', args, { ...options });
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? '';
    const stdout = error.stdout?.toString?.() ?? '';
    fail(`GitBook CLI 执行失败：gitbook ${args.join(' ')}\n${stderr || stdout || error.message}`);
  }
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

#!/usr/bin/env node

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const outputDir = path.resolve(process.env.SITE_OUTPUT_DIR ?? path.join(rootDir, 'public'));
const siteTitle = '短视频内容策划';
const ignoredDirs = new Set(['.git', 'node_modules', 'public']);
const ignoredFiles = new Set(['AGENTS.md']);

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const markdownFiles = listMarkdownFiles(rootDir);
const pages = markdownFiles.map((sourcePath) => {
  const markdown = normalize(readFileSync(path.join(rootDir, sourcePath), 'utf8'));
  const title = firstHeading(markdown) ?? titleFromPath(sourcePath);
  const url = htmlUrlFor(sourcePath);
  const outputPath = outputPathFor(sourcePath);
  return { sourcePath, markdown, title, url, outputPath };
});

const pagesBySource = new Map(pages.map((page) => [page.sourcePath, page]));

for (const page of pages) {
  const body = renderMarkdown(page.markdown, page.sourcePath, pagesBySource);
  const navHtml = renderNav(pages, page.sourcePath);
  const html = renderLayout({ title: page.title, body, navHtml, sourcePath: page.sourcePath });
  const absoluteOutputPath = path.join(outputDir, page.outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(absoluteOutputPath, html);
}

writeFileSync(path.join(outputDir, 'site-index.json'), JSON.stringify({
  title: siteTitle,
  generatedAt: new Date().toISOString(),
  pages: pages.map(({ title, sourcePath, url }) => ({ title, sourcePath, url })),
}, null, 2));

writeFileSync(path.join(outputDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
writeFileSync(path.join(outputDir, '404.html'), renderLayout({
  title: '页面不存在',
  navHtml: renderNav(pages, ''),
  sourcePath: '',
  body: '<h1>页面不存在</h1><p>请从左侧目录重新选择页面。</p>',
}));

console.log(`Built ${pages.length} pages into ${outputDir}`);

function listMarkdownFiles(baseDir) {
  const files = [];
  walk(baseDir, '');
  return files.sort(sortMarkdownPaths);

  function walk(currentDir, relativeDir) {
    for (const entry of readdirSync(currentDir).sort()) {
      if (ignoredDirs.has(entry)) continue;
      const absolute = path.join(currentDir, entry);
      const relative = relativeDir ? `${relativeDir}/${entry}` : entry;
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        walk(absolute, relative);
      } else if (stats.isFile() && entry.endsWith('.md') && !ignoredFiles.has(entry)) {
        files.push(relative);
      }
    }
  }
}

function sortMarkdownPaths(left, right) {
  const leftDepth = left.split('/').length;
  const rightDepth = right.split('/').length;
  if (leftDepth !== rightDepth) return leftDepth - rightDepth;
  if (left.endsWith('/README.md') && !right.endsWith('/README.md')) return -1;
  if (!left.endsWith('/README.md') && right.endsWith('/README.md')) return 1;
  return left.localeCompare(right);
}

function normalize(markdown) {
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd() + '\n';
}

function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function titleFromPath(sourcePath) {
  const base = path.basename(sourcePath, '.md');
  const dir = path.basename(path.dirname(sourcePath));
  return humanize(base.toLowerCase() === 'readme' ? dir : base);
}

function humanize(value) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function htmlUrlFor(sourcePath) {
  if (sourcePath === 'README.md') return '/';
  if (sourcePath.endsWith('/README.md')) {
    return `/${sourcePath.slice(0, -'README.md'.length)}`;
  }
  return `/${sourcePath.replace(/\.md$/, '.html')}`;
}

function outputPathFor(sourcePath) {
  if (sourcePath === 'README.md') return 'index.html';
  if (sourcePath.endsWith('/README.md')) {
    return `${sourcePath.slice(0, -'README.md'.length)}index.html`;
  }
  return sourcePath.replace(/\.md$/, '.html');
}

function renderNav(allPages, activeSourcePath) {
  const tree = buildNavTree(allPages);
  return `<nav class="sidebar-nav" aria-label="内容目录">${renderNavNode(tree, activeSourcePath, 0)}</nav>`;
}

function buildNavTree(allPages) {
  const root = createNavNode('', '', null);

  for (const page of allPages) {
    const parts = page.sourcePath.split('/');
    const isReadme = parts.at(-1)?.toLowerCase() === 'readme.md';
    const dirParts = isReadme ? parts.slice(0, -1) : parts.slice(0, -1);
    let current = root;

    for (const part of dirParts) {
      current = getOrCreateChild(current, part, current.path ? `${current.path}/${part}` : part);
    }

    if (isReadme) {
      current.page = page;
      current.title = page.title;
    } else {
      const name = path.basename(page.sourcePath, '.md');
      const childPath = current.path ? `${current.path}/${name}` : name;
      const child = getOrCreateChild(current, name, childPath);
      child.page = page;
      child.title = page.title;
      child.isFile = true;
    }
  }

  sortNavChildren(root);
  return root;
}

function createNavNode(name, nodePath, page) {
  return {
    name,
    path: nodePath,
    title: page?.title ?? humanize(name || siteTitle),
    page,
    isFile: false,
    children: [],
    childMap: new Map(),
  };
}

function getOrCreateChild(parent, name, nodePath) {
  if (!parent.childMap.has(name)) {
    const child = createNavNode(name, nodePath, null);
    parent.childMap.set(name, child);
    parent.children.push(child);
  }
  return parent.childMap.get(name);
}

function sortNavChildren(node) {
  node.children.sort((left, right) => {
    if (left.isFile !== right.isFile) return left.isFile ? 1 : -1;
    const leftPageRank = left.page ? 0 : 1;
    const rightPageRank = right.page ? 0 : 1;
    if (leftPageRank !== rightPageRank) return leftPageRank - rightPageRank;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
  for (const child of node.children) sortNavChildren(child);
}

function renderNavNode(node, activeSourcePath, depth) {
  const isRoot = depth === 0;
  const isActive = node.page?.sourcePath === activeSourcePath;
  const hasActiveChild = containsActivePage(node, activeSourcePath);
  const hasChildren = node.children.length > 0;
  const title = isRoot ? siteTitle : node.title;
  const href = node.page?.url;
  const classes = [
    'nav-link',
    `depth-${Math.min(depth, 5)}`,
    isActive ? 'active' : '',
    hasChildren ? 'folder-link' : 'leaf-link',
  ].filter(Boolean).join(' ');
  const link = href
    ? `<a class="${classes}" href="${href}">${escapeHtml(title)}</a>`
    : `<span class="${classes}">${escapeHtml(title)}</span>`;

  if (!hasChildren) {
    return link;
  }

  const open = isRoot || hasActiveChild || depth <= 1 ? ' open' : '';
  const children = node.children.map((child) => renderNavNode(child, activeSourcePath, depth + 1)).join('\n');

  return `<details class="nav-node depth-${Math.min(depth, 5)}"${open}>
  <summary>${link}</summary>
  <div class="nav-children">${children}</div>
</details>`;
}

function containsActivePage(node, activeSourcePath) {
  if (!activeSourcePath) return false;
  if (node.page?.sourcePath === activeSourcePath) return true;
  return node.children.some((child) => containsActivePage(child, activeSourcePath));
}

function renderLayout({ title, body, navHtml, sourcePath }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${siteTitle}</title>
  <style>${siteCss()}</style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">${siteTitle}</a>
    <span class="source">${escapeHtml(sourcePath)}</span>
  </header>
  <div class="layout">
    <aside class="sidebar">${navHtml}</aside>
    <main class="content">${body}</main>
  </div>
</body>
</html>
`;
}

function renderMarkdown(markdown, sourcePath, pagesBySource) {
  const lines = markdown.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(`<pre><code class="language-${escapeHtml(language)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = renderInline(heading[2], sourcePath, pagesBySource);
      const id = slugify(stripMarkdown(heading[2]));
      blocks.push(`<h${level} id="${id}">${text}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && lines[index].includes('|')) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderTable(tableLines, sourcePath, pagesBySource));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInline(item, sourcePath, pagesBySource)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${renderInline(item, sourcePath, pagesBySource)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${quote.map((item) => `<p>${renderInline(item, sourcePath, pagesBySource)}</p>`).join('')}</blockquote>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('```') &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !isTableStart(lines, index)
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join(' '), sourcePath, pagesBySource)}</p>`);
  }

  return blocks.join('\n');
}

function isTableStart(lines, index) {
  return Boolean(lines[index]?.includes('|') && lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/));
}

function renderTable(tableLines, sourcePath, pagesBySource) {
  const rows = tableLines
    .filter((line, index) => index !== 1)
    .map((line) => splitTableRow(line));
  const [head = [], ...body] = rows;
  return `<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${renderInline(cell, sourcePath, pagesBySource)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, sourcePath, pagesBySource)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderInline(value, sourcePath, pagesBySource) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    return `<a href="${escapeAttribute(resolveLink(href, sourcePath, pagesBySource))}">${text}</a>`;
  });
  return html;
}

function resolveLink(href, sourcePath, pagesBySource) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [pathPart, hash = ''] = href.split('#');
  const sourceDir = path.dirname(sourcePath) === '.' ? '' : path.dirname(sourcePath);
  const targetSource = normalizeRelativePath(path.join(sourceDir, pathPart));
  const candidates = [
    targetSource,
    `${targetSource.replace(/\/$/, '')}/README.md`,
    targetSource.endsWith('.md') ? targetSource : `${targetSource}.md`,
  ];
  for (const candidate of candidates) {
    if (pagesBySource.has(candidate)) {
      return `${pagesBySource.get(candidate).url}${hash ? `#${hash}` : ''}`;
    }
  }
  return href;
}

function normalizeRelativePath(value) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function stripMarkdown(value) {
  return value.replace(/[`*_~[\]()]/g, '');
}

function slugify(value) {
  return encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, '-'));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function siteCss() {
  return `
:root {
  --bg: #f6f7fb;
  --panel: #ffffff;
  --text: #202431;
  --muted: #667085;
  --border: #e5e7ef;
  --accent: #2563eb;
  --code-bg: #f1f5f9;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.75;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 16px;
  align-items: center;
  min-height: 56px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(10px);
}
.brand { color: var(--text); font-weight: 700; }
.source { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: calc(100vh - 56px); }
.sidebar { border-right: 1px solid var(--border); background: var(--panel); overflow: auto; padding: 14px 10px; }
.sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
.nav-node { margin: 1px 0; }
.nav-node > summary {
  display: flex;
  align-items: center;
  list-style: none;
  cursor: pointer;
  border-radius: 8px;
}
.nav-node > summary::-webkit-details-marker { display: none; }
.nav-node > summary::before {
  content: "▸";
  flex: 0 0 16px;
  width: 16px;
  color: var(--muted);
  font-size: 12px;
  transform: translateY(-1px);
}
.nav-node[open] > summary::before { content: "▾"; }
.nav-node > summary:hover { background: #eff6ff; }
.nav-children {
  margin-left: 10px;
  padding-left: 9px;
  border-left: 1px dashed var(--border);
}
.nav-link {
  display: block;
  flex: 1;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 8px;
  color: #344054;
  font-size: 14px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-link:hover { background: #eff6ff; text-decoration: none; }
.nav-link.active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
}
.leaf-link { margin: 1px 0 1px 16px; }
.leaf-link::before {
  content: "•";
  color: var(--muted);
  margin-right: 6px;
}
.folder-link { font-weight: 600; }
.depth-2 .nav-link, .nav-link.depth-3 { font-size: 13px; }
.depth-3 .nav-link, .depth-4 .nav-link, .depth-5 .nav-link,
.nav-link.depth-4, .nav-link.depth-5 { font-size: 12px; color: var(--muted); }
.content {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 40px 32px 80px;
  background: var(--panel);
  min-height: calc(100vh - 56px);
}
h1, h2, h3, h4 { line-height: 1.3; margin: 1.8em 0 0.7em; }
h1 { margin-top: 0; font-size: 34px; }
h2 { border-top: 1px solid var(--border); padding-top: 24px; font-size: 25px; }
h3 { font-size: 20px; }
p, ul, ol, blockquote, .table-wrap { margin: 0 0 16px; }
li { margin: 4px 0; }
blockquote { border-left: 4px solid var(--accent); padding: 8px 16px; color: var(--muted); background: #f8fafc; }
code { background: var(--code-bg); padding: 2px 5px; border-radius: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { background: #0f172a; color: #e2e8f0; padding: 18px; border-radius: 12px; overflow: auto; }
pre code { background: transparent; padding: 0; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; }
table { width: 100%; border-collapse: collapse; min-width: 680px; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
th { background: #f8fafc; text-align: left; font-weight: 700; }
tr:last-child td { border-bottom: none; }
@media (max-width: 860px) {
  .layout { display: block; }
  .sidebar { max-height: 42vh; border-right: 0; border-bottom: 1px solid var(--border); }
  .content { padding: 28px 18px 60px; }
  .topbar { padding: 0 16px; }
  h1 { font-size: 28px; }
}
`;
}

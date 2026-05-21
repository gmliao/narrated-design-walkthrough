#!/usr/bin/env node
/**
 * walkthrough runner — generic dev / build / list / validate dispatcher.
 *
 * Usage:
 *   npm run dev                       → 列出所有 walkthrough（若多於一個）；若只一個則直接啟動
 *   npm run dev <slug>                → 啟動該 walkthrough 的 Slidev dev server (port 3030)
 *   npm run dev <slug> -- --port 4000 → 將 -- 後的參數透傳給 slidev
 *   npm run build <slug>              → slidev build → <slug>/dist
 *   npm run validate <slug>           → 結構性檢查 (Mermaid label escaping, frontmatter, addons)
 *   npm run validate                  → 檢查全部 walkthrough
 *   npm run list                      → 只列出可用 slug
 *
 * Walkthrough 偵測：docs/walkthroughs/<name>/slides.md 存在 + 開頭不為 _ / .
 * 即視為一個 walkthrough；新增 walkthrough 不需更新本檔案或 package.json。
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const DEFAULT_PORT = '3030'

function listWalkthroughs() {
  return readdirSync(ROOT).filter((name) => {
    if (name.startsWith('_') || name.startsWith('.')) return false
    if (name === 'node_modules' || name === 'bin' || name === 'dist') return false
    return existsSync(join(ROOT, name, 'slides.md'))
  }).sort()
}

function printList() {
  const all = listWalkthroughs()
  if (all.length === 0) {
    console.error('No walkthroughs found under docs/walkthroughs/.')
    return
  }
  console.log('Available walkthroughs:')
  for (const slug of all) console.log(`  ${slug}`)
}

function resolveSlug(slug) {
  const all = listWalkthroughs()
  if (!slug) {
    if (all.length === 0) {
      console.error('No walkthroughs found under docs/walkthroughs/.')
      process.exit(1)
    }
    if (all.length === 1) {
      console.log(`(auto-selected only walkthrough: ${all[0]})`)
      return all[0]
    }
    console.error('Multiple walkthroughs available — pick one:\n')
    for (const w of all) console.error(`  npm run ${process.env.npm_lifecycle_event || 'dev'} ${w}`)
    process.exit(1)
  }
  if (!all.includes(slug)) {
    console.error(`Walkthrough "${slug}" not found. Available:\n`)
    for (const w of all) console.error(`  ${w}`)
    process.exit(1)
  }
  return slug
}

function runSlidev(action, slug, extraArgs) {
  const slidesPath = `${slug}/slides.md`
  const args = action === 'build'
    ? ['slidev', 'build', slidesPath, '--out', `${slug}/dist`, ...extraArgs]
    : ['slidev', slidesPath, ...extraArgs]

  // Default port for dev only if user didn't pass one
  if (action === 'dev' && !extraArgs.some((a) => a === '--port' || a.startsWith('--port='))) {
    args.push('--port', DEFAULT_PORT)
  }

  const child = spawn('npx', args, { stdio: 'inherit', cwd: ROOT })
  child.on('exit', (code) => process.exit(code ?? 0))
}

// =============================================================================
// Validate
// =============================================================================

/**
 * Structural lint for a walkthrough's slides.md. Catches the common syntax bugs
 * that wouldn't be detected by Slidev's dev server until you actually navigate
 * to the broken slide and see a parse error overlay. Lightweight by design:
 * full Mermaid rendering validation requires DOM, so we skip that and rely on
 * `npm run dev <slug>` for visual confirmation.
 *
 * Current rules:
 *   M1  Mermaid: `[]` `{}` `()` inside an unquoted node label
 *       → fix: wrap label in double quotes, e.g. node["my[label]"]
 *   F1  Frontmatter: missing `addons: [./_addon]`
 *   F2  Frontmatter: wrong path `../_addon` instead of `./_addon`
 *   N1  NarrationCue: stray `<TTSPlayer>` / `<GlobalTTSPlayer>` (deprecated v1 components)
 */

function extractMermaidBlocks(md) {
  const blocks = []
  const re = /```mermaid\n([\s\S]*?)\n```/g
  let m
  while ((m = re.exec(md)) !== null) {
    const startLine = md.slice(0, m.index).split('\n').length + 1 // +1 for the fence line
    blocks.push({ content: m[1], startLine })
  }
  return blocks
}

function lintMermaidBlock(block) {
  const issues = []
  const lines = block.content.split('\n')
  lines.forEach((line, i) => {
    // Skip comments
    if (/^\s*%%/.test(line)) return

    // M1: bracket inside unquoted node label.
    //
    // Mermaid node syntax: id[label], id(label), id{label}, etc. Label is bare
    // text unless wrapped in double quotes. If the bare label contains another
    // bracket char, the parser confuses it with a nested node opener.
    //
    // Heuristic: scan for `[label]`, `(label)`, `{label}` patterns where the
    // label region (not starting with " ) contains [ ] { } or ( ) chars.
    const patterns = [
      { open: '[', close: ']', label: 'square' },
      { open: '(', close: ')', label: 'paren' },
      { open: '{', close: '}', label: 'curly' },
    ]
    for (const p of patterns) {
      // Match id<open>label<close> where label is non-empty and doesn't start with "
      const re = new RegExp(`\\w+\\${p.open}(?!")([^${escapeForCharClass(p.close)}]*?)\\${p.close}`, 'g')
      let m
      while ((m = re.exec(line)) !== null) {
        const inner = m[1]
        // Look for any of the bracket types inside
        if (/[\[\]{}()]/.test(inner)) {
          issues.push({
            line: block.startLine + i,
            rule: 'M1',
            severity: 'error',
            message: `Mermaid node label contains unescaped bracket — wrap label in double quotes (e.g. \`id["${inner.replace(/"/g, '\\"')}"\`)`,
            snippet: line.trim(),
          })
        }
      }
    }
  })
  return issues
}

function escapeForCharClass(ch) {
  return ch.replace(/[\^\-\]\\]/g, '\\$&')
}

function lintFrontmatter(md) {
  const issues = []
  if (!md.startsWith('---\n')) {
    issues.push({ line: 1, rule: 'F0', severity: 'error', message: 'slides.md must start with YAML frontmatter (`---`).' })
    return issues
  }
  const end = md.indexOf('\n---\n', 4)
  if (end < 0) {
    issues.push({ line: 1, rule: 'F0', severity: 'error', message: 'unterminated frontmatter — missing closing `---`.' })
    return issues
  }
  const frontmatter = md.slice(4, end)
  // F1: must include addons referencing _addon
  if (!/addons:\s*[\s\S]*?_addon/.test(frontmatter)) {
    issues.push({ line: 1, rule: 'F1', severity: 'error', message: 'frontmatter missing `addons: [./_addon]` — required so Slidev loads the shared walkthrough engine.' })
  }
  // F2: wrong relative path (../_addon doesn't resolve from npm script cwd)
  if (/\.\.\/_addon/.test(frontmatter)) {
    issues.push({ line: 1, rule: 'F2', severity: 'error', message: 'frontmatter uses `../_addon` — must be `./_addon` (Slidev resolves from npm script cwd = docs/walkthroughs/).' })
  }
  return issues
}

function lintBody(md) {
  const issues = []
  const lines = md.split('\n')
  lines.forEach((line, i) => {
    // N1: deprecated per-slide TTSPlayer / GlobalTTSPlayer
    if (/<(?:TTSPlayer|GlobalTTSPlayer)\b/.test(line)) {
      issues.push({
        line: i + 1,
        rule: 'N1',
        severity: 'error',
        message: 'deprecated per-slide TTS component — use `<NarrationCue :text="...">` instead; playback is provided by the shared addon.',
        snippet: line.trim().slice(0, 100),
      })
    }
  })
  return issues
}

function validateWalkthrough(slug) {
  const slidesPath = join(ROOT, slug, 'slides.md')
  if (!existsSync(slidesPath)) {
    return { slug, fatal: `slides.md missing at ${slidesPath}` }
  }
  const md = readFileSync(slidesPath, 'utf-8')
  const issues = [
    ...lintFrontmatter(md),
    ...lintBody(md),
    ...extractMermaidBlocks(md).flatMap(lintMermaidBlock),
  ]
  return { slug, issues }
}

function runValidate(slugCandidate) {
  const targets = slugCandidate ? [resolveSlug(slugCandidate)] : listWalkthroughs()
  let totalErrors = 0
  let totalWarnings = 0
  for (const slug of targets) {
    const { fatal, issues } = validateWalkthrough(slug)
    if (fatal) {
      console.error(`✗ ${slug}: ${fatal}`)
      totalErrors += 1
      continue
    }
    if (issues.length === 0) {
      console.log(`✓ ${slug}: clean`)
      continue
    }
    console.log(`✗ ${slug}: ${issues.length} issue${issues.length === 1 ? '' : 's'}`)
    for (const issue of issues) {
      const tag = issue.severity === 'error' ? 'ERR' : 'WARN'
      const line = `  [${tag} ${issue.rule}] line ${issue.line}: ${issue.message}`
      if (issue.severity === 'error') totalErrors += 1
      else totalWarnings += 1
      console.log(line)
      if (issue.snippet) console.log(`        > ${issue.snippet}`)
    }
  }
  if (totalErrors > 0) {
    console.error(`\n${totalErrors} error${totalErrors === 1 ? '' : 's'}, ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}.`)
    process.exit(1)
  }
  console.log(`\nAll checks passed (${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}).`)
}

// =============================================================================
// Dispatch
// =============================================================================

const [action, ...rest] = process.argv.slice(2)
const args = rest.filter((a) => a !== '--')

if (action === 'list') {
  printList()
  process.exit(0)
}

if (action === 'validate') {
  runValidate(args[0])
  // runValidate exits on error; reach here only when clean
  process.exit(0)
}

if (action !== 'dev' && action !== 'build') {
  console.error(`Unknown action "${action ?? ''}". Use: dev | build | list | validate`)
  process.exit(1)
}

const slugCandidate = args[0]
const extraArgs = args.slice(1)
const slug = resolveSlug(slugCandidate)
runSlidev(action, slug, extraArgs)

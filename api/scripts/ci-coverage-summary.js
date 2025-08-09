#!/usr/bin/env node
// Write a concise coverage summary to GitHub PR summary when available
// Requires vitest coverage with json-summary reporter enabled

const fs = require('fs');
const path = require('path');

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function formatPct(n) {
  return `${n.toFixed(2)}%`;
}

function main() {
  const summaryPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');
  const data = readJson(summaryPath);
  if (!data) {
    console.error('coverage-summary.json not found. Did you run tests with coverage?');
    process.exit(1);
  }

  const total = data.total || {};
  const stat = key => {
    const k = total[key] || { total: 0, covered: 0, pct: 0 };
    return { total: k.total, covered: k.covered, pct: k.pct || (k.total ? (k.covered / k.total) * 100 : 100) };
  };
  const s = stat('statements');
  const b = stat('branches');
  const f = stat('functions');
  const l = stat('lines');

  const md = [
    '### API Coverage',
    '',
    `- Statements: ${formatPct(s.pct)} (${s.covered}/${s.total})`,
    `- Branches: ${formatPct(b.pct)} (${b.covered}/${b.total})`,
    `- Functions: ${formatPct(f.pct)} (${f.covered}/${f.total})`,
    `- Lines: ${formatPct(l.pct)} (${l.covered}/${l.total})`,
    '',
    'Directory breakdown (key areas):',
    '',
    '| Path | Statements | Branches | Functions | Lines |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];

  const interesting = ['src/routes', 'src/middleware', 'src/auth'];
  for (const p of interesting) {
    const entry = data[p];
    if (!entry) continue;
    const ps = entry.statements.pct;
    const pb = entry.branches.pct;
    const pf = entry.functions.pct;
    const pl = entry.lines.pct;
    md.push(`| ${p} | ${formatPct(ps)} | ${formatPct(pb)} | ${formatPct(pf)} | ${formatPct(pl)} |`);
  }

  const content = md.join('\n');
  const gha = process.env.GITHUB_STEP_SUMMARY;
  if (gha) {
    fs.appendFileSync(gha, content + '\n');
    console.log('Wrote coverage summary to GitHub step summary');
  } else {
    console.log(content);
  }
}

main();



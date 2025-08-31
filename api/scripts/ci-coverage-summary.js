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
  // Try API directory first (when run from root), then current directory
  const apiPath = path.resolve(process.cwd(), 'api/coverage/coverage-summary.json');
  const localPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');
  
  let summaryPath;
  if (fs.existsSync(apiPath)) {
    summaryPath = apiPath;
  } else if (fs.existsSync(localPath)) {
    summaryPath = localPath;
  } else {
    console.error('coverage-summary.json not found at', apiPath, 'or', localPath);
    process.exit(1);
  }
  
  const data = readJson(summaryPath);

  const total = data.total || {};
  const stat = (key) => {
    const k = total[key] || { total: 0, covered: 0, pct: 0 };
    return {
      total: k.total,
      covered: k.covered,
      pct: k.pct || (k.total ? (k.covered / k.total) * 100 : 100),
    };
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
  ];

  const content = md.join('\n');
  const gha = process.env.GITHUB_STEP_SUMMARY;
  if (gha) {
    fs.appendFileSync(gha, content + '\n');
    console.log('Wrote coverage summary to GitHub step summary');
  } else {
    console.log(content);
  }

  // Also write to a markdown file for PR comment steps
  const outPath = path.resolve(path.dirname(summaryPath), 'coverage-summary.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content + '\n');
  console.log(`Wrote coverage summary markdown to ${outPath}`);
}

main();

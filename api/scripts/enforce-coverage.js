#!/usr/bin/env node
// Enforce coverage thresholds by reading coverage/coverage-summary.json
// Thresholds are taken from env or default to values used in vitest.config.ts
const fs = require('fs');
const path = require('path');

const thresholds = {
  statements: Number(85),
  branches: Number(77),
  functions: Number(96),
  lines: Number(85),
};

function readSummary() {
  // Try API directory first (when run from root), then current directory
  const apiPath = path.resolve(process.cwd(), 'api/coverage/coverage-summary.json');
  const localPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');

  let p;
  if (fs.existsSync(apiPath)) {
    p = apiPath;
  } else if (fs.existsSync(localPath)) {
    p = localPath;
  } else {
    console.error('coverage-summary.json not found at', apiPath, 'or', localPath);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function pct(obj) {
  return typeof obj.pct === 'number' ? obj.pct : (obj.covered / Math.max(1, obj.total)) * 100;
}

function main() {
  const summary = readSummary();
  const total = summary.total;
  const actual = {
    statements: pct(total.statements),
    lines: pct(total.lines),
    functions: pct(total.functions),
    branches: pct(total.branches),
  };

  const failures = [];
  for (const k of Object.keys(thresholds)) {
    if (actual[k] < thresholds[k]) {
      failures.push(`${k}: ${actual[k].toFixed(2)}% < ${thresholds[k]}%`);
    }
  }

  if (failures.length) {
    console.error('Coverage thresholds not met:\n - ' + failures.join('\n - '));
    process.exit(2);
  } else {
    console.log('Coverage thresholds satisfied:', actual);
  }
}

main();

#!/usr/bin/env node
// Test that no forbidden names appear in the Accelerated Inertia app files.
// The denylist is read from the FORBIDDEN_NAMES environment variable (comma-separated).

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const FORBIDDEN_NAMES_ENV = process.env.FORBIDDEN_NAMES || '';
const FORBIDDEN_NAMES = FORBIDDEN_NAMES_ENV
  .split(',')
  .map(name => name.trim().toLowerCase())
  .filter(name => name.length > 0);

if (FORBIDDEN_NAMES.length === 0) {
  console.log('✓ FORBIDDEN_NAMES is empty or not set. No names to check.');
  process.exit(0);
}

const FILES_TO_CHECK = [
  'src/notion-accelerated.js',
  'public/desk/accelerated/index.html',
  'public/desk/accelerated/style.css',
  'public/desk/accelerated/app.js',
  'public/desk/accelerated/mock-data.js'
];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8').toLowerCase();
  const violations = [];

  for (const name of FORBIDDEN_NAMES) {
    if (content.includes(name)) {
      violations.push(name);
    }
  }

  return violations;
}

let failed = false;

console.log(`Checking ${FILES_TO_CHECK.length} files for ${FORBIDDEN_NAMES.length} forbidden name(s)...`);

for (const file of FILES_TO_CHECK) {
  const violations = checkFile(file);
  if (violations.length > 0) {
    console.error(`✗ ${file}: Found forbidden name(s): ${violations.join(', ')}`);
    failed = true;
  } else {
    console.log(`✓ ${file}: Clean`);
  }
}

if (failed) {
  console.error('\n✗ Forbidden name check FAILED. Remove the listed names from the code.');
  process.exit(1);
} else {
  console.log('\n✓ All files passed the forbidden name check.');
  process.exit(0);
}

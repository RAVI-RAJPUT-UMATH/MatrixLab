#!/usr/bin/env node
/**
 * MatrixLab — headless test runner.
 *
 * Node is used here purely as a harness so the mathematics can be verified
 * from the command line. The application itself has no Node/npm dependency:
 * it runs by opening index.html in a browser.
 *
 *   node tests/run-node.js            run everything
 *   node tests/run-node.js eigen      run suites whose name contains "eigen"
 *   node tests/run-node.js --verbose  list every assertion
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const { CORE_FILES, TEST_FILES } = require('./manifest.js');

const args = process.argv.slice(2);
const verbose = args.indexOf('--verbose') >= 0;
const filter = args.filter((a) => !a.startsWith('--'))[0] || null;

function load(relative, optional) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    if (optional) return false;
    console.error('missing source file: ' + relative);
    process.exit(2);
  }
  try {
    vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
  } catch (err) {
    console.error('failed to load ' + relative + ':\n' + (err && err.stack ? err.stack : err));
    process.exit(2);
  }
  return true;
}

const loaded = [];
const skipped = [];
CORE_FILES.forEach((f) => (load(f, true) ? loaded.push(f) : skipped.push(f)));
load('tests/framework.js');
TEST_FILES.forEach((f) => load(f, true));

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', green: '', yellow: '', dim: '', bold: '', off: '' };

const report = globalThis.MLTest.run(filter);

report.suites.forEach((suite) => {
  const bad = suite.failed > 0;
  const mark = bad ? C.red + '✗' + C.off : C.green + '✓' + C.off;
  console.log(mark + ' ' + C.bold + suite.name + C.off + C.dim + '  (' + suite.passed + '/' + (suite.passed + suite.failed) + ')' + C.off);
  suite.assertions.forEach((a) => {
    if (!a.ok) {
      console.log('    ' + C.red + '✗ ' + (a.message || '(unnamed assertion)') + C.off);
      if (a.detail) console.log('      ' + C.dim + String(a.detail).split('\n').join('\n      ') + C.off);
    } else if (verbose) {
      console.log('    ' + C.green + '✓ ' + C.off + C.dim + (a.message || '') + C.off);
    }
  });
  if (suite.error) console.log('    ' + C.red + 'threw: ' + C.off + suite.error.split('\n').slice(0, 6).join('\n      '));
});

if (skipped.length) {
  console.log('\n' + C.yellow + 'not yet implemented (skipped): ' + skipped.join(', ') + C.off);
}

console.log(
  '\n' + C.bold + report.passed + ' passed' + C.off + ', ' +
    (report.failed ? C.red + report.failed + ' failed' + C.off : '0 failed') +
    C.dim + '  —  ' + report.suites.length + ' suites, ' + loaded.length + ' modules' + C.off
);

process.exit(report.failed > 0 ? 1 : 0);

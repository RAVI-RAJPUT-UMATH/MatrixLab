#!/usr/bin/env node
/**
 * MatrixLab — headless UI smoke test.
 *
 * Loads exactly the scripts index.html loads, in that order, against a minimal
 * DOM shim, then builds every registered view, opens every tab and presses the
 * obvious action buttons. Any thrown error, or any error panel that appears in
 * the output, is reported as a failure.
 *
 *   node tests/run-views.js            all views
 *   node tests/run-views.js eigen      one view
 *   node tests/run-views.js --verbose  include per-step detail
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const verbose = args.indexOf('--verbose') >= 0;
const only = args.filter((a) => !a.startsWith('--'))[0] || null;

const { install } = require('./dom-shim.js');
const { document } = install();

/* ---------------------------------------------------------------- *
 * Build the page skeleton that index.html provides
 * ---------------------------------------------------------------- */

function element(tag, id, className) {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  return node;
}

const app = element('div', null, 'app');
const sidebar = element('aside', 'sidebar', 'sidebar');
sidebar.appendChild(element('nav', 'nav', 'nav'));
const scrim = element('div', 'scrim', 'scrim');
const main = element('div', null, 'main');
const topbar = element('header', null, 'topbar');
topbar.appendChild(element('button', 'menu-toggle', 'btn menu-toggle'));
topbar.appendChild(element('span', 'topbar-title', 'topbar__title'));
topbar.appendChild(element('div', 'topbar-tools', 'topbar__tools'));
main.appendChild(topbar);
main.appendChild(element('main', 'view', 'view'));
const footer = element('footer', null, 'footer');
footer.appendChild(element('span', 'footer-year'));
main.appendChild(footer);
app.appendChild(sidebar);
app.appendChild(scrim);
app.appendChild(main);
document.body.appendChild(app);
document.body.appendChild(element('div', 'live-region', 'sr-only'));

/* ---------------------------------------------------------------- *
 * Load the same scripts index.html loads
 * ---------------------------------------------------------------- */

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [];
const scriptPattern = /<script\s+src="([^"]+)"\s*>\s*<\/script>/g;
let match;
while ((match = scriptPattern.exec(html))) scripts.push(match[1]);

if (!scripts.length) {
  console.error('No <script src> tags found in index.html — cannot smoke-test the UI.');
  process.exit(2);
}

const consoleErrors = [];
const realConsoleError = console.error;
console.error = function () {
  consoleErrors.push(Array.prototype.map.call(arguments, (a) => (a && a.stack ? a.stack : String(a))).join(' '));
};

const loadFailures = [];
scripts.forEach((relative) => {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    loadFailures.push(relative + ' — file missing (index.html references it)');
    return;
  }
  try {
    vm.runInThisContext(fs.readFileSync(full, 'utf8'), { filename: full });
  } catch (error) {
    loadFailures.push(relative + ' — ' + (error && error.message ? error.message : String(error)));
  }
});

console.error = realConsoleError;

const ML = globalThis.ML;
if (!ML || !ML.router) {
  console.error('MatrixLab did not initialise. Load failures:\n  ' + loadFailures.join('\n  '));
  process.exit(2);
}

/* ---------------------------------------------------------------- *
 * Walk every view
 * ---------------------------------------------------------------- */

const SAFE_BUTTON_TEXT = [
  'Calculate', 'Analyse', 'Analyze', 'Solve', 'Compute', 'Reduce', 'Run', 'Generate', 'Verify',
  'Decompose', 'Factor', 'Find', 'Apply steps', 'Check', 'Add row', 'Reset', 'Undo', 'Redo',
  'Orthogonalise', 'Fit', 'Update', 'Show', 'Full reduction', 'Next step',
];

const results = [];
const viewContainer = document.getElementById('view');

function errorPanelsIn(node) {
  return node.querySelectorAll('.alert--error').map((panel) => panel.textContent.trim().slice(0, 220));
}

function checkStage(record, stage) {
  errorPanelsIn(viewContainer).forEach((text) => {
    record.problems.push(stage + ': error panel — ' + text);
  });
  consoleErrors.splice(0).forEach((text) => {
    record.problems.push(stage + ': console.error — ' + text.split('\n')[0]);
  });
}

/**
 * --dump=<route> prints the rendered text of one route and exits. Handy for
 * checking content (including deep links like learn/svd) without a browser.
 */
const dumpArg = args.find((a) => a.startsWith('--dump'));
if (dumpArg) {
  const route = dumpArg.indexOf('=') >= 0 ? dumpArg.split('=')[1] : 'dashboard';
  globalThis.location.hash = '#/' + route;
  ML.router.render();
  const text = viewContainer.textContent.replace(/\s+/g, ' ').trim();
  console.log('route: #/' + route);
  console.log('title: ' + document.getElementById('topbar-title').textContent);
  console.log('---');
  console.log(text.slice(0, 1600));
  const problems = errorPanelsIn(viewContainer);
  if (problems.length) {
    console.log('\nERROR PANELS:');
    problems.forEach((p) => console.log('  ' + p));
  }
  process.exit(problems.length ? 1 : 0);
}

const views = ML.router.all().filter((view) => !only || view.id.indexOf(only) >= 0);

views.forEach((view) => {
  const record = { id: view.id, title: view.title, problems: [], tabs: 0, buttons: 0 };
  console.error = function () {
    consoleErrors.push(Array.prototype.map.call(arguments, (a) => (a && a.stack ? a.stack : String(a))).join(' '));
  };
  try {
    ML.router.navigate(view.id);
    if (globalThis.location.hash !== '#/' + view.id) ML.router.render();

    if (!viewContainer.childNodes.length) record.problems.push('render: produced no content');
    checkStage(record, 'render');

    // Open each tab panel (they build lazily).
    const tabs = viewContainer.querySelectorAll('[role=tab]');
    record.tabs = tabs.length;
    tabs.forEach((tab) => {
      tab.dispatch('click', { target: tab });
      checkStage(record, 'tab “' + tab.textContent.trim() + '”');
    });

    // Press the obvious action buttons.
    const buttons = viewContainer.querySelectorAll('button');
    buttons.forEach((button) => {
      const label = button.textContent.trim();
      if (!SAFE_BUTTON_TEXT.some((safe) => label.indexOf(safe) === 0)) return;
      record.buttons++;
      button.dispatch('click', { target: button });
      checkStage(record, 'button “' + label + '”');
    });
  } catch (error) {
    record.problems.push('threw: ' + (error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error));
  }
  console.error = realConsoleError;
  results.push(record);
});

/* ---------------------------------------------------------------- *
 * Report
 * ---------------------------------------------------------------- */

const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', green: '', yellow: '', dim: '', bold: '', off: '' };

if (loadFailures.length) {
  console.log(C.red + 'Script load failures:' + C.off);
  loadFailures.forEach((f) => console.log('  ' + f));
  console.log('');
}

let failed = 0;
results.forEach((record) => {
  const bad = record.problems.length > 0;
  if (bad) failed++;
  console.log(
    (bad ? C.red + '✗' + C.off : C.green + '✓' + C.off) + ' ' + C.bold + record.id + C.off +
      C.dim + '  (' + record.tabs + ' tabs, ' + record.buttons + ' buttons)' + C.off
  );
  record.problems.forEach((problem) => console.log('    ' + C.red + problem + C.off));
  if (verbose && !bad) console.log('    ' + C.dim + record.title + C.off);
});

/* ---------------------------------------------------------------- *
 * Topbar chrome — outside the view container, so the loop above never
 * touches it. The theme switch is the interactive part.
 * ---------------------------------------------------------------- */

const chromeProblems = [];
if (!only) {
  const button = document.getElementById('topbar-tools').querySelectorAll('.theme-btn')[0];
  if (!button) {
    chromeProblems.push('no theme button in the topbar');
  } else {
    // Press it four times: two full round trips, so a toggle that only works
    // once — or that drifts out of step with data-theme — is caught.
    for (let press = 0; press < 4; press++) {
      const before = ML.theme.get();
      const expected = before === 'dark' ? 'light' : 'dark';
      button.dispatch('click', { target: button });

      if (ML.theme.get() !== expected) {
        chromeProblems.push('press ' + (press + 1) + ': theme is ' + ML.theme.get() + ', expected ' + expected);
      }
      if (document.documentElement.getAttribute('data-theme') !== expected) {
        chromeProblems.push(
          'press ' + (press + 1) + ': data-theme is ' +
            document.documentElement.getAttribute('data-theme') + ', expected ' + expected
        );
      }
      // The icon shows the theme the next press would give you.
      const label = button.getAttribute('aria-label') || '';
      const shouldOffer = expected === 'dark' ? 'light' : 'dark';
      if (label !== 'Switch to ' + shouldOffer + ' theme') {
        chromeProblems.push('press ' + (press + 1) + ': label reads “' + label + '”');
      }
      if (button.querySelectorAll('svg').length !== 1) {
        chromeProblems.push('press ' + (press + 1) + ': expected exactly one icon');
      }
      if (button.getAttribute('title') !== label) {
        chromeProblems.push('press ' + (press + 1) + ': title and accessible name disagree');
      }
    }
  }
  console.log(
    (chromeProblems.length ? C.red + '✗' : C.green + '✓') + C.off + ' ' + C.bold + 'topbar theme button' + C.off
  );
  chromeProblems.forEach((problem) => console.log('    ' + C.red + problem + C.off));
}

const navMissing = [];
if (!only) {
  const navLinks = document.getElementById('nav').querySelectorAll('.nav__link');
  const linked = new Set(navLinks.map((link) => link.getAttribute('data-view')));
  ML.router.all().forEach((view) => {
    if (!linked.has(view.id)) navMissing.push(view.id);
  });
  if (navMissing.length) {
    console.log('\n' + C.yellow + 'registered but not reachable from the sidebar: ' + navMissing.join(', ') + C.off);
  }
}

console.log(
  '\n' + C.bold + (results.length - failed) + ' views OK' + C.off +
    (failed ? ', ' + C.red + failed + ' with problems' + C.off : '') +
    C.dim + '  —  ' + scripts.length + ' scripts loaded' + C.off
);

process.exit(failed > 0 || loadFailures.length > 0 || chromeProblems.length > 0 ? 1 : 0);

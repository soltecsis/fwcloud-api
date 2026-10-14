const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const configPath = path.resolve(__dirname, '../.github/c8.json');
const c8 = require.resolve('c8/bin/c8.js');
const tsc = require.resolve('typescript/bin/tsc');

test('native c8 retains original TS/legacy JS and uncovered files without dependency source-map collisions', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-c8-scope-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (file, contents) => {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };
  write('tsconfig.json', JSON.stringify({ compilerOptions: {
    rootDir: '.', outDir: 'dist', sourceMap: true, allowJs: true, types: [],
    target: 'ES2021', module: 'Node16', moduleResolution: 'Node16',
  }, include: ['src/**/*', 'tests/**/*'] }));
  write('src/covered.ts', 'export function covered(value: number): number { return value + 1; }\n');
  write('src/legacy.js', 'exports.legacy = value => value * 2;\n');
  write('src/uncovered.ts', 'export function uncovered(): number { return 99; }\n');
  write('tests/excluded.ts', 'export const fixture = 1;\n');
  // Copy the installed dependency's real code/map. Its ../../src/container.ts
  // points outside node_modules after remapping, into this fixture's src/ tree.
  const dependency = path.dirname(require.resolve('typeorm/container.js'));
  for (const name of ['container.js', 'container.js.map']) {
    write(`node_modules/typeorm/${name}`, fs.readFileSync(path.join(dependency, name)));
  }
  write('run.cjs', [
    'require("./dist/src/covered.js").covered(2);',
    'require("./dist/src/legacy.js").legacy(3);',
    'require("./dist/tests/excluded.js");',
    'require("./node_modules/typeorm/container.js").getFromContainer(class Fixture {});',
  ].join('\n'));
  execFileSync(process.execPath, [tsc, '--project', 'tsconfig.json'], { cwd: directory });

  function collect(config, name) {
    execFileSync(process.execPath, [c8, '--config', config, '--reports-dir', `reports/${name}`,
      '--temp-directory', `raw/${name}`, process.execPath, 'run.cjs'], { cwd: directory });
    const report = path.join(directory, 'reports', name);
    const lcov = fs.readFileSync(path.join(report, 'lcov.info'), 'utf8');
    const summary = JSON.parse(fs.readFileSync(path.join(report, 'coverage-summary.json'), 'utf8'));
    return { lcov, summary, files: lcov.split('\n').filter(line => line.startsWith('SF:')).map(line => line.slice(3)) };
  }

  const result = collect(configPath, 'fixed');
  assert.deepEqual(result.files.sort(), ['src/covered.ts', 'src/legacy.js', 'src/uncovered.ts']);
  for (const file of result.files) assert.ok(fs.statSync(path.join(directory, file)).isFile());
  for (const name of ['covered.ts', 'legacy.js']) {
    assert.ok(result.summary[path.join(directory, 'src', name)].lines.covered > 0, `${name} lost executed coverage`);
  }
  const uncovered = result.summary[path.join(directory, 'src/uncovered.ts')].lines;
  assert.ok(uncovered.total > 0);
  assert.equal(uncovered.covered, 0);
});

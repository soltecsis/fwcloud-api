import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildDockerImage } from '../../utils/docker-image';

describe('Docker test image builds', () => {
  let directory: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-docker-build-'));
    originalPath = process.env.PATH;
    process.env.PATH = `${directory}${path.delimiter}${originalPath ?? ''}`;
  });

  afterEach(() => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function fakeDocker(script: string): void {
    fs.writeFileSync(path.join(directory, 'docker'), `#!${process.execPath}\n${script}`, {
      mode: 0o755,
    });
  }

  it('waits for the build without blocking the event loop', async () => {
    fakeDocker('setTimeout(() => {}, 100);');
    let timerFired = false;
    const timer = setTimeout(() => {
      timerFired = true;
    }, 0);
    try {
      await buildDockerImage('test:image', directory);
      expect(timerFired).to.eq(true);
    } finally {
      clearTimeout(timer);
    }
  });

  it('captures verbose builds beyond the default child-process buffer', async () => {
    fakeDocker("process.stderr.write('x'.repeat(2 * 1024 * 1024));");
    await buildDockerImage('test:image', directory);
  });

  it('preserves failed build diagnostics and exit status', async () => {
    fakeDocker("process.stderr.write('apt repository unavailable'); process.exitCode = 17;");
    let error: any;
    try {
      await buildDockerImage('test:image', directory);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(error.code).to.eq(17);
    expect(error.message).to.include('test:image').and.include('apt repository unavailable');
  });

  it('terminates a stalled build and retains its last progress messages', async () => {
    fakeDocker("process.stderr.write('pulling base image'); setTimeout(() => {}, 10000);");
    let error: any;
    try {
      await buildDockerImage('test:image', directory, 1000);
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
    expect(error.killed).to.eq(true);
    expect(error.message).to.include('1000 ms').and.include('pulling base image');
  });
});

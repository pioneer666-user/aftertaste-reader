import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { cli, repository } from './dependency-canvas.mjs';

const exec = promisify(execFile);

export async function launchFixture(prefix) {
  const parent = path.join(repository, '.local/D058');
  await mkdir(parent, { recursive: true });
  const run = await mkdtemp(path.join(parent, prefix + '-'));
  const profile = path.join(run, 'profile');
  await mkdir(profile);
  const environment = { ...process.env, [process.platform === 'win32' ? 'USERPROFILE' : 'HOME']: profile };
  async function command(operation, project, args = [], env = environment) {
    const result = await exec(process.execPath, [cli, operation, '--project', project, ...args],
      { env, windowsHide: true, encoding: 'utf8', timeout: 40_000 }).catch(error => error);
    if (result.stdout) return { output: JSON.parse(result.stdout), code: 0 };
    if (result.stderr) return { output: JSON.parse(result.stderr), code: result.code };
    throw new Error('阅读器命令未返回 JSON');
  }
  return {
    run, profile, environment, command,
    async link(project, args = []) {
      const { output, code } = await command('open-reader', project, [...args, '--mode', 'link']);
      assert.equal(code, 0, output.error?.code);
      assert.equal(output.status, 'ready');
      assert.equal(output.browser, 'skipped');
      assert.equal(typeof output.url, 'string');
      return output;
    },
    async stop(project) {
      const { output, code } = await command('stop-reader', project);
      assert.equal(code, 0, output.error?.code);
      return output.status;
    },
  };
}

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const distEntry = join(here, '..', 'dist', 'index.js');

describe('binary entrypoint via a symlinked bin (npm link / npm install -g shape)', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: repoRoot, stdio: 'pipe' });
    expect(existsSync(distEntry)).toBe(true);
  });

  it('still runs main() when invoked through a symlink, not just a direct path', () => {
    // npm link and npm install -g both put a SYMLINK in the global bin dir
    // pointing at dist/index.js; process.argv[1] is then the symlink path
    // while import.meta.url resolves through it to the real file. A naive
    // `import.meta.url === file://${process.argv[1]}` guard never matches
    // in that shape, so main() silently never runs for any real install.
    const binDir = mkdtempSync(join(tmpdir(), 'legacy-migrator-bin-'));
    const linkPath = join(binDir, 'legacy-migrator');
    symlinkSync(distEntry, linkPath);

    const runsRoot = mkdtempSync(join(tmpdir(), 'legacy-migrator-runs-'));
    const result = spawnSync('node', [linkPath, 'status', '--runs-root', runsRoot], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    // The regression itself: a broken guard exits 0 with EMPTY stdout
    // (main() never called). Asserting the real statusCommand output, not
    // just the exit code, is what actually catches that failure mode.
    expect(result.stdout).toContain(`no runs found under ${runsRoot}`);
  });

  it('also runs main() via a direct (non-symlinked) path, for contrast', () => {
    const runsRoot = mkdtempSync(join(tmpdir(), 'legacy-migrator-runs-'));
    const result = spawnSync('node', [distEntry, 'status', '--runs-root', runsRoot], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`no runs found under ${runsRoot}`);
  });
});

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('starts the compiled API and validates feedback without TypeScript source files', () => {
  const backendRoot = fileURLToPath(new URL('..', import.meta.url));
  const repoRoot = resolve(backendRoot, '..');
  const cacheRoot = join(backendRoot, 'node_modules', '.cache');
  mkdirSync(cacheRoot, { recursive: true });
  const outputRoot = mkdtempSync(join(cacheRoot, 'runtime-'));
  if (!resolve(outputRoot).startsWith(resolve(cacheRoot) + sep)) throw new Error('Unexpected runtime test directory');
  function compile(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const source = join(directory, entry.name);
      if (entry.isDirectory()) { compile(source); continue; }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
      const destination = join(outputRoot, relative(repoRoot, source).replace(/\.ts$/, '.js'));
      mkdirSync(dirname(destination), { recursive: true });
      const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), {
        fileName: source,
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
      });
      writeFileSync(destination, outputText);
    }
  }
  try {
    compile(join(backendRoot, 'src'));
    compile(join(repoRoot, 'shared'));
    writeFileSync(join(outputRoot, 'package.json'), JSON.stringify({ type: 'module' }));
    const appUrl = pathToFileURL(join(outputRoot, 'backend', 'src', 'app.js')).href;
    const script = `
      import assert from 'node:assert/strict';
      import request from 'supertest';
      const { default: app } = await import(${JSON.stringify(appUrl)});
      assert.equal((await request(app).get('/api/health')).status, 200);
      assert.equal((await request(app).post('/api/feedback').send({})).status, 400);
      const feedback = { id: '819251a5-e7bb-4e98-8c99-758bfc36b723', mode: 'campaign', message: 'x'.repeat(2001) };
      assert.equal((await request(app).post('/api/feedback').send(feedback)).status, 400);
      feedback.message = 'Feedback from a guest';
      assert.equal((await request(app).post('/api/feedback').send(feedback)).status, 503);
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: backendRoot, encoding: 'utf8', timeout: 15_000,
      env: { ...process.env, DATABASE_URL: '', CORS_ORIGINS: 'https://99-99-percent-web.vercel.app' },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr || result.stdout).toBe(0);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}, 20_000);

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the layering described in docs/ARCHITECTURE.md, so it can't erode as features are added:
 * domain is pure, only api/ talks to Supabase, and secrets never reach client code.
 */

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const source = (dir: string) => walk(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
const importsOf = (file: string) => [...fs.readFileSync(file, 'utf8').matchAll(/^import (?!type\b)[^;]*?from '([^']+)'/gms)].map((m) => m[1]!);

describe('architecture', () => {
  it('src/domain stays pure: no React, Supabase, router or app imports', () => {
    for (const file of source('src/domain')) {
      for (const spec of importsOf(file)) {
        expect(spec, `${file} imports ${spec}`).toMatch(/^\.\.?\/|^zod$/);
      }
    }
  });

  it('only src/api (and lib/) may talk to Supabase; screens, hooks and ui never do', () => {
    for (const file of [...source('src/features'), ...source('src/ui'), ...source('src/app')]) {
      for (const spec of importsOf(file)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/supabase/);
      }
    }
  });

  it('src/api does not import from features or ui (data access never depends on screens)', () => {
    for (const file of source('src/api')) {
      for (const spec of importsOf(file)) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^@\/(features|ui|app)\b/);
      }
    }
  });

  it('features do not import each other’s internals (shared pieces live in ui, lib, domain or household)', () => {
    const allowed = new Set(['household', 'shell', 'auth', 'activity']); // shared building blocks: access, shell, session, notifications
    const aggregators = new Set(['you']); // the You tab summarises money and chores, so it reads their hooks
    for (const file of source('src/features')) {
      const own = file.split(path.sep)[2];
      for (const spec of importsOf(file)) {
        const m = /^@\/features\/([^/]+)\//.exec(spec);
        if (m && m[1] !== own && !aggregators.has(own!)) expect(allowed.has(m[1]!), `${file} reaches into features/${m[1]}`).toBe(true);
      }
    }
  });

  it('no secret or service key is written in client code', () => {
    for (const file of [...source('src'), ...source('e2e')]) {
      const text = fs.readFileSync(file, 'utf8');
      if (file.endsWith(path.join('lib', 'env.ts'))) continue; // the guard that rejects secret keys mentions the prefix
      expect(text, file).not.toMatch(/sb_secret_[A-Za-z0-9_-]{6,}|service_role|eyJhbGciOi/);
    }
  });

  it('no VITE_ variable is named like a secret', () => {
    const text = fs.readFileSync('.env.example', 'utf8');
    expect(text).not.toMatch(/VITE_\w*(SECRET|SERVICE|PRIVATE)/i);
  });
});

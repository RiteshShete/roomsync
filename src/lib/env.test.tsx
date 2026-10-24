import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnvMissingScreen } from '@/app/EnvMissingScreen';
import { readEnv } from './env';

const jwt = (payload: object) => `x.${btoa(JSON.stringify(payload))}.y`;

describe('readEnv', () => {
  it('accepts a URL and a publishable key', () => {
    expect(readEnv({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' })).toEqual({
      ok: true,
      url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_abc',
    });
  });

  it('accepts a legacy anon JWT', () => {
    const r = readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon' }) });
    expect(r.ok).toBe(true);
  });

  it.each([
    [{}, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']],
    [{ VITE_SUPABASE_URL: 'http://x' }, ['VITE_SUPABASE_PUBLISHABLE_KEY']],
    [{ VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }, ['VITE_SUPABASE_URL']],
    [{ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']],
  ])('reports what is missing for %j', (source, missing) => {
    expect(readEnv(source)).toEqual({ ok: false, missing, secretKey: false });
  });

  it('rejects a URL that is not a URL', () => {
    const r = readEnv({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' });
    expect(r.ok).toBe(false);
  });

  it('refuses secret keys instead of shipping them (rule 3)', () => {
    expect(readEnv({ VITE_SUPABASE_URL: 'http://x', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' })).toEqual({
      ok: false,
      missing: [],
      secretKey: true,
    });
    expect(
      readEnv({ VITE_SUPABASE_URL: 'http://x', VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }) }),
    ).toMatchObject({ ok: false, secretKey: true });
  });
});

describe('EnvMissingScreen', () => {
  it('lists missing variables by name with a fix, and never shows values', () => {
    render(<EnvMissingScreen missing={['VITE_SUPABASE_URL']} secretKey={false} />);
    expect(screen.getByRole('heading', { name: /isn’t configured/i })).toBeInTheDocument();
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument();
    expect(screen.getByText(/copy \.env\.example/i)).toBeInTheDocument();
  });

  it('explains a rejected secret key without echoing it', () => {
    render(<EnvMissingScreen missing={[]} secretKey />);
    expect(screen.getByRole('alert')).toHaveTextContent(/looks like a secret key/i);
  });
});

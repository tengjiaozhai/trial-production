import { afterEach, describe, expect, it, vi } from 'vitest';

describe('localAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('bypasses login in dev when mode is bypass', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_LOCAL_AUTH_MODE', 'bypass');

    const { shouldBypassLocalLogin, getLocalBypassUser } = await import('../config/localAuth');

    expect(shouldBypassLocalLogin()).toBe(true);
    expect(getLocalBypassUser()).toEqual({
      username: '本地开发',
      staffNo: 'DEV000',
    });
  });

  it('shows login page in dev when mode is sso', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_LOCAL_AUTH_MODE', 'sso');

    const { shouldBypassLocalLogin, shouldForceLocalLoginPage } = await import('../config/localAuth');

    expect(shouldBypassLocalLogin()).toBe(false);
    expect(shouldForceLocalLoginPage()).toBe(true);
  });

  it('ignores local overrides in production build', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_LOCAL_AUTH_MODE', 'bypass');

    const { getLocalAuthSettings, shouldBypassLocalLogin } = await import('../config/localAuth');

    expect(getLocalAuthSettings()).toEqual({ active: false });
    expect(shouldBypassLocalLogin()).toBe(false);
  });
});

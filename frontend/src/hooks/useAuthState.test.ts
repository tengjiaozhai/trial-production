// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../lib/auth', () => ({
  checkLoginStatus: vi.fn(),
}));
vi.mock('../config/localAuth', () => ({
  shouldBypassLocalLogin: vi.fn(() => false),
  getLocalBypassUser: vi.fn(() => null),
}));

import { useAuthState } from './useAuthState';
import { checkLoginStatus } from '../lib/auth';

describe('useAuthState', () => {
  beforeEach(() => {
    vi.mocked(checkLoginStatus).mockReset();
  });

  it('starts with isChecking=true, then resolves to logged-out', async () => {
    vi.mocked(checkLoginStatus).mockResolvedValue({ isLoggedIn: false });
    const { result } = renderHook(() => useAuthState());
    expect(result.current.isChecking).toBe(true);
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.currentUser).toBeNull();
  });

  it('sets currentUser when logged in', async () => {
    vi.mocked(checkLoginStatus).mockResolvedValue({
      isLoggedIn: true,
      user: { username: 'u', staffNo: 's' },
    });
    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    expect(result.current.currentUser).toEqual({ username: 'u', staffNo: 's' });
  });
});

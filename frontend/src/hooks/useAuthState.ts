import { useEffect, useState } from 'react';
import { checkLoginStatus } from '../lib/auth';
import type { UserInfo } from '../lib/auth';
import { getLocalBypassUser, shouldBypassLocalLogin } from '../config/localAuth';

export function useAuthState() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    (async () => {
      if (shouldBypassLocalLogin()) {
        setIsLoggedIn(true);
        setCurrentUser(getLocalBypassUser());
        setIsChecking(false);
        return;
      }
      const status = await checkLoginStatus();
      setIsLoggedIn(status.isLoggedIn);
      setCurrentUser(status.user ?? null);
      setIsChecking(false);
    })();
  }, []);

  return { isLoggedIn, setIsLoggedIn, isChecking, setIsChecking, currentUser, setCurrentUser };
}

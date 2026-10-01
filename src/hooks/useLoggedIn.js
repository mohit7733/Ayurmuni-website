import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticated, readAuthenticated } from '../services/guestAuth';

export default function useLoggedIn() {
  const { pathname } = useLocation();
  const [loggedIn, setLoggedIn] = useState(readAuthenticated);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await isAuthenticated();
      if (alive) setLoggedIn(ok);
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  return loggedIn;
}

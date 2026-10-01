import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { showSuccessToast } from '../config/key';
import useLoggedIn from '../hooks/useLoggedIn';

export default function RequireAuth() {
  const loggedIn = useLoggedIn();
  const location = useLocation();
  const toasted = useRef(false);

  useEffect(() => {
    if (loggedIn || toasted.current) return;
    toasted.current = true;
    showSuccessToast('Please login to continue', 'error');
  }, [loggedIn]);

  if (!loggedIn) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}

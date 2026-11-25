import { Navigate, Outlet } from 'react-router-dom';
import useLoggedIn from '../hooks/useLoggedIn';
import { peekReturnPath } from '../services/authReturn';

/** Welcome and login stay closed while a session exists. Logout clears the session first. */
export default function RedirectIfSignedIn() {
  const loggedIn = useLoggedIn();
  if (loggedIn) return <Navigate to={peekReturnPath() || '/'} replace />;
  return <Outlet />;
}

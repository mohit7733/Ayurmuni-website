import { useEffect, useState } from 'react';
import NetworkError from '../pages/NetworkError';

export default function NetworkGuard({ children }) {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!online) {
    return <NetworkError onGoBack={() => setOnline(navigator.onLine)} />;
  }

  return children;
}

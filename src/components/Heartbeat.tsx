import { useUser } from '@clerk/react';
import { useEffect } from 'react';

export default function Heartbeat() {
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!isSignedIn) return;

    console.log("started counting");
    const interval = setInterval(() => {
      console.log("a minute passed");
      fetch('/api/heartbeat', { method: 'POST', credentials: 'include' });
    }, 60000);

    return () => clearInterval(interval);
  }, [isSignedIn]);

  return null;
}
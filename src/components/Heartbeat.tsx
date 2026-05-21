import { useUser } from '@clerk/react';
import { useEffect, useRef } from 'react';

export default function Heartbeat() {
  const { isSignedIn } = useUser();
  const sessionId = useRef(Math.random().toString(36).substring(7));

  useEffect(() => {
    if (!isSignedIn) return;

    const interval = setInterval(() => {
      fetch('/api/heartbeat', { 
        method: 'POST', 
        credentials: 'include',
        headers: { 'X-Session-Id': sessionId.current }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [isSignedIn]);

  return null;
}
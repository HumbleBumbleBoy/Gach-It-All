import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/react';

export default function Heartbeat() {
  const { isSignedIn } = useUser();
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    if (!isSignedIn) return;
    
    const sendHeartbeat = async () => {
      const now = Date.now();
      if (now - lastHeartbeatRef.current < 60000) return;
      lastHeartbeatRef.current = now;
      
      try {
        await fetch('/api/heartbeat', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.log(error)
      }
    };
    
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, 60000);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSignedIn]);
  
  return null;
}
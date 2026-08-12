import { useEffect, useState } from 'react';
import { checkIsOnline, subscribeToNetworkStatus } from '@/Utils/Network';

/**
 * Reactive online/offline flag for gating UI (disabling buttons, showing a
 * banner) and for gating actions before they fire. This is the "instant,
 * cached" signal â€” Api.js still does its own authoritative check on every
 * request in case connectivity flips between render and tap.
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    checkIsOnline().then(online => {
      if (mounted) {
        setIsOnline(online);
      }
    });

    const unsubscribe = subscribeToNetworkStatus(online => {
      if (mounted) {
        setIsOnline(online);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return isOnline;
};

export default useNetworkStatus;

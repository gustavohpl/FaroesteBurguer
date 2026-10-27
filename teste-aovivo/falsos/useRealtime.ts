import { useEffect } from 'react';
export function useDeliveryRealtime(cb: () => void) { useEffect(() => { const id = setInterval(cb, 1500); return () => clearInterval(id); }, [cb]); return { isRealtimeConnected: false }; }

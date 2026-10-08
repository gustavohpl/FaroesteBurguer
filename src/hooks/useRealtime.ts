import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase/client';

interface UseRealtimeOptions {
  keyPrefixes: string[];
  onDataChange: () => void;
  enabled?: boolean;
  realtimePollingInterval?: number;
  fallbackPollingInterval?: number;
  channelName?: string;
}

export function useRealtime({
  keyPrefixes,
  onDataChange,
  enabled = true,
  realtimePollingInterval = 30000,
  fallbackPollingInterval = 3000,
  channelName = 'kv-changes',
}: UseRealtimeOptions) {
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const onDataChangeRef = useRef(onDataChange);
  const mountedRef = useRef(true);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const lastRefreshRef = useRef(0);
  const debouncedRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    if (mountedRef.current) {
      onDataChangeRef.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    let realtimeActive = false;

    const setupRealtime = () => {
      try {
        console.log(`[Realtime] Iniciando conexao do canal "${channelName}"...`);
        console.log(`[Realtime] Supabase client disponivel:`, !!supabase);
        console.log(`[Realtime] Prefixos monitorados:`, keyPrefixes);

        const channel = supabase
          .channel(channelName, {
            config: { broadcast: { self: false } }
          })
          .on(
            'postgres_changes' as any,
            {
              event: '*',
              schema: 'public',
              table: 'kv_store_dfe23da2',
            },
            (payload: any) => {
              const key = (payload?.new?.key || payload?.old?.key || '').replace(/^unit:[^:]+:/, '');
              const isRelevant = keyPrefixes.some(prefix => key.startsWith(prefix));

              if (isRelevant) {
                console.log(`[Realtime] Mudanca detectada: ${key}`);
                debouncedRefresh();
              }
            }
          )
          .subscribe((status: string) => {
            console.log(`[Realtime] Status do canal "${channelName}":`, status);
            if (!mountedRef.current) return;

            if (status === 'SUBSCRIBED') {
              console.log(`[Realtime] Canal "${channelName}" conectado com sucesso`);
              realtimeActive = true;
              setIsRealtimeConnected(true);
              setupPolling(realtimePollingInterval);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[Realtime] Canal "${channelName}" falhou (${status}) — usando polling rapido`);
              realtimeActive = false;
              setIsRealtimeConnected(false);
              setupPolling(fallbackPollingInterval);
            } else if (status === 'CLOSED') {
              console.log(`[Realtime] Canal "${channelName}" fechado`);
              realtimeActive = false;
              setIsRealtimeConnected(false);
            }
          });

        channelRef.current = channel;
        console.log(`[Realtime] Canal "${channelName}" criado, aguardando subscribe...`);

        setTimeout(() => {
          if (mountedRef.current && !realtimeActive) {
            console.warn(`[Realtime] Canal "${channelName}" nao conectou em 10s — mantendo polling rapido (${fallbackPollingInterval}ms)`);
          }
        }, 10000);
      } catch (err) {
        console.warn('[Realtime] Erro ao criar canal — usando polling:', err);
        setIsRealtimeConnected(false);
        setupPolling(fallbackPollingInterval);
      }
    };

    const setupPolling = (interval: number) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      pollingRef.current = setInterval(() => {
        if (mountedRef.current) {
          onDataChangeRef.current();
        }
      }, interval);
    };

    setupPolling(fallbackPollingInterval);
    setupRealtime();

    return () => {
      mountedRef.current = false;

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {}
        channelRef.current = null;
      }
    };
  }, [enabled, channelName, keyPrefixes.join(','), realtimePollingInterval, fallbackPollingInterval, debouncedRefresh]);

  return { isRealtimeConnected };
}

export function useOrdersRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'orders-realtime',
    realtimePollingInterval: 15000,
    fallbackPollingInterval: 3000,
  });
}

export function useDeliveryRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:', 'driver:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'delivery-realtime',
    realtimePollingInterval: 15000,
    fallbackPollingInterval: 3000,
  });
}

export function useClientOrderRealtime(onRefresh: () => void, enabled = true) {
  return useRealtime({
    keyPrefixes: ['order:', 'archive:'],
    onDataChange: onRefresh,
    enabled,
    channelName: 'client-order-realtime',
    realtimePollingInterval: 30000,
    fallbackPollingInterval: 5000,
  });
}
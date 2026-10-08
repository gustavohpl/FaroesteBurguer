import { projectId } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2/meta`;

export function usePixelTracking() {
  
  const trackEvent = async (eventType: string, data: any) => {
    try {
      if (window.fbq) {
        window.fbq('track', eventType, data);
      }

      fetch(`${SERVER_URL}/conversions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventType,
          event_time: Math.floor(Date.now() / 1000),
          custom_data: data,
          event_source_url: window.location.href
        })
      }).catch(err => console.error('Tracking Error:', err));
      
    } catch (error) {
      console.error('Pixel Error:', error);
    }
  };

  return { trackEvent };
}

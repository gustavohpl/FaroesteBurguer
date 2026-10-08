const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|::1|fc00:|fe80:)/;

function extractIpFromCandidate(candidateStr: string): string | null {
  const parts = candidateStr.split(' ');
  
  if (parts.length >= 5) {
    const ip = parts[4];
    if (ip && isValidIp(ip)) {
      return ip;
    }
  }
  return null;
}

function isValidIp(str: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(str)) return true;
  if (str.includes(':') && /^[0-9a-fA-F:]+$/.test(str)) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_REGEX.test(ip);
}

export interface WebRTCLeakResult {
  realIp: string | null;
  allIps: string[];
  blocked: boolean;
  durationMs: number;
}

export function detectWebRTCLeak(timeoutMs = 5000): Promise<WebRTCLeakResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const foundIps = new Set<string>();
    let resolved = false;

    const finish = (blocked = false) => {
      if (resolved) return;
      resolved = true;
      
      const allIps = Array.from(foundIps);
      const publicIps = allIps.filter(ip => !isPrivateIp(ip));
      
      resolve({
        realIp: publicIps.length > 0 ? publicIps[0] : null,
        allIps,
        blocked,
        durationMs: Date.now() - startTime
      });
    };

    const timer = setTimeout(() => {
      finish(foundIps.size === 0);
    }, timeoutMs);

    try {
      const RTCPeerConnection = (window as any).RTCPeerConnection 
        || (window as any).webkitRTCPeerConnection 
        || (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        clearTimeout(timer);
        finish(true);
        return;
      }

      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' },
        ]
      };

      const pc = new RTCPeerConnection(config);
      
      pc.createDataChannel('webrtc-leak-detect');

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timer);
          setTimeout(() => {
            try { pc.close(); } catch (_) {}
            finish();
          }, 300);
          return;
        }

        const candidate = event.candidate.candidate;
        if (!candidate) return;

        const ip = extractIpFromCandidate(candidate);
        if (ip) {
          foundIps.add(ip);

          if (!isPrivateIp(ip) && !resolved) {
            clearTimeout(timer);
            setTimeout(() => {
              try { pc.close(); } catch (_) {}
              finish();
            }, 500);
          }
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          setTimeout(() => {
            try { pc.close(); } catch (_) {}
            finish();
          }, 100);
        }
      };

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timer);
          try { pc.close(); } catch (_) {}
          finish(true);
        });

    } catch (e) {
      clearTimeout(timer);
      console.warn('[WebRTC Leak] Erro ao inicializar:', e);
      finish(true);
    }
  });
}

let cachedResult: WebRTCLeakResult | null = null;
let detectPromise: Promise<WebRTCLeakResult> | null = null;

export async function getWebRTCLeakIp(): Promise<string | null> {
  if (cachedResult) return cachedResult.realIp;
  
  if (!detectPromise) {
    detectPromise = detectWebRTCLeak().then(result => {
      cachedResult = result;
      if (result.realIp) {
        console.log(`[WebRTC Leak] IP real detectado: ${result.realIp} (${result.durationMs}ms)`);
      } else if (result.blocked) {
        console.log(`[WebRTC Leak] WebRTC bloqueado ou indisponivel (${result.durationMs}ms)`);
      } else {
        console.log(`[WebRTC Leak] Apenas IPs privados encontrados: ${result.allIps.join(', ')} (${result.durationMs}ms)`);
      }
      return result;
    });
  }
  
  const result = await detectPromise;
  return result.realIp;
}

export function warmupWebRTCDetection(): void {
  getWebRTCLeakIp().catch(() => {});
}

export interface BrowserFingerprint {
  timezone: string;
  timezoneOffset: number;
  language: string;
  languages: string[];
  screen: string;
  platform: string;
  localTime: string;
}

export function getBrowserFingerprint(): BrowserFingerprint {
  let timezone = 'unknown';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch (_) {}

  const timezoneOffset = new Date().getTimezoneOffset();
  const language = navigator.language || 'unknown';
  const languages = Array.from(navigator.languages || [language]);
  
  const screenW = window.screen?.width || 0;
  const screenH = window.screen?.height || 0;
  const screen = `${screenW}x${screenH}`;
  
  const platform = (navigator as any).userAgentData?.platform 
    || navigator.platform 
    || 'unknown';

  const localTime = new Date().toLocaleString('pt-BR', { 
    timeZone: timezone !== 'unknown' ? timezone : undefined 
  });

  return {
    timezone,
    timezoneOffset,
    language,
    languages,
    screen,
    platform,
    localTime,
  };
}
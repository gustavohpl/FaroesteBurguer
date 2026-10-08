import * as kv from "./kv_retry.tsx";
import type { AuditLog, BrowserInfo, GeoResult } from "./types.tsx";
import { enrichIpGeo } from "./geo.tsx";
import { writeAuditLog } from "./server_utils.tsx";
import { updateIpReputation } from "./reputation.tsx";

export async function emitSecurityAlert(log: Record<string, unknown>): Promise<void> {
  try {
    const alert: Record<string, unknown> = {
      _key: 'security_alert:latest',
      id: log.id,
      action: log.action,
      username: log.username,
      ip: log.ip,
      status: log.status,
      geo: log.geo || null,
      userAgent: log.userAgent || '',
      isVpn: (log.geo as Record<string, unknown>)?.isVpn || false,
      timestamp: log.timestamp || new Date().toISOString(),
      emittedAt: new Date().toISOString()
    };
    if (log.realIp) {
      alert.realIp = log.realIp;
      alert.realGeo = log.realGeo || null;
      alert.webrtcLeak = true;
    }
    if (log.browserInfo) alert.browserInfo = log.browserInfo;
    if (log.timezoneMismatch || log.languageMismatch) {
      alert.timezoneMismatch = log.timezoneMismatch || false;
      alert.languageMismatch = log.languageMismatch || false;
      alert.mismatchDetails = log.mismatchDetails || '';
    }
    if (log.autoBlacklist) {
      alert.autoBlacklist = true;
      alert.relatedVpnIp = log.relatedVpnIp || null;
    }
    if (log.fingerprintId) {
      alert.fingerprintId = log.fingerprintId;
      alert.fingerprintIps = log.fingerprintIps || [];
      alert.fingerprintIpCount = log.fingerprintIpCount || 0;
      alert.fingerprintDetails = log.fingerprintDetails || '';
    }
    await kv.set('security_alert:latest', alert);
    const tags = [
      log.realIp ? `IP Real: ${log.realIp}` : '',
      log.timezoneMismatch ? 'TZ-MISMATCH' : '',
      log.languageMismatch ? 'LANG-MISMATCH' : '',
      log.autoBlacklist ? 'AUTO-BLACKLIST' : '',
      log.fingerprintId ? `FP: ${log.fingerprintId} (${log.fingerprintIpCount} IPs)` : ''
    ].filter(Boolean).join(' | ');
    console.log(`🚨 [ALERT] ${log.action} | IP: ${log.ip}${tags ? ` | ${tags}` : ''}`);
  } catch (e) {
    console.error('❌ [ALERT] Erro ao emitir alerta:', e);
  }
}

export async function checkIpBlacklist(ip: string): Promise<Record<string, unknown> | null> {
  if (!ip || ip === 'unknown') return null;
  try {
    const whitelisted = await checkIpWhitelist(ip);
    if (whitelisted) {
      console.log(`✅ [WHITELIST] IP ${ip} está na whitelist — bypass da blacklist`);
      return null;
    }
    const blacklist: Array<Record<string, unknown>> = await kv.get('ip_blacklist') || [];
    return blacklist.find(entry => entry.ip === ip && entry.active !== false) || null;
  } catch (e) {
    console.error('❌ [BLACKLIST] Erro ao verificar IP:', e);
    return null;
  }
}

export async function checkIpWhitelist(ip: string): Promise<Record<string, unknown> | null> {
  if (!ip || ip === 'unknown') return null;
  try {
    const whitelist: Array<Record<string, unknown>> = await kv.get('ip_whitelist') || [];
    return whitelist.find(entry => entry.ip === ip && entry.active !== false) || null;
  } catch (e) {
    console.error('❌ [WHITELIST] Erro ao verificar IP:', e);
    return null;
  }
}

export async function autoBlacklistIp(ip: string, reason: string, extra?: { geo?: GeoResult | null; relatedVpnIp?: string }): Promise<void> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1') return;
  try {
    const whitelisted = await checkIpWhitelist(ip);
    if (whitelisted) {
      console.log(`✅ [AUTO-BLACKLIST SKIP] IP ${ip} está na whitelist — não será auto-bloqueado`);
      return;
    }

    const blacklist: Array<Record<string, unknown>> = await kv.get('ip_blacklist') || [];
    const existing = blacklist.find(entry => entry.ip === ip && entry.active !== false);
    if (existing) {
      console.log(`🛑 [AUTO-BLACKLIST] IP ${ip} já está na blacklist, ignorando`);
      return;
    }
    
    blacklist.push({
      ip,
      reason,
      blockedAt: new Date().toISOString(),
      blockedBy: 'sistema (auto-blacklist)',
      geo: extra?.geo || null,
      relatedVpnIp: extra?.relatedVpnIp || null,
      active: true,
      autoBlocked: true
    });
    await kv.set('ip_blacklist', blacklist);
    console.log(`🛑 [AUTO-BLACKLIST] IP ${ip} bloqueado automaticamente. Motivo: ${reason}`);
  } catch (e) {
    console.error('❌ [AUTO-BLACKLIST] Erro ao bloquear IP:', e);
  }
}

export function detectTimezoneMismatch(browserInfo: BrowserInfo | null, ipGeo: GeoResult | null): { mismatch: boolean; details: string } {
  if (!browserInfo?.timezone || browserInfo.timezone === 'unknown' || !ipGeo?.timezone) {
    return { mismatch: false, details: '' };
  }
  const browserTz = browserInfo.timezone;
  const ipTz = ipGeo.timezone;
  const browserContinent = browserTz.split('/')[0];
  const ipContinent = ipTz.split('/')[0];
  
  if (browserContinent !== ipContinent) {
    return { mismatch: true, details: `Continente divergente: browser=${browserTz} vs IP=${ipTz}` };
  }
  if (browserTz !== ipTz) {
    return { mismatch: true, details: `Timezone divergente (mesmo continente): browser=${browserTz} vs IP=${ipTz}` };
  }
  return { mismatch: false, details: '' };
}

export function detectLanguageMismatch(browserInfo: BrowserInfo | null, ipGeo: GeoResult | null): { mismatch: boolean; details: string } {
  if (!browserInfo?.language || browserInfo.language === 'unknown' || !ipGeo?.country) {
    return { mismatch: false, details: '' };
  }
  const lang = browserInfo.language.toLowerCase();
  const country = (ipGeo.country || '').toLowerCase();
  
  const langCountryMap: Record<string, string[]> = {
    'pt': ['brazil', 'brasil', 'portugal', 'angola', 'mozambique', 'moçambique'],
    'en': ['united states', 'united kingdom', 'canada', 'australia', 'new zealand', 'ireland'],
    'es': ['spain', 'españa', 'mexico', 'méxico', 'argentina', 'colombia', 'chile', 'peru', 'perú'],
    'de': ['germany', 'deutschland', 'austria', 'österreich', 'switzerland'],
    'fr': ['france', 'canada', 'belgium', 'belgique', 'switzerland'],
    'it': ['italy', 'italia'],
    'ja': ['japan'],
    'ko': ['south korea', 'korea'],
    'zh': ['china', 'taiwan', 'hong kong', 'singapore'],
    'ru': ['russia', 'россия'],
  };
  
  const baseLang = lang.split('-')[0];
  const expectedCountries = langCountryMap[baseLang];
  
  if (expectedCountries && !expectedCountries.some(c => country.includes(c))) {
    return { mismatch: true, details: `Idioma "${browserInfo.language}" incompatível com país do IP "${ipGeo.country}"` };
  }
  return { mismatch: false, details: '' };
}

export function generateBrowserFingerprint(browserInfo: BrowserInfo | null): string | null {
  if (!browserInfo) return null;
  const parts = [
    browserInfo.timezone || '?',
    browserInfo.language || '?',
    (browserInfo.languages || []).join(',') || '?',
    browserInfo.screen || '?',
    browserInfo.platform || '?'
  ];
  const raw = parts.join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `fp_${Math.abs(hash).toString(36)}_${raw.length}`;
}

export async function trackBrowserFingerprint(
  fingerprint: string,
  ip: string,
  username: string,
  action: string,
  browserInfo: BrowserInfo
): Promise<{ suspicious: boolean; ipCount: number; ips: string[]; details: string }> {
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const THRESHOLD = 3;
  const key = `browser_fp:${fingerprint}`;
  
  try {
    const record: Record<string, unknown> = (await kv.get(key) as Record<string, unknown>) || { ips: [], entries: [], createdAt: new Date().toISOString() };
    
    const cutoff = Date.now() - WINDOW_MS;
    record.entries = ((record.entries as Array<Record<string, unknown>>) || []).filter(e => new Date(e.at as string).getTime() > cutoff);
    
    (record.entries as Array<Record<string, unknown>>).push({
      ip, username, action, at: new Date().toISOString()
    });
    
    const uniqueIps = [...new Set((record.entries as Array<Record<string, unknown>>).map(e => e.ip as string))];
    record.ips = uniqueIps;
    record.lastSeen = new Date().toISOString();
    record.lastIp = ip;
    record.lastUsername = username;
    record.browserInfo = browserInfo;
    record._key = key;
    
    if ((record.entries as Array<unknown>).length > 100) {
      record.entries = (record.entries as Array<unknown>).slice(-100);
    }
    
    await kv.set(key, record);
    
    const suspicious = uniqueIps.length >= THRESHOLD;
    const details = suspicious
      ? `Fingerprint ${fingerprint} visto em ${uniqueIps.length} IPs diferentes nas últimas 24h: ${uniqueIps.join(', ')}. Possível VPN hopping.`
      : '';
    
    if (suspicious) {
      console.log(`🧬 [FINGERPRINT] SUSPEITO: ${fingerprint} — ${uniqueIps.length} IPs: ${uniqueIps.join(', ')} | User: ${username}`);
    }
    
    return { suspicious, ipCount: uniqueIps.length, ips: uniqueIps, details };
  } catch (e) {
    console.error('❌ [FINGERPRINT] Erro ao rastrear:', e);
    return { suspicious: false, ipCount: 0, ips: [], details: '' };
  }
}

export function writeAuditLogWithGeo(params: {
  action: string;
  username: string;
  ip: string;
  details: string;
  status: 'success' | 'failure';
  userAgent?: string;
  webrtcIp?: string | null;
  browserInfo?: BrowserInfo | null;
}): void {
  const geoPromise = enrichIpGeo(params.ip);
  const whitelistPromise = checkIpWhitelist(params.ip).catch(() => null);
  
  const hasRealIp = params.webrtcIp && params.webrtcIp !== params.ip;
  const realGeoPromise = hasRealIp
    ? enrichIpGeo(params.webrtcIp!).catch(() => null)
    : Promise.resolve(null);

  Promise.all([geoPromise, realGeoPromise, whitelistPromise]).then(async ([geo, realGeo, whitelistEntry]) => {
    const isWhitelisted = !!whitelistEntry;
    if (isWhitelisted) {
      console.log(`✅ [WHITELIST] IP ${params.ip} é um IP permitido — marcando no audit log`);
    }
    
    let isRealIpWhitelisted = false;
    if (hasRealIp && params.webrtcIp) {
      const realWl = await checkIpWhitelist(params.webrtcIp).catch(() => null);
      isRealIpWhitelisted = !!realWl;
      if (isRealIpWhitelisted) {
        console.log(`✅ [WHITELIST] IP real ${params.webrtcIp} também é um IP permitido`);
      }
    }
    
    const isTrustedIp = isWhitelisted || isRealIpWhitelisted;
    
    const tzMismatch = detectTimezoneMismatch(params.browserInfo || null, geo);
    const langMismatch = detectLanguageMismatch(params.browserInfo || null, geo);
    const mismatchDetails = [
      tzMismatch.mismatch ? tzMismatch.details : '',
      langMismatch.mismatch ? langMismatch.details : ''
    ].filter(Boolean).join(' | ');

    if (tzMismatch.mismatch) {
      console.log(`🌐 [TIMEZONE MISMATCH] ${tzMismatch.details} | User: ${params.username} | IP: ${params.ip}`);
    }
    if (langMismatch.mismatch) {
      console.log(`🌐 [LANGUAGE MISMATCH] ${langMismatch.details} | User: ${params.username} | IP: ${params.ip}`);
    }

    const log = await writeAuditLog({
      ...params,
      geo,
      realIp: hasRealIp ? params.webrtcIp! : null,
      realGeo,
      browserInfo: params.browserInfo || null,
      timezoneMismatch: tzMismatch.mismatch,
      languageMismatch: langMismatch.mismatch,
      mismatchDetails: mismatchDetails || undefined,
      whitelisted: isWhitelisted || isRealIpWhitelisted
    });

    if (isTrustedIp) {
      console.log(`✅ [WHITELIST] IP ${params.ip} é permitido — suprimindo alertas de segurança (login ${params.status})`);
    }
    
    if (params.status === 'failure' && log && !isTrustedIp) {
      emitSecurityAlert({ ...log, geo, realIp: log.realIp, realGeo: log.realGeo }).catch(() => {});
      
      if (hasRealIp && params.webrtcIp && !isRealIpWhitelisted) {
        const reason = `Auto-bloqueio: IP real ${params.webrtcIp} detectado via WebRTC Leak em tentativa de login falha (${params.action}). IP VPN: ${params.ip}. User: ${params.username}`;
        autoBlacklistIp(params.webrtcIp, reason, { geo: realGeo, relatedVpnIp: params.ip }).then(() => {
          emitSecurityAlert({
            id: `auto_bl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            action: 'IP_AUTO_BLACKLISTED',
            username: params.username,
            ip: params.webrtcIp,
            status: 'failure',
            geo: realGeo,
            realIp: params.webrtcIp,
            realGeo,
            userAgent: params.userAgent || '',
            timestamp: new Date().toISOString(),
            browserInfo: params.browserInfo,
            autoBlacklist: true,
            relatedVpnIp: params.ip
          }).catch(() => {});
          console.log(`🛑 [AUTO-BLACKLIST] IP real ${params.webrtcIp} bloqueado automaticamente após falha de login via VPN ${params.ip}`);
        }).catch(() => {});
      }
    }

    if (log?.webrtcLeak && params.status === 'success' && !isTrustedIp) {
      emitSecurityAlert({ ...log, geo, realIp: log.realIp, realGeo: log.realGeo, action: 'WEBRTC_LEAK_DETECTED' }).catch(() => {});
    }

    if ((tzMismatch.mismatch || langMismatch.mismatch) && log && !isTrustedIp) {
      emitSecurityAlert({
        ...log, geo, realIp: log.realIp, realGeo: log.realGeo,
        action: 'BROWSER_MISMATCH_DETECTED',
        browserInfo: params.browserInfo,
        timezoneMismatch: tzMismatch.mismatch,
        languageMismatch: langMismatch.mismatch,
        mismatchDetails
      }).catch(() => {});
    }

    if (params.browserInfo && log) {
      const fingerprint = generateBrowserFingerprint(params.browserInfo);
      if (fingerprint) {
        trackBrowserFingerprint(fingerprint, params.ip, params.username, params.action, params.browserInfo)
          .then(async (fpResult) => {
            if (fpResult.suspicious && !isTrustedIp) {
              await emitSecurityAlert({
                id: `fp_alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                action: 'FINGERPRINT_MULTI_IP',
                username: params.username,
                ip: params.ip,
                status: 'failure',
                geo,
                realIp: log.realIp || null,
                realGeo: log.realGeo || null,
                userAgent: params.userAgent || '',
                timestamp: new Date().toISOString(),
                browserInfo: params.browserInfo,
                fingerprintId: fingerprint,
                fingerprintIps: fpResult.ips,
                fingerprintIpCount: fpResult.ipCount,
                fingerprintDetails: fpResult.details
              }).catch(() => {});
              await writeAuditLog({
                action: 'FINGERPRINT_MULTI_IP',
                username: params.username,
                ip: params.ip,
                details: fpResult.details,
                status: 'failure',
                userAgent: params.userAgent,
                geo,
                realIp: log.realIp || null,
                realGeo: log.realGeo || null,
                browserInfo: params.browserInfo
              }).catch(() => {});
            }
          }).catch(() => {});
      }
    }
  }).catch(() => {
    writeAuditLog(params).catch(() => {});
  });
}

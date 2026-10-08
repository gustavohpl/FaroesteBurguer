const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function stripTags(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

export function stripDangerousPatterns(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/data\s*:\s*application\/javascript/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, '');
}

export function sanitizeText(str: string, maxLength = 500): string {
  if (typeof str !== 'string') return '';
  
  let clean = str;
  clean = stripTags(clean);
  clean = stripDangerousPatterns(clean);
  clean = clean.trim();
  
  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  
  return clean;
}

export function sanitizeName(str: string, maxLength = 100): string {
  if (typeof str !== 'string') return '';
  
  let clean = stripTags(str);
  clean = stripDangerousPatterns(clean);
  clean = clean.replace(/[^\p{L}\p{N}\s.\-']/gu, '');
  clean = clean.trim();
  
  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  
  return clean;
}

export function sanitizePhone(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[^\d\s()\-+]/g, '').trim().slice(0, 20);
}

export function sanitizeAddress(str: string, maxLength = 300): string {
  return sanitizeText(str, maxLength);
}

export function sanitizeNotes(str: string, maxLength = 500): string {
  if (typeof str !== 'string') return '';
  
  let clean = stripTags(str);
  clean = stripDangerousPatterns(clean);
  clean = clean.trim();
  
  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  
  return clean;
}

export function sanitizeObject<T extends Record<string, any>>(obj: T, maxDepth = 5): T {
  if (maxDepth <= 0 || !obj || typeof obj !== 'object') return obj;
  
  const result: any = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item: any) => {
        if (typeof item === 'string') return sanitizeText(item);
        if (typeof item === 'object' && item !== null) return sanitizeObject(item, maxDepth - 1);
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, maxDepth - 1);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

export function sanitizeReviews(reviews: any[]): any[] | null {
  if (!Array.isArray(reviews)) return null;
  if (reviews.length === 0 || reviews.length > 50) return null;
  
  return reviews.map(r => ({
    productId: typeof r.productId === 'string' ? sanitizeText(r.productId, 100) : '',
    productName: typeof r.productName === 'string' ? sanitizeText(r.productName, 200) : '',
    rating: typeof r.rating === 'number' ? Math.max(1, Math.min(5, Math.round(r.rating))) : 5,
    comment: typeof r.comment === 'string' ? sanitizeNotes(r.comment, 500) : '',
  })).filter(r => r.productId);
}

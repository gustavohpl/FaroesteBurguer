export interface AuditLog {
  id: string;
  action: string;
  username: string;
  ip: string;
  details: string;
  status: 'success' | 'failure';
  userAgent: string;
  geo: GeoResult | null;
  timestamp: string;
  realIp?: string;
  realGeo?: GeoResult | null;
  webrtcLeak?: boolean;
  browserInfo?: BrowserInfo | null;
  timezoneMismatch?: boolean;
  languageMismatch?: boolean;
  mismatchDetails?: string;
  whitelisted?: boolean;
  autoBlacklist?: boolean;
  relatedVpnIp?: string;
  fingerprintId?: string;
  fingerprintIps?: string[];
  fingerprintIpCount?: number;
  fingerprintDetails?: string;
}

export interface BrowserInfo {
  timezone?: string;
  language?: string;
  languages?: string[];
  screen?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface GeoSourceResult {
  source: string;
  country: string;
  region: string;
  city: string;
  district: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
  isProxy: boolean;
  isHosting: boolean;
  isVpn: boolean;
}

export interface GeoResult extends GeoSourceResult {
  geoSources: number;
  geoSourcesAgree: number;
  geoSourceList?: string;
  geoConfidence: string;
  geoAccuracy: string;
  geoMaxDivergence?: number;
  geoAvgDivergence?: number;
  geoGlobalDivergence?: number;
  geoWeightedAvg?: boolean;
  geoOutliers?: number;
  geoOutlierSources?: string | null;
  geoVpnSources?: string | null;
  geoSourceDetails?: GeoSourceDetail[];
  geoZipConfirmed?: boolean;
  geoConfirmedZip?: string | null;
  geoIspType?: 'mobile' | 'fixed';
  geoRansacRefined?: number;
  geoCountryFiltered?: number;
  geoEstimatedAccuracyM?: number;
  geoP68RadiusM?: number;
  geoP95RadiusM?: number;
  geoMaxRadiusM?: number;
  geoIwcrRounds?: number;
  geoIwcrConvergenceDeltaM?: number;
  geoEngineVersion?: string;
  fromCache?: boolean;
}

export interface GeoSourceDetail {
  source: string;
  city: string;
  lat: number;
  lon: number;
  distToAvg: number;
  inCluster: boolean;
  weight: number;
  effectiveWeight: number;
  refined: boolean;
  vpn: boolean;
  zip: string;
  countryFiltered: boolean;
}

export interface IpBlacklistEntry {
  ip: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
  geo?: GeoResult | null;
  relatedVpnIp?: string | null;
  active: boolean;
  autoBlocked?: boolean;
}

export interface IpWhitelistEntry {
  ip: string;
  label?: string;
  addedAt: string;
  addedBy: string;
  active: boolean;
}

export interface IpReputationRecord {
  ip: string;
  score: number;
  signals: ReputationSignal[];
  firstSeen: string;
  lastSeen: string;
  totalEvents: number;
  isVpn: boolean;
  isBlacklisted: boolean;
  tier: ReputationTier;
  _key?: string;
}

export type ReputationTier = 'trusted' | 'neutral' | 'suspicious' | 'dangerous' | 'critical';

export interface ReputationSignal {
  type: string;
  points: number;
  at: string;
  detail?: string;
}

export interface SecurityAlert {
  _key?: string;
  id: string;
  action: string;
  username: string;
  ip: string;
  status: string;
  geo: GeoResult | null;
  userAgent: string;
  isVpn: boolean;
  timestamp: string;
  emittedAt: string;
  realIp?: string;
  realGeo?: GeoResult | null;
  webrtcLeak?: boolean;
  browserInfo?: BrowserInfo | null;
  timezoneMismatch?: boolean;
  languageMismatch?: boolean;
  mismatchDetails?: string;
  autoBlacklist?: boolean;
  relatedVpnIp?: string | null;
  fingerprintId?: string;
  fingerprintIps?: string[];
  fingerprintIpCount?: number;
  fingerprintDetails?: string;
}

export interface WebhookConfig {
  id: string;
  type: 'generic' | 'telegram' | 'discord';
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  failCount: number;
  telegramChatId?: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failure';
  statusCode?: number;
  error?: string;
  timestamp: string;
  payload?: unknown;
}

export interface SecurityMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueIps: number;
  vpnDetections: number;
  webrtcLeaks: number;
  blacklistedIps: number;
  whitelistedIps: number;
  avgReputationScore: number;
  topThreats: { ip: string; score: number; tier: string }[];
  eventTimeline: { hour: string; success: number; failure: number; vpn: number }[];
  geoDistribution: { country: string; count: number }[];
  threatDistribution: { tier: string; count: number }[];
  securityHealthScore: number;
  generatedAt: string;
}

export interface AdminSession {
  token: string;
  unitId?: string;
  username: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
  csrfToken?: string;
  _key?: string;
}

export interface MasterSession {
  token: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
  _key?: string;
}

export interface DriverSession {
  token: string;
  unitId?: string;
  phone: string;
  name: string;
  color?: string;
  vehicleType?: string;
  createdAt: string;
  expiresAt: string;
  _key?: string;
}

export interface RateLimitRecord {
  _key?: string;
  attempts: number;
  windowStart: string;
  lockedUntil?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup' | 'dine-in';
export type PaymentMethod = 'pix' | 'card' | 'cash';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string | null;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  assignedDriver?: string;
  assignedDriverPhone?: string;
  deliveryFee?: number;
  couponCode?: string;
  couponDiscount?: number;
  changeFor?: number;
  reviews?: OrderReview[];
  cancellationReason?: string;
  paymentStatus?: string;
  paymentReferenceId?: string;
  _key?: string;
}

export interface OrderReview {
  productId: string;
  productName: string;
  rating: number;
  comment: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName?: string;
  quantityUsed: number;
  selectedPortionId?: string;
  selectedPortionG?: number;
  selectedPortionLabel?: string;
  hideFromClient: boolean;
  category?: 'ingredient' | 'embalagem' | 'acompanhamento';
  defaultQuantityPerOrder?: number;
}

export interface ExtraIngredient {
  name: string;
  hideFromClient: boolean;
}

export interface ServerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string | null;
  available?: boolean;
  featuredRating?: boolean;
  ingredientsText?: string;
  recipe?: {
    ingredients: RecipeIngredient[];
    extras: ExtraIngredient[];
  };
  promoItems?: PromoItem[];
  originalTotal?: number;
  _key?: string;
}

export interface PromoItem {
  productId: string;
  productName: string;
  originalPrice: number;
}

export interface PortionOption {
  id: string;
  label: string;
  grams: number;
}

export interface StockIngredient {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock?: number;
  minAlert?: number;
  costPerUnit?: number;
  pricePerKg?: number;
  pricePerUnit?: number;
  unitBatchSize?: number;
  category?: 'ingredient' | 'embalagem' | 'acompanhamento';
  defaultQuantity?: number;
  portionOptions?: PortionOption[];
  purchaseHistory?: PurchaseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  _key?: string;
}

export interface PurchaseHistoryEntry {
  date: string;
  quantity: number;
  costPerUnit: number;
  supplier?: string;
}

export interface Category {
  id: string;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue?: number;
  maxUses?: number;
  currentUses: number;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  _key?: string;
}

export interface SystemConfig {
  storeName?: string;
  storeDescription?: string;
  storeAddress?: string;
  storePhone?: string;
  themeColor?: string;
  darkMode?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  useCategoryColorInModals?: boolean;
  headerGlassOpacity?: number;
  pagSeguroToken?: string;
  pagSeguroEmail?: string;
  adminUsername?: string;
  [key: string]: unknown;
}

export interface DeliverySector {
  id: string;
  name: string;
  fee: number;
  neighborhoods?: string[];
  polygon?: Array<{ lat: number; lng: number }>;
}

export interface DeliveryConfig {
  baseFee?: number;
  freeDeliveryThreshold?: number;
  sectors?: DeliverySector[];
  [key: string]: unknown;
}

export interface FingerprintRecord {
  ips: string[];
  entries: FingerprintEntry[];
  createdAt: string;
  lastSeen?: string;
  lastIp?: string;
  lastUsername?: string;
  browserInfo?: BrowserInfo;
  _key?: string;
}

export interface FingerprintEntry {
  ip: string;
  username: string;
  action: string;
  at: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface E2ETestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  durationMs: number;
  steps?: string[];
}

export interface TestRun {
  id: string;
  date: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[] | E2ETestResult[];
}

export interface GeoCacheEntry {
  data: GeoResult;
  ts: number;
}

export interface DeliveryEstimates {
  preparationMin?: number;
  preparationMax?: number;
  deliveryMin?: number;
  deliveryMax?: number;
  pickupMin?: number;
  pickupMax?: number;
}

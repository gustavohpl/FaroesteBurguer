import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as api from './utils/api';
import { applyTheme } from './utils/themeUtils';

export interface SystemConfig {
  siteName: string;
  themeColor: string;
  designStyle?: 'classic' | 'clean' | 'rustic' | 'prime';
  heroModelUrl?: string;
  heroEffects?: string[];
  paymentGateway?: 'pagseguro' | 'mercadopago';
  mercadoPagoAtivo?: boolean;
  primeHeroUrl?: string;
  primeHeroMobileUrl?: string;
  primeHeroTitle?: string;
  primeHeroTagline?: string;
  primeBanners?: Array<{ imageUrl: string; link?: string }>;
  primeFundo?: string;
  cleanHeroUrl?: string;
  cleanHeroMobileUrl?: string;
  rusticFundoUrl?: string;
  rusticHeroUrl?: string;
  rusticHeroMobileUrl?: string;
  phone: string;
  address: string;
  logoUrl?: string;
  headerBackgroundUrl?: string;
  headerEffectShape?: string;
  headerEffectCount?: number;
  headerEffectRandomPosition?: boolean;
  headerEffectRandomSeed?: number;
  siteSubtitle?: string;
  siteEmoji?: string;
  openingHours?: string;
  isOpen: boolean;
  deliveryFee: number;
  uiOpacity?: number;
  useCategoryColorInModals?: boolean;
  whatsappNumber?: string;
  instagramUrl?: string;
  automaticPayment?: boolean;
  manualPixKey?: string;
  hasPagSeguro?: boolean;
  hasPagSeguroToken?: boolean;
  categories?: Array<{ id: string; label: string; color?: string; emoji?: string; }>;
  features?: {
    thermalPrinter?: boolean;
    coupons?: boolean;
    reviews?: boolean;
    orderTracking?: boolean;
    paidTraffic?: boolean;
    automaticPaymentAllowed?: boolean;
    deliverySystem?: boolean;
    dineIn?: boolean;
    stockControl?: boolean;
  };
  pagSeguroToken?: string;
  pagSeguroEmail?: string;
  metaPixelId?: string;
  adminUsername?: string;
  backgroundColor?: string;
  cardColor?: string;
  textColor?: string;
  forceDarkMode?: boolean;
}

interface ConfigContextType {
  config: SystemConfig;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfigLocal: (newConfig: Partial<SystemConfig>) => void;
}

const DEFAULT_CONFIG: SystemConfig = {
  siteName: 'NewBurguer Lanches',
  themeColor: '#d97706',
  phone: '(64) 99339-2970',
  address: 'Praça Lucio Prado - Goiatuba/GO',
  isOpen: true,
  deliveryFee: 5.00,
  uiOpacity: 35
};

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  loading: true,
  refreshConfig: async () => {},
  updateConfigLocal: () => {}
});

export const useConfig = () => useContext(ConfigContext);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(() => {
    try {
      const local = localStorage.getItem('faroeste_system_config');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.themeColor) {
          applyTheme(parsed.themeColor, {
            backgroundColor: parsed.backgroundColor,
            cardColor: parsed.cardColor,
            textColor: parsed.textColor
          });
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.error('Erro ao ler config local:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [loading, setLoading] = useState(true);

  const refreshConfig = async () => {
    try {
      const response = await api.getPublicConfig();
      console.log('🔧 [CONFIG CONTEXT] Resposta do servidor:', response);
      console.log('📋 [CONFIG CONTEXT] Categorias recebidas:', response?.config?.categories);
      
      if (response.success && response.config) {
        setConfig(prev => ({ ...prev, ...response.config }));
        
        localStorage.setItem('faroeste_system_config', JSON.stringify(response.config));

        if (response.config.themeColor) {
          applyTheme(response.config.themeColor, {
            backgroundColor: response.config.backgroundColor,
            cardColor: response.config.cardColor,
            textColor: response.config.textColor
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfigLocal = (newConfig: Partial<SystemConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      if (newConfig.themeColor || newConfig.backgroundColor || newConfig.cardColor || newConfig.textColor) {
        applyTheme(updated.themeColor || prev.themeColor, {
          backgroundColor: updated.backgroundColor || prev.backgroundColor,
          cardColor: updated.cardColor || prev.cardColor,
          textColor: updated.textColor || prev.textColor
        });
      }
      return updated;
    });
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  const hasLocalConfig = typeof localStorage !== 'undefined' && !!localStorage.getItem('faroeste_system_config');
  
  if (loading && !hasLocalConfig) {
    return (
      <div className="carregando-inicial min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, loading, refreshConfig, updateConfigLocal }}>
      {children}
    </ConfigContext.Provider>
  );
}
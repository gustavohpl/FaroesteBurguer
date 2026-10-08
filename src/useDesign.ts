import { useConfig } from './ConfigContext';

export type DesignId = 'classic' | 'clean' | 'rustic' | 'prime';

export interface DesignTokens {
  id: DesignId;
  name: string;
  description: string;

  showHeaderBackground: boolean;
  headerTextClass: string;
  headerLayout: 'immersive' | 'minimal';

  pageBackgroundClass: string;

  cardClass: string;
  cardTitleClass: string;
  cardPriceClass: string;
  cardRounded: string;
  cardShadow: string;

  buttonRounded: string;
  buttonStyle: 'solid' | 'soft';

  categoryStyle: 'pill' | 'underline';

  statusStyle: 'badge' | 'dot';

  accentIntensity: 'strong' | 'subtle';
}

const DESIGNS: Record<DesignId, DesignTokens> = {
  classic: {
    id: 'classic',
    name: 'Clássico',
    description: 'Imersivo, com imagem de fundo e cards escuros',
    showHeaderBackground: true,
    headerTextClass: 'text-white',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800',
    cardTitleClass: 'text-zinc-900 dark:text-white font-bold',
    cardPriceClass: 'font-bold',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-lg',
    buttonRounded: 'rounded-full',
    buttonStyle: 'solid',
    categoryStyle: 'pill',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },

  clean: {
    id: 'clean',
    name: 'Clean',
    description: 'Minimalista, fundo claro, sem imagem, cantos suaves',
    showHeaderBackground: false,
    headerTextClass: 'text-zinc-900',
    headerLayout: 'minimal',
    pageBackgroundClass: 'bg-zinc-50',
    cardClass: 'bg-white border border-zinc-200',
    cardTitleClass: 'text-zinc-800 font-semibold',
    cardPriceClass: 'font-semibold',
    cardRounded: 'rounded-xl',
    cardShadow: 'shadow-sm hover:shadow-md',
    buttonRounded: 'rounded-lg',
    buttonStyle: 'soft',
    categoryStyle: 'underline',
    statusStyle: 'dot',
    accentIntensity: 'subtle',
  },

  rustic: {
    id: 'rustic',
    name: 'Rústico',
    description: 'Dark com dourado, textura de madeira, categorias em círculos',
    showHeaderBackground: true,
    headerTextClass: 'text-amber-50',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'border',
    cardTitleClass: 'text-amber-50 font-black uppercase',
    cardPriceClass: 'font-black',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-lg',
    buttonRounded: 'rounded-xl',
    buttonStyle: 'solid',
    categoryStyle: 'pill',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },

  prime: {
    id: 'prime',
    name: '3D Prime',
    description: 'Editorial cinematográfico: fundo quase preto, tipografia gigante, seções numeradas e cor de destaque',
    showHeaderBackground: false,
    headerTextClass: 'text-white',
    headerLayout: 'immersive',
    pageBackgroundClass: '',
    cardClass: 'border',
    cardTitleClass: 'text-white font-black uppercase',
    cardPriceClass: 'font-black',
    cardRounded: 'rounded-2xl',
    cardShadow: 'shadow-2xl',
    buttonRounded: 'rounded-full',
    buttonStyle: 'solid',
    categoryStyle: 'underline',
    statusStyle: 'badge',
    accentIntensity: 'strong',
  },
};

export function useDesign(): DesignTokens {
  const { config } = useConfig();
  const forcado = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('design') : null;
  const salvo = config.designStyle === ('threed' as string) ? 'prime' : config.designStyle;
  const style = ((forcado && forcado in DESIGNS ? forcado : salvo) as DesignId) || 'classic';
  return DESIGNS[style] || DESIGNS.classic;
}

export function getAllDesigns(): DesignTokens[] {
  return Object.values(DESIGNS);
}

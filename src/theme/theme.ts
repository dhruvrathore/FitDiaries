import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  pr: string;
  overlay: string;
};

const light: Palette = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  cardAlt: '#F0F2F5',
  border: '#E3E6EB',
  text: '#111827',
  textMuted: '#5B6472',
  textFaint: '#9AA2AF',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  accent: '#7C3AED',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
  pr: '#F59E0B',
  overlay: 'rgba(17,24,39,0.45)',
};

const dark: Palette = {
  bg: '#0B0F14',
  card: '#151B23',
  cardAlt: '#1E2630',
  border: '#2A333F',
  text: '#F3F5F7',
  textMuted: '#9BA6B4',
  textFaint: '#69727F',
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  accent: '#A78BFA',
  success: '#22C55E',
  danger: '#F87171',
  warning: '#FBBF24',
  pr: '#FBBF24',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const font = {
  h1: 30,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
};

export type Theme = {
  colors: Palette;
  dark: boolean;
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? dark : light, dark: isDark };
}

// Phase display metadata used across screens.
export const PHASES = ['strength', 'hypertrophy', 'endurance', 'deload'] as const;
export type Phase = (typeof PHASES)[number];

export const phaseLabel: Record<Phase, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  endurance: 'Endurance',
  deload: 'Deload',
};

export const phaseColor: Record<Phase, string> = {
  strength: '#2563EB',
  hypertrophy: '#7C3AED',
  endurance: '#0D9488',
  deload: '#D97706',
};

import type { ThemeStrategy } from '../types';

export const cthulhuTheme: ThemeStrategy = {
  id: 'cthulhu',
  label: 'Cthulhu',
  description: 'Mroczny, morsko-okultystyczny motyw z dekoracyjną ramą.',
  visualFrame: 'eldritch',
  radius: '0.35rem',
  tokens: {
    background: '176 28% 7%',
    foreground: '48 28% 90%',
    card: '174 24% 11%',
    cardForeground: '48 28% 90%',
    popover: '174 24% 10%',
    popoverForeground: '48 28% 90%',
    primary: '157 38% 44%',
    primaryForeground: '174 30% 7%',
    secondary: '172 20% 17%',
    secondaryForeground: '48 28% 90%',
    muted: '172 18% 15%',
    mutedForeground: '159 12% 68%',
    accent: '38 48% 48%',
    accentForeground: '176 28% 7%',
    destructive: '359 58% 42%',
    destructiveForeground: '48 28% 94%',
    border: '164 20% 26%',
    input: '164 20% 26%',
    ring: '157 38% 44%'
  }
};

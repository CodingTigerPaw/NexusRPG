import type { ThemeStrategy } from '../types';

export const vampireTheme: ThemeStrategy = {
  id: 'vampire',
  label: 'Vampire',
  description: 'Urban noir z krwistym akcentem dla sesji Vampire: The Masquerade.',
  visualFrame: 'urban-blood',
  radius: '0.3rem',
  tokens: {
    background: '330 13% 7%',
    foreground: '28 24% 91%',
    card: '330 16% 11%',
    cardForeground: '28 24% 91%',
    popover: '330 16% 10%',
    popoverForeground: '28 24% 91%',
    primary: '354 68% 44%',
    primaryForeground: '30 32% 95%',
    secondary: '336 12% 17%',
    secondaryForeground: '28 24% 91%',
    muted: '336 12% 15%',
    mutedForeground: '350 10% 68%',
    accent: '349 58% 35%',
    accentForeground: '30 32% 95%',
    destructive: '0 74% 43%',
    destructiveForeground: '30 32% 95%',
    border: '348 20% 25%',
    input: '348 20% 25%',
    ring: '354 68% 44%'
  }
};

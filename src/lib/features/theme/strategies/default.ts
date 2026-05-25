import type { ThemeStrategy } from '../types';

export const defaultTheme: ThemeStrategy = {
  id: 'default',
  label: 'Nexus',
  description: 'Bazowy, neutralny wygląd aplikacji.',
  visualFrame: 'default',
  radius: '0.45rem',
  tokens: {
    background: '220 18% 9%',
    foreground: '42 22% 92%',
    card: '220 16% 13%',
    cardForeground: '42 22% 92%',
    popover: '220 16% 13%',
    popoverForeground: '42 22% 92%',
    primary: '166 43% 46%',
    primaryForeground: '220 18% 8%',
    secondary: '218 13% 19%',
    secondaryForeground: '42 22% 92%',
    muted: '218 13% 18%',
    mutedForeground: '220 9% 66%',
    accent: '31 64% 50%',
    accentForeground: '220 18% 8%',
    destructive: '0 72% 44%',
    destructiveForeground: '45 36% 96%',
    border: '220 13% 24%',
    input: '220 13% 24%',
    ring: '166 43% 46%'
  }
};

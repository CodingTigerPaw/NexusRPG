import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { defaultThemeId, getThemeStrategy } from './theme-registry';
import type { ThemeStrategy, ThemeTokenName } from './types';

const storageKey = 'nexus-rpg.theme';

const cssVariableByToken: Record<ThemeTokenName, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring'
};

export const activeThemeId = writable(defaultThemeId);

function writeThemeToDom(theme: ThemeStrategy) {
  if (!browser) {
    return;
  }

  const root = document.documentElement;

  root.dataset.theme = theme.id;
  root.dataset.themeVisual = theme.visualFrame;

  Object.entries(theme.tokens).forEach(([tokenName, value]) => {
    root.style.setProperty(cssVariableByToken[tokenName as ThemeTokenName], value);
  });

  root.style.setProperty('--radius', theme.radius ?? '0.45rem');
}

export function applyTheme(themeId: string) {
  const theme = getThemeStrategy(themeId);

  writeThemeToDom(theme);

  if (browser) {
    localStorage.setItem(storageKey, theme.id);
  }

  activeThemeId.set(theme.id);
}

export function initializeTheme() {
  if (!browser) {
    return;
  }

  applyTheme(localStorage.getItem(storageKey) ?? defaultThemeId);
}

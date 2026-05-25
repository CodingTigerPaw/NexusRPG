export { default as ThemeProvider } from './components/ThemeProvider.svelte';
export { default as ThemeSwitcher } from './components/ThemeSwitcher.svelte';
export { activeThemeId, applyTheme, initializeTheme } from './theme-store';
export { defaultThemeId, getThemeStrategy, themeStrategies } from './theme-registry';
export type { ThemeStrategy, ThemeTokenName, ThemeVisualFrame } from './types';

import { cthulhuTheme } from './strategies/cthulhu';
import { defaultTheme } from './strategies/default';
import { vampireTheme } from './strategies/vampire';
import type { ThemeStrategy } from './types';

export const themeStrategies = [defaultTheme, cthulhuTheme, vampireTheme] as const;

export const defaultThemeId = defaultTheme.id;

export function getThemeStrategy(themeId: string | null | undefined): ThemeStrategy {
  return themeStrategies.find((theme) => theme.id === themeId) ?? defaultTheme;
}

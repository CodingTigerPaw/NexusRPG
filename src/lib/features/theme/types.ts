export type ThemeVisualFrame = 'default' | 'eldritch' | 'urban-blood';

export type ThemeTokenName =
  | 'background'
  | 'foreground'
  | 'card'
  | 'cardForeground'
  | 'popover'
  | 'popoverForeground'
  | 'primary'
  | 'primaryForeground'
  | 'secondary'
  | 'secondaryForeground'
  | 'muted'
  | 'mutedForeground'
  | 'accent'
  | 'accentForeground'
  | 'destructive'
  | 'destructiveForeground'
  | 'border'
  | 'input'
  | 'ring';

export type ThemeStrategy = {
  id: string;
  label: string;
  description: string;
  visualFrame: ThemeVisualFrame;
  tokens: Record<ThemeTokenName, string>;
  radius?: string;
};

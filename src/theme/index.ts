import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadow } from './shadow';

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadow,
} as const;

export type ThemeType = typeof theme;

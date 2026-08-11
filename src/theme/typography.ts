export const typography = {
  fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '20px',
    xl: '28px',
    '2xl': '42px',       // Large KPI numbers
    '3xl': '72px',       // Hero metrics (MTBF/OEE percentage)
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }
} as const;

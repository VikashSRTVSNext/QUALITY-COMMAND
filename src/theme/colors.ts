export const colors = {
  bg: '#08111a',            // Ultra dark industrial blue-black
  panelBg: '#0e1424',       // Sleek translucent grey-blue for modules
  border: '#1d324b',        // Low-opacity cool-grey border lines
  text: '#f8fafc',          // Clean slate-50 primary text
  muted: '#97a7bb',         // Inactive status text
  
  // Nokia High Contrast Metric status colors
  primary: '#005aff',       // Tech Blue
  success: '#10b981',       // High-visibility Emerald
  warning: '#eab308',       // Neon Warning Yellow
  danger: '#ef4444',        // Critical Alert Crimson
  info: '#06b6d4',          // Cyber Cyan
  
  // Data chart gradients
  chartGradients: {
    cyan: ['#06b6d4', '#0891b2', 'rgba(6, 182, 212, 0.05)'],
    emerald: ['#10b981', '#059669', 'rgba(16, 185, 129, 0.05)'],
    crimson: ['#ef4444', '#dc2626', 'rgba(239, 68, 68, 0.05)'],
  }
} as const;

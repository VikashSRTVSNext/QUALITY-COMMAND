export const colors = {
  bg: '#08111a',            // Ultra dark industrial blue-black
  panelBg: '#0e1424',       // Sleek translucent grey-blue for modules
  border: '#1d324b',        // Low-opacity cool-grey border lines
  text: '#f8fafc',          // Clean slate-50 primary text
  muted: '#97a7bb',         // Inactive status text
  
  // Nokia High Contrast Metric status colors
  primary: '#005aff',       // Tech Blue
  success: '#22c55e',       // High-visibility Emerald
  warning: '#eab308',       // Neon Warning Yellow
  danger: '#ff4c4c',        // Critical Alert Crimson
  info: '#06b6d4',          // Cyber Cyan
  
  // Data chart gradients
  chartGradients: {
    cyan: ['#06b6d4', '#0891b2', 'rgba(6, 182, 212, 0.05)'],
    emerald: ['#22c55e', '#059669', 'rgba(34, 197, 94, 0.05)'],
    crimson: ['#ff4c4c', '#dc2626', 'rgba(255, 76, 76, 0.05)'],
  }
} as const;

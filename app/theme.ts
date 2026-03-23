import { createTheme } from '@mui/material/styles'

export const dashboardTokens = {
  shell: '#111827',
  sidebar: '#18181b',
  surfaceSoft: 'rgba(255, 255, 255, 0.04)',
  surface: '#1f2937',
  surfaceAlt: '#26272b',
  border: 'rgba(255, 255, 255, 0.08)',
  borderInput: 'rgba(255, 255, 255, 0.10)',
  borderMuted: 'rgba(255, 255, 255, 0.16)',
  borderSoft: 'rgba(255, 255, 255, 0.18)',
  textMuted: 'rgba(255, 255, 255, 0.65)',
  textSoft: 'rgba(255, 255, 255, 0.72)',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f172a',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
  },
})

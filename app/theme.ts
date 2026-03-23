import { createTheme } from '@mui/material/styles';

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
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif'
    },
})
// =============================================
// Theme colors (from theme.md)
// =============================================

export const theme = {
    bg: '#161923',
    card: '#1c202e',
    fg: '#f1f1e4',
    muted: '#9ea4bd',
    border: '#292d3d',
    accent: '#f40552',
    destructive: '#e33131',
    warning: '#ffae00',
    success: '#01a370',
    info: '#2b9bc5',
} as const;

export default {
    name: 'fivem',
    logo: 'images/txadmin.png',
    palette: {
        mode: 'dark',
        primary: {
            main: theme.accent,
        },
        success: {
            main: theme.success,
        },
        warning: {
            main: theme.warning,
        },
        error: {
            main: theme.destructive,
        },
        info: {
            main: theme.info,
        },
        background: {
            default: theme.bg,
            paper: theme.card,
        },
        action: {
            selected: 'rgba(255, 255, 255, 0.1)',
        },
        secondary: {
            main: '#f40552',
        },
        text: {
            primary: theme.fg,
            secondary: theme.muted,
        },
    },
    components: {
        MuiListItem: {
            styleOverrides: {
                root: {
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'unset',
                },
            },
        },
    },
} as const;

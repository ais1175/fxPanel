export default {
    name: 'fivem',
    logo: 'images/txadmin.png',
    palette: {
        mode: 'dark',
        primary: {
            main: '#f1f1e4',
            light: '#fbfbf6',
            dark: '#d9d9c8',
            contrastText: '#161923',
        },
        success: {
            main: '#01a370',
            light: '#47c598',
            dark: '#007d56',
            contrastText: '#f1fffa',
        },
        warning: {
            main: '#ffae00',
            light: '#ffc547',
            dark: '#d98d00',
            contrastText: '#241900',
        },
        error: {
            main: '#e33131',
            light: '#ee6565',
            dark: '#b82222',
            contrastText: '#fff5f5',
        },
        info: {
            main: '#26afd9',
            light: '#62c7e7',
            dark: '#1c89ab',
            contrastText: '#effcff',
        },
        background: {
            default: '#161923',
            paper: '#1c202e',
        },
        action: {
            selected: 'rgba(244, 5, 82, 0.14)',
        },
        secondary: {
            main: '#f40552',
            light: '#ff4f89',
            dark: '#bd003d',
            contrastText: '#ffffff',
        },
        text: {
            primary: '#f1f1e4',
            secondary: '#9ea4bd',
        },
        divider: 'rgba(124, 134, 171, 0.22)',
    },
    components: {
        MuiListItem: {
            styleOverrides: {
                root: {
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(244, 5, 82, 0.12)',
                        border: '1px solid rgba(244, 5, 82, 0.26)',
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(244, 5, 82, 0.12)',
                        border: '1px solid rgba(244, 5, 82, 0.26)',
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

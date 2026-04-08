import React from 'react';
import { styled } from '@mui/material/styles';
import { Box, IconButton, Typography } from '@mui/material';
import { usePlayerDetailsValue } from '../../../state/playerDetails.state';
import { FileCopy } from '@mui/icons-material';
import { copyToClipboard } from '../../../utils/copyToClipboard';
import { useSnackbar } from 'notistack';
import { useTranslate } from 'react-polyglot';
import { DialogLoadError } from './DialogLoadError';

const PREFIX = 'DialogIdView';

const classes = {
    codeBlock: `${PREFIX}-codeBlock`,
    codeBlockText: `${PREFIX}-codeBlockText`,
    codeBlockHwids: `${PREFIX}-codeBlockHwids`,
};

const StyledBox = styled(Box)(({ theme }) => ({
    [`& .${classes.codeBlock}`]: {
        background: theme.palette.background.paper,
        borderRadius: 8,
        padding: '0px 15px',
        marginBottom: 7,
        display: 'flex',
        alignItems: 'center',
    },

    [`& .${classes.codeBlockText}`]: {
        flexGrow: 1,
        fontFamily: 'monospace',
    },

    [`& .${classes.codeBlockHwids}`]: {
        flexGrow: 1,
        fontFamily: 'monospace',
        padding: '15px 0px',
        fontSize: '0.95rem',
        opacity: '0.75',
    },
}));

const DialogIdView: React.FC = () => {
    const playerDetails = usePlayerDetailsValue();
    const { enqueueSnackbar } = useSnackbar();
    const t = useTranslate();
    if ('error' in playerDetails) return <DialogLoadError />;

    const currentIds = playerDetails.player.ids ?? [];
    const allIds = Array.from(new Set([...(playerDetails.player.oldIds ?? []), ...currentIds]));

    const handleCopyToClipboard = (value: string) => {
        copyToClipboard(value, true);
        enqueueSnackbar(t('nui_menu.common.copied'), { variant: 'info' });
    };

    const getAllIds = () => {
        if (!allIds.length) {
            return <em>No identifiers saved.</em>;
        } else {
            return allIds.map((ident) => {
                const isCurrent = currentIds.includes(ident);

                return (
                    <Box className={classes.codeBlock} key={ident} sx={{ opacity: isCurrent ? 1 : 0.65 }}>
                        <Typography className={classes.codeBlockText} sx={{ fontWeight: isCurrent ? 700 : 400 }}>
                            {ident}
                        </Typography>
                        <IconButton onClick={() => handleCopyToClipboard(ident)} size="large">
                            <FileCopy />
                        </IconButton>
                    </Box>
                );
            });
        }
    };

    const getAllHwids = () => {
        if (!Array.isArray(playerDetails.player.oldHwids) || !playerDetails.player.oldHwids.length) {
            return <em>No HWIDs saved.</em>;
        } else {
            return (
                <Box className={classes.codeBlock}>
                    <span className={classes.codeBlockHwids}>{playerDetails.player.oldHwids.join('\n')}</span>
                </Box>
            );
        }
    };

    return (
        <StyledBox overflow="auto" height="100%" padding="8px 24px">
            <Typography variant="h6" sx={{ mb: 1 }}>
                All Identifiers:
            </Typography>
            <Box sx={{ mb: 2 }}>{getAllIds()}</Box>

            <Typography variant="h6" sx={{ mb: 1 }}>
                {t('nui_menu.player_modal.ids.all_hwids')}:
            </Typography>
            <Box sx={{ mb: 2 }}>{getAllHwids()}</Box>
        </StyledBox>
    );
};

export default DialogIdView;

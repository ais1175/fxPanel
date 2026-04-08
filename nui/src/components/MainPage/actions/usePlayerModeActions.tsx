import React from 'react';
import { AccessibilityNew, AirlineStops, ControlCamera, Security } from '@mui/icons-material';
import { fetchNui } from '../../../utils/fetchNui';
import { useTranslate } from 'react-polyglot';
import { useSnackbar } from 'notistack';
import { PlayerMode, usePlayerMode } from '../../../state/playermode.state';

export function usePlayerModeActions() {
    const t = useTranslate();
    const { enqueueSnackbar } = useSnackbar();
    const [playerMode, setPlayerMode] = usePlayerMode();

    const handlePlayermodeToggle = (targetMode: PlayerMode) => {
        if (targetMode === playerMode || targetMode === PlayerMode.DEFAULT) {
            setPlayerMode(PlayerMode.DEFAULT);
            fetchNui('playerModeChanged', PlayerMode.DEFAULT);
            enqueueSnackbar(t('nui_menu.page_main.player_mode.normal.success'), {
                variant: 'success',
            });
        } else {
            setPlayerMode(targetMode);
            fetchNui('playerModeChanged', targetMode);
        }
    };

    return {
        playerMode,
        menuItem: {
            title: t('nui_menu.page_main.player_mode.title'),
            requiredPermission: 'players.playermode',
            isMultiAction: true,
            initialValue: playerMode,
            actions: [
                {
                    name: t('nui_menu.page_main.player_mode.noclip.title'),
                    label: t('nui_menu.page_main.player_mode.noclip.label'),
                    value: PlayerMode.NOCLIP,
                    icon: <ControlCamera />,
                    onSelect: () => {
                        handlePlayermodeToggle(PlayerMode.NOCLIP);
                    },
                },
                {
                    name: t('nui_menu.page_main.player_mode.godmode.title'),
                    label: t('nui_menu.page_main.player_mode.godmode.label'),
                    value: PlayerMode.GOD_MODE,
                    icon: <Security />,
                    onSelect: () => {
                        handlePlayermodeToggle(PlayerMode.GOD_MODE);
                    },
                },
                {
                    name: t('nui_menu.page_main.player_mode.superjump.title'),
                    label: t('nui_menu.page_main.player_mode.superjump.label'),
                    value: PlayerMode.SUPER_JUMP,
                    icon: <AirlineStops />,
                    onSelect: () => {
                        handlePlayermodeToggle(PlayerMode.SUPER_JUMP);
                    },
                },
                {
                    name: t('nui_menu.page_main.player_mode.normal.title'),
                    label: t('nui_menu.page_main.player_mode.normal.label'),
                    value: PlayerMode.DEFAULT,
                    icon: <AccessibilityNew />,
                    onSelect: () => {
                        handlePlayermodeToggle(PlayerMode.DEFAULT);
                    },
                },
            ],
        },
    };
}

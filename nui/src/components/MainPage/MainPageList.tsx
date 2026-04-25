import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, List, styled } from '@mui/material';
import { MenuListItem, MenuListItemMulti } from './MenuListItem';
import { ExpandMore } from '@mui/icons-material';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { fetchNui } from '../../utils/fetchNui';
import { useIsMenuVisibleValue } from '../../state/visibility.state';
import { usePlayerModeActions } from './actions/usePlayerModeActions';
import { useTeleportActions } from './actions/useTeleportActions';
import { useVehicleActions } from './actions/useVehicleActions';
import { useHealActions } from './actions/useHealActions';
import { useMiscActions } from './actions/useMiscActions';

const fadeHeight = 20;
const listHeight = 402;

const BoxFadeTop = styled(Box)(({ theme }) => ({
    backgroundImage: `linear-gradient(to top, transparent, ${theme.palette.background.default})`,
    position: 'relative',
    bottom: listHeight + fadeHeight - 4,
    height: fadeHeight,
}));

const BoxFadeBottom = styled(Box)(({ theme }) => ({
    backgroundImage: `linear-gradient(to bottom, transparent, ${theme.palette.background.default})`,
    position: 'relative',
    height: fadeHeight,
    bottom: fadeHeight * 2,
}));

const BoxIcon = styled(Box)(({ theme }) => ({
    color: theme.palette.text.secondary,
    marginTop: -(fadeHeight * 2),
    display: 'flex',
    justifyContent: 'center',
}));

const StyledList = styled(List)({
    maxHeight: listHeight,
    overflow: 'auto',
    '&::-webkit-scrollbar': {
        display: 'none',
    },
});

export const MainPageList: React.FC = () => {
    const [curSelected, setCurSelected] = useState(0);
    const menuVisible = useIsMenuVisibleValue();

    const { playerMode, menuItem: playerModeItem } = usePlayerModeActions();
    const { teleportMode, menuItem: teleportItem } = useTeleportActions();
    const { vehicleMode, serverCtx, isRedm, menuItem: vehicleItem } = useVehicleActions();
    const { healMode, menuItem: healItem } = useHealActions();
    const { menuItems: miscItems } = useMiscActions();

    useEffect(() => {
        if (!menuVisible) setCurSelected(0);
    }, [menuVisible]);

    const menuListItems = useMemo(
        () => [playerModeItem, teleportItem, vehicleItem, healItem, ...miscItems],
        [playerModeItem, teleportItem, vehicleItem, healItem, miscItems],
    );

    //=============================================
    const handleArrowDown = useCallback(() => {
        const next = curSelected + 1;
        fetchNui('playSound', 'move').catch();
        setCurSelected(next >= menuListItems.length ? 0 : next);
    }, [curSelected]);

    const handleArrowUp = useCallback(() => {
        const next = curSelected - 1;
        fetchNui('playSound', 'move').catch();
        setCurSelected(next < 0 ? menuListItems.length - 1 : next);
    }, [curSelected]);

    useKeyboardNavigation({
        onDownDown: handleArrowDown,
        onUpDown: handleArrowUp,
        disableOnFocused: true,
    });

    return (
        // add pb={2} if we don't have that arrow at the bottom
        <Box sx={{ pointerEvents: 'none' }}>
            <StyledList>
                {menuListItems.map((item, index) =>
                    'isMultiAction' in item && item.isMultiAction ? (
                        // @ts-ignore
                        <MenuListItemMulti key={index} selected={curSelected === index} {...item} />
                    ) : (
                        // @ts-ignore
                        <MenuListItem key={index} selected={curSelected === index} {...item} />
                    ),
                )}
            </StyledList>
            <BoxFadeTop style={{ opacity: curSelected <= 1 ? 0 : 1 }} />
            <BoxFadeBottom style={{ opacity: curSelected >= 6 ? 0 : 1 }} />
            <BoxIcon display="flex" justifyContent="center">
                <ExpandMore />
            </BoxIcon>
            {/* <Typography
        color="textSecondary"
        style={{
          fontWeight: 500,
          marginTop: -20,
          textAlign: "left",
          fontSize: 12,
        }}
      >
        v{serverCtx.fxPanelVersion}
      </Typography>  */}
        </Box>
    );
};

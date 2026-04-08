import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { fetchNui } from '../utils/fetchNui';
import { useIsMenuVisibleValue } from '../state/visibility.state';
import { txAdminMenuPage, usePageValue } from '../state/page.state';

const KeyboardNavContext = createContext(null);

interface KeyboardNavProviderProps {
    children: ReactNode;
}

export const KeyboardNavProvider: React.FC<KeyboardNavProviderProps> = ({ children }) => {
    const [disabledKeyNav, setDisabledKeyNav] = useState(false);
    const IsMenuVisible = useIsMenuVisibleValue();
    const curPage = usePageValue();

    const handleSetDisabledInputs = useCallback((bool: boolean) => {
        setDisabledKeyNav(bool);
    }, []);

    useEffect(() => {
        if (!IsMenuVisible) return;

        if (curPage === txAdminMenuPage.Players || curPage === txAdminMenuPage.PlayerModalOnly) {
            return setDisabledKeyNav(true);
        }

        if (curPage === txAdminMenuPage.Main) {
            return setDisabledKeyNav(false);
        }
    }, [curPage, IsMenuVisible]);

    useEffect(() => {
        if (!IsMenuVisible) return;
        fetchNui('focusInputs', disabledKeyNav, { mockResp: {} });
    }, [disabledKeyNav, IsMenuVisible]);

    return (
        <KeyboardNavContext.Provider
            value={{
                disabledKeyNav: disabledKeyNav,
                setDisabledKeyNav: handleSetDisabledInputs,
            }}
        >
            {children}
        </KeyboardNavContext.Provider>
    );
};

interface KeyboardNavProviderValue {
    disabledKeyNav: boolean;
    setDisabledKeyNav: (bool: boolean) => void;
}

export const useKeyboardNavContext = () => useContext<KeyboardNavProviderValue>(KeyboardNavContext);

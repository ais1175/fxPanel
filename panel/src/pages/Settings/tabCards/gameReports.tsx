import SwitchText from '@/components/SwitchText';
import { SettingItem, SettingItemDesc } from '../settingsItems';
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
    getConfigEmptyState,
    getConfigAccessors,
    SettingsCardProps,
    getPageConfig,
    configsReducer,
    getConfigDiff,
} from '../utils';
import SettingsCardShell from '../SettingsCardShell';

export const pageConfigs = {
    reportsEnabled: getPageConfig('gameFeatures', 'reportsEnabled', undefined, true),
} as const;

export default function ConfigCardGameReports({ cardCtx, pageCtx }: SettingsCardProps) {
    const [states, dispatch] = useReducer(configsReducer<typeof pageConfigs>, null, () =>
        getConfigEmptyState(pageConfigs),
    );
    const cfg = useMemo(() => {
        return getConfigAccessors(cardCtx.cardId, pageConfigs, pageCtx.apiData, dispatch);
    }, [pageCtx.apiData, dispatch]);

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = useCallback(() => {
        const overwrites = {};

        const res = getConfigDiff(cfg, states, overwrites, false);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    }, [cfg, states, pageCtx, cardCtx]);

    //Effects - handle changes
    useEffect(() => {
        updatePageState();
    }, [updatePageState]);

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;
        pageCtx.saveChanges(cardCtx, localConfigs);
    };

    return (
        <SettingsCardShell cardCtx={cardCtx} pageCtx={pageCtx} onClickSave={handleOnSave}>
            <SettingItem label="Player Reports">
                <SwitchText
                    id={cfg.reportsEnabled.eid}
                    checkedLabel="Enabled"
                    uncheckedLabel="Disabled"
                    variant="checkedGreen"
                    checked={states.reportsEnabled}
                    onCheckedChange={cfg.reportsEnabled.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>
                    When enabled, players can use the <strong>/report</strong> command to submit reports
                    (player reports, bug reports, questions) that admins can review in the Reports page.
                    <br />
                    <strong>Note:</strong> Disabling this will prevent new reports from being created but
                    existing reports will still be accessible.
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    );
}

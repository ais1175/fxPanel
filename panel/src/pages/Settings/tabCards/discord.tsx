import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TxAnchor from '@/components/TxAnchor';
import { PencilIcon } from 'lucide-react';
import SwitchText from '@/components/SwitchText';
import InlineCode from '@/components/InlineCode';
import { SettingItem, SettingItemDesc } from '../settingsItems';
import { useEffect, useRef, useMemo, useReducer } from 'react';
import {
    getConfigEmptyState,
    getConfigAccessors,
    SettingsCardProps,
    getPageConfig,
    configsReducer,
    getConfigDiff,
} from '../utils';
import SettingsCardShell from '../SettingsCardShell';
import { txToast } from '@/components/TxToaster';
import { useOpenEmbedEditor } from '../embedEditorState';

export const pageConfigs = {
    botEnabled: getPageConfig('discordBot', 'enabled', undefined, false),
    botToken: getPageConfig('discordBot', 'token'),
    discordGuild: getPageConfig('discordBot', 'guild'),
    warningsChannel: getPageConfig('discordBot', 'warningsChannel'),
} as const;

export default function ConfigCardDiscord({ cardCtx, pageCtx }: SettingsCardProps) {
    const [states, dispatch] = useReducer(configsReducer<typeof pageConfigs>, null, () =>
        getConfigEmptyState(pageConfigs),
    );
    const cfg = useMemo(() => {
        return getConfigAccessors(cardCtx.cardId, pageConfigs, pageCtx.apiData, dispatch);
    }, [pageCtx.apiData, dispatch]);

    //Effects - handle changes and reset advanced settings
    useEffect(() => {
        updatePageState();
    }, [states]);

    const openEmbedEditor = useOpenEmbedEditor();

    //Refs for configs that don't use state
    const botTokenRef = useRef<HTMLInputElement | null>(null);
    const discordGuildRef = useRef<HTMLInputElement | null>(null);
    const warningsChannelRef = useRef<HTMLInputElement | null>(null);

    //Marshalling Utils
    const emptyToNull = (str?: string) => {
        if (str === undefined) return undefined;
        const trimmed = str.trim();
        return trimmed.length ? trimmed : null;
    };

    //Processes the state of the page and sets the card as pending save if needed
    const updatePageState = () => {
        const overwrites = {
            botToken: emptyToNull(botTokenRef.current?.value),
            discordGuild: emptyToNull(discordGuildRef.current?.value),
            warningsChannel: emptyToNull(warningsChannelRef.current?.value),
        };

        const res = getConfigDiff(cfg, states, overwrites, false);
        pageCtx.setCardPendingSave(res.hasChanges ? cardCtx : null);
        return res;
    };

    //Validate changes (for UX only) and trigger the save API
    const handleOnSave = () => {
        const { hasChanges, localConfigs } = updatePageState();
        if (!hasChanges) return;

        if (localConfigs.discordBot?.enabled) {
            if (!localConfigs.discordBot?.token) {
                return txToast.error('You must provide a Discord Bot Token to enable the bot.');
            }
            if (!localConfigs.discordBot?.guild) {
                return txToast.error('You must provide a Server ID to enable the bot.');
            }
        }
        pageCtx.saveChanges(cardCtx, localConfigs);
    };

    return (
        <SettingsCardShell cardCtx={cardCtx} pageCtx={pageCtx} onClickSave={handleOnSave}>
            <SettingItem label="Discord Bot">
                <SwitchText
                    id={cfg.botEnabled.eid}
                    checkedLabel="Enabled"
                    uncheckedLabel="Disabled"
                    variant="checkedGreen"
                    checked={states.botEnabled}
                    onCheckedChange={cfg.botEnabled.state.set}
                    disabled={pageCtx.isReadOnly}
                />
                <SettingItemDesc>Enable Discord Integration.</SettingItemDesc>
            </SettingItem>
            <SettingItem label="Token" htmlFor={cfg.botToken.eid} required={states.botEnabled}>
                <Input
                    id={cfg.botToken.eid}
                    ref={botTokenRef}
                    defaultValue={cfg.botToken.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    maxLength={96}
                    autoComplete="off"
                    className="blur-input"
                    required
                />
                <SettingItemDesc>
                    To get a token and the bot to join your server, follow these two guides:
                    <TxAnchor href="https://discordjs.guide/legacy/preparations/app-setup">
                        Setting up a bot application
                    </TxAnchor>{' '}
                    and{' '}
                    <TxAnchor href="https://discordjs.guide/legacy/preparations/adding-your-app">
                        Adding your bot to servers
                    </TxAnchor>{' '}
                    <br />
                    <strong>Note:</strong> Do not reuse the same token for another bot. <br />
                    <strong>Note:</strong> The bot requires the <strong>Server Members</strong> intent, which can be set
                    at the
                    <TxAnchor href="https://discord.com/developers/applications">Discord Developer Portal</TxAnchor>.
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label="Guild/Server ID" htmlFor={cfg.discordGuild.eid} required={states.botEnabled}>
                <Input
                    id={cfg.discordGuild.eid}
                    ref={discordGuildRef}
                    defaultValue={cfg.discordGuild.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder="000000000000000000"
                />
                <SettingItemDesc>
                    The ID of the Discord Server (also known as Discord Guild). <br />
                    To get the Server ID, go to Discord's settings and
                    <TxAnchor href="https://support.discordapp.com/hc/article_attachments/115002742731/mceclip0.png">
                        {' '}
                        enable developer mode
                    </TxAnchor>
                    , then right-click on the guild icon select "Copy ID".
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label="Warnings Channel ID" htmlFor={cfg.warningsChannel.eid} showOptional>
                <Input
                    id={cfg.warningsChannel.eid}
                    ref={warningsChannelRef}
                    defaultValue={cfg.warningsChannel.initialValue}
                    onInput={updatePageState}
                    disabled={pageCtx.isReadOnly}
                    placeholder="000000000000000000"
                />
                <SettingItemDesc>
                    The ID of the channel to send Announcements (eg server restarts). <br />
                    You can leave it blank to disable this feature. <br />
                    To get the channel ID, go to Discord's settings and
                    <TxAnchor href="https://support.discordapp.com/hc/article_attachments/115002742731/mceclip0.png">
                        {' '}
                        enable developer mode
                    </TxAnchor>
                    , then right-click on the channel name and select "Copy ID".
                </SettingItemDesc>
            </SettingItem>
            <SettingItem label="Status Embed">
                <div className="flex flex-wrap gap-6">
                    <Button
                        size={'sm'}
                        variant="secondary"
                        disabled={pageCtx.isReadOnly}
                        onClick={() => {
                            const stored = pageCtx.apiData?.storedConfigs?.discordBot?.embedJson as string | undefined;
                            const def = pageCtx.apiData?.defaultConfigs?.discordBot?.embedJson as string | undefined;
                            openEmbedEditor({
                                field: 'embedJson',
                                fieldLabel: 'Status Embed JSON',
                                initialValue: stored ?? def ?? '{}',
                                defaultValue: def ?? '{}',
                            });
                        }}
                    >
                        <PencilIcon className="mr-1.5 inline-block size-4" /> Change Embed JSON
                    </Button>
                    <Button
                        size={'sm'}
                        variant="secondary"
                        disabled={pageCtx.isReadOnly}
                        onClick={() => {
                            const stored = pageCtx.apiData?.storedConfigs?.discordBot?.embedConfigJson as
                                | string
                                | undefined;
                            const def = pageCtx.apiData?.defaultConfigs?.discordBot?.embedConfigJson as
                                | string
                                | undefined;
                            openEmbedEditor({
                                field: 'embedConfigJson',
                                fieldLabel: 'Status Config JSON',
                                initialValue: stored ?? def ?? '{}',
                                defaultValue: def ?? '{}',
                            });
                        }}
                    >
                        <PencilIcon className="mr-1.5 inline-block size-4" /> Change Config JSON
                    </Button>
                </div>
                <SettingItemDesc>
                    The server status embed is customizable by editing the two JSONs above. <br />
                    <strong>Note:</strong> Use the command <InlineCode>/status add</InlineCode> on a channel that the
                    bot has the "Send Message" permission to setup the embed.
                </SettingItemDesc>
            </SettingItem>
        </SettingsCardShell>
    );
}

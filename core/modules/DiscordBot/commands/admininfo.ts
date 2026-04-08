const modulename = 'DiscordBot:cmd:admininfo';
import { APIEmbedField, CommandInteraction, EmbedBuilder, EmbedData } from 'discord.js';
import { embedder } from '../discordHelpers';
import { findPlayersByIdentifier } from '@lib/player/playerFinder';
import { msToShortishDuration } from '@lib/misc';
import { resolveSearchId, footer } from './info';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

/**
 * Handler for /admininfo
 */
export default async (interaction: CommandInteraction) => {
    const tsToLocaleDate = (ts: number) => {
        return new Date(ts * 1000).toLocaleDateString(txCore.translator.canonical, { dateStyle: 'long' });
    };

    //Check for admin permission
    const admin = txCore.adminStore.getAdminByProviderUID(interaction.user.id);
    if (!admin) {
        return await interaction.reply(embedder.danger('You must be a fxPanel admin to use this command.'));
    }

    //Detect search identifier
    const result = resolveSearchId(interaction);
    if ('error' in result) {
        return await interaction.reply(embedder.danger(result.error));
    }
    const { searchId } = result;

    //Searching for players
    const players = findPlayersByIdentifier(searchId);
    if (!players.length) {
        return await interaction.reply(
            embedder.warning(
                `Identifier (\`${searchId}\`) does not seem to be associated to any player in the fxPanel Database.`,
            ),
        );
    } else if (players.length > 10) {
        return await interaction.reply(
            embedder.warning(
                `The identifier (\`${searchId}\`) is associated with more than 10 players, please use the fxPanel Web Panel to search for it.`,
            ),
        );
    }

    //Format players
    const embeds = [];
    for (const player of players) {
        const dbData = player.getDbData();
        if (!dbData) continue;

        const bodyText: Record<string, string> = {
            'Play time': msToShortishDuration(dbData.playTime * 60 * 1000),
            'Join date': tsToLocaleDate(dbData.tsJoined),
            'Last connection': tsToLocaleDate(dbData.tsLastConnection),
            Whitelisted: dbData.tsWhitelisted ? tsToLocaleDate(dbData.tsWhitelisted) : 'not yet',
        };

        //Counting bans/warns
        const actionHistory = player.getHistory();
        const actionCount = { ban: 0, warn: 0, kick: 0 };
        for (const log of actionHistory) {
            if (log.type in actionCount) {
                actionCount[log.type]++;
            }
        }
        const banText = actionCount.ban === 1 ? '1 ban' : `${actionCount.ban} bans`;
        const warnText = actionCount.warn === 1 ? '1 warn' : `${actionCount.warn} warns`;
        const kickText = actionCount.kick === 1 ? '1 kick' : `${actionCount.kick} kicks`;
        bodyText['Log'] = `${banText}, ${warnText}, ${kickText}`;

        //Filling notes + identifiers
        const notesText = dbData.notes ? dbData.notes.text : 'nothing here';
        const idsText = dbData.ids.length ? dbData.ids.join('\n') : 'nothing here';
        const truncate = (str: string, maxLen = 1000) => (str.length > maxLen ? str.substring(0, maxLen) + '…' : str);
        const fields: APIEmbedField[] = [
            {
                name: '• Notes:',
                value: `\`\`\`${truncate(notesText)}\`\`\``,
            },
            {
                name: '• Identifiers:',
                value: `\`\`\`${truncate(idsText)}\`\`\``,
            },
        ];

        const description = Object.entries(bodyText)
            .map(([label, value]) => `**• ${label}:** \`${value}\``)
            .join('\n');
        const embedData: EmbedData = {
            title: player.displayName,
            fields,
            description,
            footer,
        };
        embeds.push(new EmbedBuilder(embedData).setColor('#4262e2'));
    }

    //Send embeds :)
    return await interaction.reply({ embeds });
};

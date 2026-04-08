const modulename = 'DiscordBot:cmd:info';
import { APIEmbedField, CommandInteraction, EmbedBuilder, EmbedData } from 'discord.js';
import { parsePlayerId } from '@lib/player/idUtils';
import { embedder } from '../discordHelpers';
import { findPlayersByIdentifier } from '@lib/player/playerFinder';
import { txEnv } from '@core/globalData';
import { msToShortishDuration } from '@lib/misc';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

//Consts
const footer = {
    iconURL: 'https://cdn.discordapp.com/emojis/1062339910654246964.webp?size=96&quality=lossless',
    text: `fxPanel ${txEnv.txaVersion}`,
};

/**
 * Resolves search identifier from interaction subcommand
 */
export const resolveSearchId = (interaction: CommandInteraction) => {
    //@ts-ignore: somehow vscode is resolving interaction as CommandInteraction
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'self') {
        const targetId = interaction.member?.user.id;
        if (!targetId) return { error: 'Could not resolve your Discord ID.' };
        return { searchId: `discord:${targetId}` };
    } else if (subcommand === 'member') {
        const member = interaction.options.getMember('member');
        if (!member || !('user' in member)) return { error: 'Failed to resolve member ID.' };
        return { searchId: `discord:${member.user.id}` };
    } else if (subcommand === 'id') {
        //@ts-ignore: somehow vscode is resolving interaction as CommandInteraction
        const input = interaction.options.getString('id', true).trim();
        if (!input.length) return { error: 'Invalid identifier.' };
        const { isIdValid, idType, idValue, idlowerCased } = parsePlayerId(input);
        if (!isIdValid || !idType || !idValue || !idlowerCased) {
            return { error: `The provided identifier (\`${input}\`) does not seem to be valid.` };
        }
        return { searchId: idlowerCased };
    }
    throw new Error(`Subcommand ${subcommand} not found.`);
};

export { footer };

/**
 * Handler for /info
 */
export default async (interaction: CommandInteraction) => {
    const tsToLocaleDate = (ts: number) => {
        return new Date(ts * 1000).toLocaleDateString(txCore.translator.canonical, { dateStyle: 'long' });
    };

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

        const description = Object.entries(bodyText)
            .map(([label, value]) => `**• ${label}:** \`${value}\``)
            .join('\n');
        const embedData: EmbedData = {
            title: player.displayName,
            description,
            footer,
        };
        embeds.push(new EmbedBuilder(embedData).setColor('#4262e2'));
    }

    //Send embeds :)
    return await interaction.reply({ embeds });
};

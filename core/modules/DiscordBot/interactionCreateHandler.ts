const modulename = 'DiscordBot:interactionHandler';
import { Interaction, InteractionType } from 'discord.js';
import infoCommandHandler from './commands/info';
import adminInfoCommandHandler from './commands/admininfo';
import statusCommandHandler from './commands/status';
import whitelistCommandHandler from './commands/whitelist';
import { embedder } from './discordHelpers';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

//All commands
const handlers = {
    status: statusCommandHandler,
    whitelist: whitelistCommandHandler,
    info: infoCommandHandler,
    admininfo: adminInfoCommandHandler,
};

const noHandlerResponse = async (interaction: Interaction) => {
    if (interaction.isRepliable()) {
        //@ts-expect-error commandName/customId only exist on specific interaction subtypes
        const identifier = interaction?.commandName ?? interaction?.customId ?? 'unknown';
        await interaction.reply({
            content: `No handler available for this interaction (${InteractionType[interaction.type]} > ${identifier})`,
            ephemeral: true,
        });
    }
};

export default async (interaction: Interaction) => {
    //DEBUG
    // const copy = Object.assign(structuredClone(interaction), { user: false, member: false });
    // console.dir(copy);
    // return;

    //Handler filter
    if (interaction.user.bot) return;

    //Process buttons
    if (interaction.isButton()) {
        // //Get interaction
        // const [iid, ...args] = interaction.customId.split(':');
        // const handler = txChungus.interactionsManager.cache.get(`button:${iid}`);
        // if (!handler) {
        //     console.error(`No handler available for button interaction ${interaction.customId}`);
        //     return;
        // }
        // txManager.txRuntime.botCommands.count(???);
        // //Executes interaction
        // try {
        //     return await handler.execute(interaction, args, txChungus);
        // } catch (error) {
        //     return await console.error(`Error executing ${interaction.customId}: ${error.message}`);
        // }
    }

    //Process Slash commands
    if (interaction.isChatInputCommand()) {
        //Get interaction
        const handler = handlers[interaction.commandName as keyof typeof handlers];
        if (!handler) {
            noHandlerResponse(interaction).catch((e) => {});
            return;
        }
        txManager.txRuntime.botCommands.count(interaction.commandName);

        //Executes interaction
        try {
            await handler(interaction);
            return;
        } catch (error) {
            const msg = `Error executing ${interaction.commandName}: ${emsg(error)}`;
            console.error(msg);
            await interaction.reply(embedder.danger(msg, true));
            return;
        }
    }

    //Unknown type
    noHandlerResponse(interaction).catch((e) => {});
};

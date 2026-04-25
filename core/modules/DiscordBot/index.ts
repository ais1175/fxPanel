const modulename = 'DiscordBot';
import Discord, { ActivityType, AttachmentBuilder, ChannelType, Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { Agent } from 'undici';
import slashCommands from './slash';
import interactionCreateHandler from './interactionCreateHandler';
import { generateStatusMessage } from './commands/status';
import consoleFactory from '@lib/console';
import { embedColors } from './discordHelpers';
import { DiscordBotStatus } from '@shared/enums';
import { UpdateConfigKeySet } from '@modules/ConfigStore/utils';
import { txHostConfig } from '@core/globalData';
import type { DatabaseTicketType } from '@shared/ticketApiTypes';
const console = consoleFactory(modulename);

//Types
type MessageTranslationType = {
    key: string;
    data?: object;
};
type AnnouncementType = {
    title?: string | MessageTranslationType;
    description: string | MessageTranslationType;
    type: keyof typeof embedColors;
};

type SpawnConfig = Pick<TxConfigs['discordBot'], 'enabled' | 'token' | 'guild' | 'warningsChannel'>;

/**
 * Module that handles the discord bot, provides methods to resolve members and send announcements, as well as
 * providing discord slash commands.
 */
export default class DiscordBot {
    //NOTE: only listening to embed changes, as the settings page boots the bot if enabled
    static readonly configKeysWatched = ['discordBot.embedJson', 'discordBot.embedConfigJson'];

    readonly #clientOptions: Discord.ClientOptions = {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
        allowedMentions: {
            parse: ['users'],
            repliedUser: true,
        },
        ...(txHostConfig.netInterface && txHostConfig.netInterface !== '0.0.0.0' ? {
            rest: {
                agent: new Agent({
                    localAddress: txHostConfig.netInterface,
                }),
            },
        } : {}),
    };
    readonly cooldowns = new Map();
    #client: Client | undefined;
    guild: Discord.Guild | undefined;
    guildName: string | undefined;
    announceChannel: Discord.TextBasedChannel | undefined;
    #lastGuildMembersCacheRefresh: number = 0; //ms
    #lastStatus = DiscordBotStatus.Disabled;
    #lastExplicitStatus = DiscordBotStatus.Disabled;

    constructor() {
        setImmediate(() => {
            if (txConfig.discordBot.enabled) {
                this.startBot()?.catch((e) => {});
            }
        });

        //Cron
        setInterval(() => {
            if (txConfig.discordBot.enabled) {
                this.updateBotStatus().catch((e) => {});
            }
        }, 60_000);
        //Not sure how often do we want to do this, or if we need to do this at all,
        //but previously this was indirectly refreshed every 5 seconds by the health monitor
        setInterval(() => {
            this.refreshWsStatus();
        }, 7500);
    }

    /**
     * Handle updates to the config by resetting the required metrics
     */
    public handleConfigUpdate(updatedConfigs: UpdateConfigKeySet) {
        return this.updateBotStatus();
    }

    /**
     * Destroy the Discord client on shutdown
     */
    public handleShutdown() {
        if (this.#client) {
            this.#client.destroy();
            this.#client = undefined;
        }
    }

    /**
     * Called by settings save to attempt to restart the bot with new settings
     */
    async attemptBotReset(botCfg: SpawnConfig | false) {
        this.#lastGuildMembersCacheRefresh = 0;
        if (this.#client) {
            console.warn('Stopping Discord Bot');
            this.#client.destroy();
            this.refreshWsStatus();
            setTimeout(() => {
                if (!botCfg || !botCfg.enabled) this.#client = undefined;
            }, 1000);
        }

        if (botCfg && botCfg.enabled) {
            return await this.startBot(botCfg);
        } else {
            return true;
        }
    }

    /**
     * Passthrough to discord.js isReady()
     */
    get isClientReady() {
        return this.#client ? this.#client.isReady() : false;
    }

    /**
     * Passthrough to discord.js websocket status
     */
    get status(): DiscordBotStatus {
        if (!txConfig.discordBot.enabled) {
            return DiscordBotStatus.Disabled;
        } else if (this.#client?.ws.status === Discord.Status.Ready) {
            return DiscordBotStatus.Ready;
        } else {
            return this.#lastExplicitStatus;
        }
    }

    /**
     * Updates the bot client status and pushes to the websocket
     */
    refreshWsStatus() {
        if (this.#lastStatus !== this.status) {
            this.#lastStatus = this.status;
            txCore.webServer.webSocket.pushRefresh('status');
        }
    }

    /**
     * Send an announcement to the configured channel
     */
    async sendAnnouncement(content: AnnouncementType) {
        if (!txConfig.discordBot.enabled) return;
        if (!txConfig.discordBot.warningsChannel || !this.#client?.isReady() || !this.announceChannel) {
            console.verbose.warn('not ready yet to send announcement');
            return false;
        }

        try {
            let title;
            if (content.title) {
                title =
                    typeof content.title === 'string'
                        ? content.title
                        : txCore.translator.t(content.title.key, content.title.data);
            }
            let description;
            if (content.description) {
                description =
                    typeof content.description === 'string'
                        ? content.description
                        : txCore.translator.t(content.description.key, content.description.data);
            }

            const embed = new EmbedBuilder({ title, description }).setColor(embedColors[content.type]);
            await this.announceChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Error sending Discord announcement: ${emsg(error)}`);
        }
    }

    /**
     * Update persistent status and activity
     */
    async updateBotStatus() {
        if (!this.#client?.isReady() || !this.#client.user) {
            console.verbose.warn('not ready yet to update status');
            return false;
        }

        //Updating bot activity
        try {
            const serverClients = txCore.fxPlayerlist.onlineCount;
            const serverMaxClients = txCore.cacheStore.get('fxsRuntime:maxClients') ?? '??';
            const serverName = txConfig.general.serverName;
            const message = `[${serverClients}/${serverMaxClients}] on ${serverName}`;
            this.#client.user.setActivity(message, { type: ActivityType.Watching });
        } catch (error) {
            console.verbose.warn(`Failed to set bot activity: ${emsg(error)}`);
        }

        //Updating server status embed
        try {
            const oldChannelId = txCore.cacheStore.get('discord:status:channelId');
            const oldMessageId = txCore.cacheStore.get('discord:status:messageId');

            if (typeof oldChannelId === 'string' && typeof oldMessageId === 'string') {
                const oldChannel = await this.#client.channels.fetch(oldChannelId);
                if (!oldChannel) throw new Error(`oldChannel could not be resolved`);
                if (oldChannel.type !== ChannelType.GuildText && oldChannel.type !== ChannelType.GuildAnnouncement) {
                    throw new Error(`oldChannel is not guild text or announcement channel`);
                }
                await oldChannel.messages.edit(oldMessageId, generateStatusMessage());
            }
        } catch (error) {
            console.verbose.warn(`Failed to update status embed: ${emsg(error)}`);
        }
    }

    /**
     * Starts the discord client
     */
    startBot(botCfg?: SpawnConfig) {
        const isConfigSaveAttempt = !!botCfg;
        botCfg ??= {
            enabled: txConfig.discordBot.enabled,
            token: txConfig.discordBot.token,
            guild: txConfig.discordBot.guild,
            warningsChannel: txConfig.discordBot.warningsChannel,
        };
        if (!botCfg.enabled) return;

        return new Promise<string | void>((resolve, reject) => {
            type ErrorOptData = {
                code?: string;
                clientId?: string;
                prohibitedPermsInUse?: string[];
            };
            const sendError = (msg: string, data: ErrorOptData = {}) => {
                console.error(msg);
                const e = new Error(msg);
                Object.assign(e, data);
                console.warn('Stopping Discord Bot');
                this.#client?.destroy();
                setImmediate(() => {
                    this.#lastExplicitStatus = DiscordBotStatus.Error;
                    this.refreshWsStatus();
                    this.#client = undefined;
                });
                return reject(e);
            };

            //Check for configs
            if (typeof botCfg.token !== 'string' || !botCfg.token.length) {
                return sendError('Discord bot enabled while token is not set.');
            }
            if (typeof botCfg.guild !== 'string' || !botCfg.guild.length) {
                return sendError('Discord bot enabled while guild id is not set.');
            }

            //State check
            if (this.#client && this.#client.ws.status !== 3 && this.#client.ws.status !== 5) {
                console.verbose.warn('Destroying client before restart.');
                this.#client.destroy();
            }

            //Setting up client object
            this.#lastExplicitStatus = DiscordBotStatus.Starting;
            this.refreshWsStatus();
            this.#client = new Client(this.#clientOptions);

            //Setup Ready listener
            this.#client.on('ready', async () => {
                if (!this.#client?.isReady() || !this.#client.user)
                    throw new Error(`ready event while not being ready`);

                //Fetching guild
                const guild = this.#client.guilds.cache.find((guild) => guild.id === botCfg.guild);
                if (!guild) {
                    return sendError(`Discord bot could not resolve guild/server ID ${botCfg.guild}.`, {
                        code: 'CustomNoGuild',
                        clientId: this.#client.user.id,
                    });
                }
                this.guild = guild;
                this.guildName = guild.name;

                //Checking for dangerous permissions
                // https://discord.com/developers/docs/topics/permissions#permissions-bitwise-permission-flags
                // These are the same perms that require 2fa enabled - although it doesn't apply here
                const prohibitedPerms = [
                    'Administrator', //'ADMINISTRATOR',
                    'BanMembers', //'BAN_MEMBERS'
                    'KickMembers', //'KICK_MEMBERS'
                    'ManageChannels', //'MANAGE_CHANNELS',
                    'ManageGuildExpressions', //'MANAGE_GUILD_EXPRESSIONS'
                    'ManageGuild', //'MANAGE_GUILD',
                    'ManageMessages', //'MANAGE_MESSAGES'
                    'ManageRoles', //'MANAGE_ROLES',
                    'ManageThreads', //'MANAGE_THREADS'
                    'ManageWebhooks', //'MANAGE_WEBHOOKS'
                    'ViewCreatorMonetizationAnalytics', //'VIEW_CREATOR_MONETIZATION_ANALYTICS'
                ];
                const botPerms = this.guild.members.me?.permissions.serialize();
                if (!botPerms) {
                    return sendError(`Discord bot could not detect its own permissions.`);
                }
                const prohibitedPermsInUse = Object.entries(botPerms)
                    .filter(([permName, permEnabled]) => prohibitedPerms.includes(permName) && permEnabled)
                    .map((x) => x[0]);
                if (prohibitedPermsInUse.length) {
                    const name = this.#client.user.username;
                    const perms = prohibitedPermsInUse.includes('Administrator')
                        ? 'Administrator'
                        : prohibitedPermsInUse.join(', ');
                    return sendError(
                        `This bot (${name}) has dangerous permissions (${perms}) and for your safety the bot has been disabled.`,
                        { code: 'DangerousPermission' },
                    );
                }

                //Fetching announcements channel
                if (botCfg.warningsChannel) {
                    const fetchedChannel = this.#client.channels.cache.find((x) => x.id === botCfg.warningsChannel);
                    if (!fetchedChannel) {
                        return sendError(`Channel ${botCfg.warningsChannel} not found.`);
                    } else if (
                        fetchedChannel.type !== ChannelType.GuildText &&
                        fetchedChannel.type !== ChannelType.GuildAnnouncement
                    ) {
                        return sendError(
                            `Channel ${botCfg.warningsChannel} - ${(fetchedChannel as any)?.name} is not a text or announcement channel.`,
                        );
                    } else {
                        this.announceChannel = fetchedChannel;
                    }
                }

                // if previously registered by tx before v6 or other bot
                this.guild.commands.set(slashCommands).catch(console.dir);
                this.#client.application?.commands.set([]).catch(console.dir);

                //The settings save will the updateBotStatus, so no need to call it here
                if (!isConfigSaveAttempt) {
                    this.updateBotStatus().catch((e) => {});
                }

                const successMsg = `Discord bot running as \`${this.#client.user.tag}\` on \`${guild.name}\`.`;
                console.ok(successMsg);
                this.refreshWsStatus();
                return resolve(successMsg);
            });

            //Setup remaining event listeners
            this.#client.on('error', (error) => {
                this.refreshWsStatus();
                console.error(`Error from Discord.js client: ${error.message}`);
                return reject(error);
            });
            this.#client.on('resume', () => {
                console.verbose.ok('Connection with Discord API server resumed');
                this.updateBotStatus().catch((e) => {});
                this.refreshWsStatus();
            });
            this.#client.on('interactionCreate', interactionCreateHandler);

            // Forward Discord thread replies back into the ticket system
            this.#client.on('messageCreate', (message) => {
                if (message.author.bot) return;
                if (!message.channel.isThread()) return;
                const content = message.content.trim();
                const attachmentUrls = message.attachments
                    .filter((a) => !!a.url)
                    .map((a) => a.url)
                    .slice(0, 3);
                if (!content.length && attachmentUrls.length === 0) return;
                try {
                    const ticket = txCore.database.tickets.findByDiscordThread(message.channel.id);
                    if (!ticket) return;
                    const authorName = message.member?.displayName ?? message.author.globalName ?? message.author.username;
                    const msgTs = Math.floor(message.createdTimestamp / 1000);
                    const imageUrls = attachmentUrls.length > 0 ? attachmentUrls : undefined;
                    const ticketMessage = {
                        author: authorName,
                        authorType: 'discord' as const,
                        content,
                        imageUrls,
                        ts: msgTs,
                    };
                    txCore.database.tickets.addMessage(ticket.id, ticketMessage);
                    txCore.fxRunner.sendEvent('ticketNewMessage', {
                        ticketId: ticket.id,
                        reporterLicense: ticket.reporter.license,
                        message: ticketMessage,
                    });
                } catch (error) {
                    console.error(`Failed to process ticket message for thread ${message.channel.id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
            // this.#client.on('debug', console.verbose.debug);

            //Start bot
            this.#client.login(botCfg.token).catch((error) => {
                //Handle disallowed intents error
                if (error.message === 'Used disallowed intents') {
                    return sendError(`This bot does not have a required privileged intent.`, {
                        code: 'DisallowedIntents',
                    });
                }

                //set status to error
                this.#lastExplicitStatus = DiscordBotStatus.Error;
                this.refreshWsStatus();

                //if no message, create one
                if (!('message' in error) || !error.message) {
                    error.message = 'no reason available - ' + JSON.stringify(error);
                }
                console.error(`Discord login failed with error: ${error.message}`);
                return reject(error);
            });
        });
    }

    /**
     * Creates (or finds) a Discord thread for a new ticket and stores the thread ID.
     * Supports both Forum channels (creates a forum post) and Text channels (creates a public thread).
     */
    async createTicketThread(channelId: string, threadName: string, ticket: DatabaseTicketType, screenshotBuffer?: Buffer): Promise<void> {
        if (!this.#client?.isReady()) throw new Error(`discord bot not ready yet`);

        const channel = await this.#client.channels.fetch(channelId);
        if (!channel) throw new Error(`ticket channel ${channelId} not found`);

        const priorityColorMap: Record<string, Discord.ColorResolvable> = {
            critical: embedColors.danger as Discord.ColorResolvable,
            high: embedColors.danger as Discord.ColorResolvable,
            medium: embedColors.warning as Discord.ColorResolvable,
        };
        const priorityColor: Discord.ColorResolvable = ticket.priority
            ? (priorityColorMap[ticket.priority] ?? (embedColors.info as Discord.ColorResolvable))
            : (embedColors.info as Discord.ColorResolvable);

        const embed = new EmbedBuilder()
            .setTitle(`[${ticket.id}] ${ticket.category}`)
            .setDescription(ticket.description.slice(0, 2048))
            .addFields(
                { name: 'Reporter', value: `${ticket.reporter.name} (#${ticket.reporter.netid})`, inline: true },
                { name: 'Status', value: ticket.status, inline: true },
                ...(ticket.priority ? [{ name: 'Priority', value: ticket.priority, inline: true }] : []),
                ...(ticket.targets.length > 0
                    ? [{ name: 'Targets', value: ticket.targets.map((t) => `${t.name} (#${t.netid})`).join(', '), inline: false }]
                    : []),
            )
            .setColor(priorityColor)
            .setTimestamp(ticket.tsCreated * 1000);

        let thread: Discord.ThreadChannel;

        if (channel.type === ChannelType.GuildForum) {
            // Forum channel — create a forum post (which is also a thread)
            thread = await channel.threads.create({
                name: threadName,
                message: { embeds: [embed] },
            });
        } else if (
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement
        ) {
            // Text channel — send a message then create a thread on it
            const msg = await (channel as Discord.TextChannel).send({ embeds: [embed] });
            thread = await msg.startThread({ name: threadName });
        } else {
            throw new Error(`channel type ${channel.type} is not supported for ticket threads`);
        }

        // Persist the thread ID on the ticket
        txCore.database.tickets.setDiscordThread(ticket.id, thread.id);

        // Upload screenshot as a file attachment if provided
        if (screenshotBuffer) {
            const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'screenshot.png' });
            await thread.send({ content: '📸 Screenshot attached', files: [attachment] });
        }
    }

    /**
     * Posts a message to the Discord thread linked to a ticket, if one exists.
     * Silently no-ops if the bot isn't ready or no thread is linked.
     */
    async postTicketThreadMessage(ticketId: string, authorName: string, content: string, imageUrls?: string[]): Promise<void> {
        if (!this.#client?.isReady()) return;

        const threadId = txCore.database.tickets.getDiscordThreadId(ticketId);
        if (!threadId) return;

        try {
            const thread = await this.#client.channels.fetch(threadId);
            if (!thread || !(thread instanceof Discord.ThreadChannel)) return;
            let text = `**${authorName}:** ${content.slice(0, 1900)}`;
            if (imageUrls && imageUrls.length > 0) {
                text += '\n' + imageUrls.slice(0, 3).join('\n');
            }
            await thread.send(text.trim());
        } catch (error) {
            console.verbose.warn(`Failed to post to Discord thread ${threadId}: ${emsg(error)}`);
        }
    }

    /**
     * Refreshes the bot guild member cache
     */
    async refreshMemberCache() {
        if (!txConfig.discordBot.enabled) throw new Error(`discord bot is disabled`);
        if (!this.#client?.isReady()) throw new Error(`discord bot not ready yet`);
        if (!this.guild) throw new Error(`guild not resolved`);

        //Check when the cache was last refreshed
        const currTs = Date.now();
        if (currTs - this.#lastGuildMembersCacheRefresh > 60_000) {
            try {
                await this.guild.members.fetch();
                this.#lastGuildMembersCacheRefresh = currTs;
                return true;
            } catch (error) {
                return false;
            }
        }
        return false;
    }

    /**
     * Return if an ID is a guild member, and their roles
     */
    async resolveMemberRoles(uid: string) {
        if (!txConfig.discordBot.enabled) throw new Error(`discord bot is disabled`);
        if (!this.#client?.isReady()) throw new Error(`discord bot not ready yet`);
        if (!this.guild) throw new Error(`guild not resolved`);

        //Try to get member from cache or refresh cache then try again
        let member = this.guild.members.cache.find((m) => m.id === uid);
        if (!member && (await this.refreshMemberCache())) {
            member = this.guild.members.cache.find((m) => m.id === uid);
        }

        //Return result
        if (member) {
            return {
                isMember: true,
                memberRoles: member.roles.cache.map((role) => role.id),
            };
        } else {
            return { isMember: false };
        }
    }

    /**
     * Resolves a user by its discord identifier.
     */
    async resolveMemberProfile(uid: string) {
        if (!this.#client?.isReady()) throw new Error(`discord bot not ready yet`);
        const avatarOptions: Discord.ImageURLOptions = { size: 64, forceStatic: true };

        //Check if in guild member
        if (this.guild) {
            //Try to get member from cache or refresh cache then try again
            let member = this.guild.members.cache.find((m) => m.id === uid);
            if (!member && (await this.refreshMemberCache())) {
                member = this.guild.members.cache.find((m) => m.id === uid);
            }

            if (member) {
                return {
                    tag: member.nickname ?? member.user.username,
                    avatar: member.displayAvatarURL(avatarOptions) ?? member.user.displayAvatarURL(avatarOptions),
                };
            }
        }

        //Checking if user resolvable
        //NOTE: this one might still spam the API
        // https://discord.js.org/#/docs/discord.js/14.11.0/class/UserManager?scrollTo=fetch
        const user = await this.#client.users.fetch(uid);
        if (user) {
            return {
                tag: user.username,
                avatar: user.displayAvatarURL(avatarOptions),
            };
        } else {
            throw new Error(`could not resolve discord user`);
        }
    }
}

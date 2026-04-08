import { txEnv } from '@core/globalData';

export const defaultEmbedJson = JSON.stringify({
    title: '{{serverName}}',
    url: '{{serverBrowserUrl}}',
    description: 'You can configure this embed in `fxPanel > Settings > Discord Bot`.',
    fields: [
        {
            name: '> STATUS',
            value: '```\n{{statusString}}\n```',
            inline: true,
        },
        {
            name: '> PLAYERS',
            value: '```\n{{serverClients}}/{{serverMaxClients}}\n```',
            inline: true,
        },
        {
            name: '> F8 CONNECT COMMAND',
            value: '```\nconnect 123.123.123.123\n```',
        },
        {
            name: '> NEXT RESTART',
            value: '```\n{{nextScheduledRestart}}\n```',
            inline: true,
        },
        {
            name: '> UPTIME',
            value: '```\n{{uptime}}\n```',
            inline: true,
        },
    ],
    image: {
        url: 'https://media.discordapp.net/attachments/1489272229157142538/1489655809754271814/Placeholderbanner.png',
    },
    thumbnail: {
        url: 'https://media.discordapp.net/attachments/1489272229157142538/1489655810555515061/Logo.png',
    },
    footer: {
        icon_url: 'https://media.discordapp.net/attachments/1489272229157142538/1489655810555515061/Logo.png',
        text: `fxPanel ${txEnv.txaVersion}`,
    },
});

export const defaultEmbedConfigJson = JSON.stringify({
    onlineString: '🟢 Online',
    onlineColor: '#0BA70B',
    partialString: '🟡 Partial',
    partialColor: '#FFF100',
    offlineString: '🔴 Offline',
    offlineColor: '#A70B28',
    buttons: [
        {
            emoji: '1062338355909640233',
            label: 'Connect',
            url: '{{serverJoinUrl}}',
        },
        {
            emoji: '1062339910654246964',
            label: 'fxPanel Discord',
            url: 'https://discord.gg/6FcqBYwxH5',
        },
    ].filter(Boolean),
});

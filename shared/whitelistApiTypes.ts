import { GenericApiErrorResp } from './genericApiTypes';

export type WhitelistEntry = {
    name: string;
    identifier: string;
    approvedBy: string;
    tsApproved: number;
};

export type WhitelistRequestEntry = {
    id: string;
    license: string;
    playerDisplayName: string;
    discordTag?: string;
    discordAvatar?: string;
    tsLastAttempt: number;
};

export type ApiWhitelistPlayersResp =
    | {
          cntTotal: number;
          cntFiltered: number;
          totalPages: number;
          currPage: number;
          players: WhitelistEntry[];
      }
    | GenericApiErrorResp;

export type ApiWhitelistRequestsResp =
    | {
          cntTotal: number;
          cntFiltered: number;
          newest: number;
          totalPages: number;
          currPage: number;
          requests: WhitelistRequestEntry[];
      }
    | GenericApiErrorResp;

export type ApiWhitelistApprovalsResp = WhitelistEntry[] | GenericApiErrorResp;

/**
 * Live spectate API types shared between core/panel/NUI
 */

export type SpectateFrameEventData = {
    sessionId: string;
    frame: string; // base64 data URL (image/webp or image/jpeg)
};

export type LiveSpectateStartResp =
    | {
          sessionId: string;
      }
    | {
          error: string;
      };

export type LiveSpectateStopResp =
    | {
          success: true;
      }
    | {
          error: string;
      };

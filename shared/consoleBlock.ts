export type ConsoleBlock = {
    seq: number;
    ts: number;
    data: string;
    isSpawn: boolean;
};

export type LiveConsoleInitialData = {
    blocks: ConsoleBlock[];
    oldestSeq: number;
    clearSeq: number;
};

import si from 'systeminformation';

export default async (pid) => {
    const data = await si.processes();
    const allProcs = data.list;

    //Find root and all descendants via BFS
    const targetPids = new Set([pid]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const proc of allProcs) {
            if (!targetPids.has(proc.pid) && targetPids.has(proc.parentPid)) {
                targetPids.add(proc.pid);
                changed = true;
            }
        }
    }

    //Build result map matching the old pidusage format
    const result = {};
    for (const proc of allProcs) {
        if (targetPids.has(proc.pid)) {
            result[proc.pid] = {
                cpu: proc.cpu,
                memory: proc.mem_rss,
                ppid: proc.parentPid,
                timestamp: Date.now(),
            };
        }
    }
    return result;
};

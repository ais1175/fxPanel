/**
 * Pure utility functions for addon management.
 * Extracted for testability.
 */

export interface DependencyNode {
    id: string;
    dependencies: string[];
}

/**
 * Topological sort of nodes by dependencies (dependencies come first).
 * Nodes with circular or unresolvable dependencies are placed at the end.
 */
export function topologicalSort<T extends DependencyNode>(nodes: T[]): T[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const sorted: T[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (node: T) => {
        const id = node.id;
        if (visited.has(id)) return;
        if (visiting.has(id)) return; // circular — skip, will be appended at end
        visiting.add(id);
        for (const depId of node.dependencies) {
            const dep = nodeMap.get(depId);
            if (dep) visit(dep);
        }
        visiting.delete(id);
        visited.add(id);
        sorted.push(node);
    };

    for (const node of nodes) visit(node);

    // Append any unvisited (circular deps) at the end
    for (const node of nodes) {
        if (!visited.has(node.id)) sorted.push(node);
    }

    return sorted;
}

/**
 * Returns dependency IDs that are not in the running set.
 */
export function getMissingDependencies(dependencies: string[], runningIds: Set<string>): string[] {
    return dependencies.filter(depId => !runningIds.has(depId));
}

import { legendKey, type SwitchLegend } from './dependency-graph.js';

export const relationKey = (from: string, to: string) => JSON.stringify([from, to]);

export function switchVisibility(switches: readonly SwitchLegend[], expanded: readonly string[],
  temporary?: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> }) {
  const hiddenNodes = new Set<string>(), openNodes = new Set<string>();
  const hiddenEdges = new Set<string>(), openEdges = new Set<string>();
  for (const legend of switches) {
    const open = expanded.includes(legendKey(legend.id));
    for (const id of legend.nodes) (open ? openNodes : hiddenNodes).add(id);
    for (const { from, to } of legend.edges) (open ? openEdges : hiddenEdges).add(relationKey(from, to));
  }
  for (const id of openNodes) hiddenNodes.delete(id);
  for (const id of openEdges) hiddenEdges.delete(id);
  for (const id of temporary?.nodes ?? []) hiddenNodes.delete(id);
  for (const id of temporary?.edges ?? []) hiddenEdges.delete(id);
  return {
    node: (id: string) => !hiddenNodes.has(id),
    edge: (from: string, to: string) => !hiddenNodes.has(from) && !hiddenNodes.has(to) && !hiddenEdges.has(relationKey(from, to)),
  };
}

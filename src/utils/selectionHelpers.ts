export interface SelectionInput {
  nodeIds: string[];
  edgeIds: string[];
  textBoxIds: string[];
}

export interface MinimalNode {
  id: string;
  type?: string;
}

export function collectSelectionInput(
  selectedNodes: MinimalNode[],
  selectedEdgeIds: string[]
): SelectionInput {
  const nodeIds: string[] = [];
  const textBoxIds: string[] = [];
  
  for (const node of selectedNodes) {
    if (node.type === 'textBox') {
      textBoxIds.push(node.id);
    } else if (node.type === 'customNode') {
      nodeIds.push(node.id);
    }
  }
  
  return {
    nodeIds,
    edgeIds: selectedEdgeIds,
    textBoxIds,
  };
}

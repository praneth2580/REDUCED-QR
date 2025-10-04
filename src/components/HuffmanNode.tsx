import React from 'react';
import { Node } from '../encoders/huffman.encoders';

interface HuffmanNodeProps {
  node: Node;
}

const HuffmanNode: React.FC<HuffmanNodeProps> = ({ node }) => {
  const isLeaf = !node.left && !node.right;

  return (
    <li>
      <div className={`inline-block px-2 py-0.5 rounded shadow-sm text-gray-800 ${isLeaf ? 'bg-green-200' : 'bg-blue-200'}`}>
        <span className="font-bold text-sm">{node.char ? (node.char === ' ' ? "' '" : node.char) : 'Σ'}</span>
        <span className="text-xs text-gray-600 ml-1">({node.freq})</span>
      </div>

      {!isLeaf && (
        <ul>
          {node.left && <HuffmanNode node={node.left} />}
          {node.right && <HuffmanNode node={node.right} />}
        </ul>
      )}
    </li>
  );
};

export default HuffmanNode;

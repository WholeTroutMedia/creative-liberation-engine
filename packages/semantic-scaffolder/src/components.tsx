import React from "react";
import { ScaffolderNode } from "./scaffolder.js";

export interface ScaffoldRendererProps {
  nodes: ScaffolderNode[];
}

export const ScaffoldRenderer: React.FC<ScaffoldRendererProps> = ({ nodes }) => {
  return (
    <div className="scaffold-container space-y-4 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white">
      {nodes.map(node => {
        switch (node.type) {
          case "header":
            const Level = `h${node.metadata?.level || 2}` as keyof JSX.IntrinsicElements;
            return (
              <Level key={node.id} className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-indigo-200">
                {node.content}
              </Level>
            );
          case "code_block":
            return (
              <pre key={node.id} className="p-4 bg-black/40 rounded-xl border border-white/10 font-mono text-sm overflow-x-auto text-teal-300">
                <code className={`language-${node.metadata?.language || "text"}`}>
                  {node.content}
                </code>
              </pre>
            );
          case "data_table":
            return (
              <div key={node.id} className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                <table className="min-w-full divide-y divide-white/10">
                  <tbody className="divide-y divide-white/5 font-mono text-xs">
                    {node.content.split("\n").map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        {row.split("|").filter(cell => cell.trim()).map((cell, cidx) => (
                          <td key={cidx} className="px-4 py-2 whitespace-nowrap">
                            {cell.trim()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "alert":
            return (
              <div key={node.id} className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-200 text-sm">
                {node.content}
              </div>
            );
          case "paragraph":
          default:
            return (
              <p key={node.id} className="text-sm leading-relaxed text-slate-300">
                {node.content}
              </p>
            );
        }
      })}
    </div>
  );
};

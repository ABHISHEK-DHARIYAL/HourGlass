import React from 'react';

interface MarkdownRendererProps {
  text: string;
}

export default function MarkdownRenderer({ text }: MarkdownRendererProps) {
  if (!text) return null;

  // Split by double newline to get paragraph/block-level structures
  const blocks = text.split(/\n\n+/);

  const renderTextWithInlineFormatting = (inlineText: string) => {
    let parts: React.ReactNode[] = [inlineText];

    // 1. Parse Links: [Text](url)
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return part;
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      while ((match = linkRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          result.push(part.substring(lastIndex, match.index));
        }
        result.push(
          <a
            key={`link-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ledger-coral hover:underline font-semibold break-all"
            onClick={(e) => e.stopPropagation()} // Prevent opening edit modal
          >
            {match[1]}
          </a>
        );
        lastIndex = linkRegex.lastIndex;
      }
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      return result;
    });

    // 2. Parse Bold: **text** or __text__
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return part;
      const boldRegex = /(\*\*|__)(.*?)\1/g;
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      while ((match = boldRegex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          result.push(part.substring(lastIndex, match.index));
        }
        result.push(
          <strong key={`bold-${match.index}`} className="font-bold text-ledger-paper">
            {match[2]}
          </strong>
        );
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < part.length) {
        result.push(part.substring(lastIndex));
      }
      return result;
    });

    return parts;
  };

  return (
    <div className="space-y-1.5 text-inherit font-sans text-xs">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Check if block contains list lines
        const lines = trimmed.split('\n');
        const isList = lines.every(line => {
          const t = line.trim();
          return t.startsWith('- ') || t.startsWith('* ') || t.startsWith('• ') || /^\d+\.\s/.test(t);
        });

        if (isList) {
          return (
            <ul key={`block-${index}`} className="list-disc pl-4 space-y-1 my-1">
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^[-*•]\s+|\s*\d+\.\s+/, '');
                return (
                  <li key={`line-${lIdx}`} className="text-inherit leading-relaxed">
                    {renderTextWithInlineFormatting(cleanLine)}
                  </li>
                );
              })}
            </ul>
          );
        }

        // Standard paragraph block
        return (
          <p key={`block-${index}`} className="leading-relaxed">
            {renderTextWithInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

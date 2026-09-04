"use client";

import { Fragment, type ReactNode } from "react";

// Minimal markdown renderer — supports exactly what our extraction prompts
// allow: **bold**, *italic*, `code`, and [text](https://…) links, plus
// paragraph breaks. Everything else renders as literal text. No
// dangerouslySetInnerHTML anywhere, links restricted to http(s), so stored
// excerpts can't inject markup or javascript: URLs.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let n = 0;
  const key = () => `${keyPrefix}-${n++}`;

  // Code spans first so their contents are never reinterpreted.
  for (const codePart of text.split(/(`[^`\n]+`)/g)) {
    if (
      codePart.startsWith("`") &&
      codePart.endsWith("`") &&
      codePart.length > 2
    ) {
      nodes.push(
        <code
          key={key()}
          className="rounded bg-secondary px-1 font-mono text-[12px] text-foreground"
        >
          {codePart.slice(1, -1)}
        </code>,
      );
      continue;
    }
    // Links second.
    for (const linkPart of codePart.split(
      /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g,
    )) {
      const m = linkPart.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (m) {
        nodes.push(
          <a
            key={key()}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {m[1]}
          </a>,
        );
        continue;
      }
      // Bold, then italic on the remainder.
      for (const boldPart of linkPart.split(/(\*\*[^*\n]+\*\*)/g)) {
        if (boldPart.startsWith("**") && boldPart.endsWith("**")) {
          nodes.push(<strong key={key()}>{boldPart.slice(2, -2)}</strong>);
          continue;
        }
        for (const emPart of boldPart.split(/(\*[^*\n]+\*)/g)) {
          if (
            emPart.startsWith("*") &&
            emPart.endsWith("*") &&
            emPart.length > 2
          ) {
            nodes.push(<em key={key()}>{emPart.slice(1, -1)}</em>);
          } else if (emPart) {
            nodes.push(<Fragment key={key()}>{emPart}</Fragment>);
          }
        }
      }
    }
  }
  return nodes;
}

export function MiniMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => (
        <span key={i} className="block">
          {para.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              {renderInline(line, `p${i}l${j}`)}
              {j < arr.length - 1 && <br />}
            </Fragment>
          ))}
        </span>
      ))}
    </>
  );
}

"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  // Simple markdown parser for basic elements
  const parseMarkdown = (text: string) => {
    // Split content into lines for processing
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let inQuote = false;
    let quoteContent: string[] = [];

    const processLine = (line: string, index: number) => {
      // Handle code blocks
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <pre
              key={`code-${index}`}
              className="bg-muted p-4 rounded-lg overflow-x-auto my-4"
            >
              <code className="text-sm">{codeBlockContent.join("\n")}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start code block
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Handle block quotes
      if (line.startsWith("> ")) {
        if (!inQuote) {
          inQuote = true;
          quoteContent = [];
        }
        quoteContent.push(line.substring(2));
        return;
      } else if (inQuote) {
        // End quote block
        elements.push(
          <blockquote
            key={`quote-${index}`}
            className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground"
          >
            {quoteContent.map((quoteLine, i) => (
              <p key={i}>{processInlineMarkdown(quoteLine)}</p>
            ))}
          </blockquote>
        );
        quoteContent = [];
        inQuote = false;
      }

      // Flush any pending list
      if (
        currentList.length > 0 &&
        !line.trim().startsWith("-") &&
        !line.trim().startsWith("*") &&
        !line.trim().match(/^\d+\./)
      ) {
        elements.push(
          <ul key={`list-${index}`} className="list-disc pl-6 my-4 space-y-2">
            {currentList}
          </ul>
        );
        currentList = [];
      }

      // Handle headings
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={index} className="text-4xl font-bold mt-8 mb-4 first:mt-0">
            {processInlineMarkdown(line.substring(2))}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        elements.push(
          <h2
            key={index}
            className="text-3xl font-semibold mt-8 mb-4 first:mt-0"
          >
            {processInlineMarkdown(line.substring(3))}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        elements.push(
          <h3
            key={index}
            className="text-2xl font-semibold mt-6 mb-3 first:mt-0"
          >
            {processInlineMarkdown(line.substring(4))}
          </h3>
        );
      } else if (line.startsWith("#### ")) {
        elements.push(
          <h4
            key={index}
            className="text-xl font-semibold mt-6 mb-3 first:mt-0"
          >
            {processInlineMarkdown(line.substring(5))}
          </h4>
        );
      } else if (line.startsWith("##### ")) {
        elements.push(
          <h5
            key={index}
            className="text-lg font-semibold mt-4 mb-2 first:mt-0"
          >
            {processInlineMarkdown(line.substring(6))}
          </h5>
        );
      } else if (line.startsWith("###### ")) {
        elements.push(
          <h6
            key={index}
            className="text-base font-semibold mt-4 mb-2 first:mt-0"
          >
            {processInlineMarkdown(line.substring(7))}
          </h6>
        );
      }
      // Handle horizontal rule
      else if (line.trim() === "---") {
        elements.push(<hr key={index} className="my-8 border-border" />);
      }
      // Handle list items
      else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        currentList.push(
          <li
            key={`${index}-${currentList.length}`}
            className="text-foreground"
          >
            {processInlineMarkdown(line.trim().substring(2))}
          </li>
        );
      }
      // Handle numbered lists
      else if (line.trim().match(/^\d+\. /)) {
        const match = line.trim().match(/^\d+\. (.*)/);
        if (match) {
          currentList.push(
            <li
              key={`${index}-${currentList.length}`}
              className="text-foreground"
            >
              {processInlineMarkdown(match[1])}
            </li>
          );
        }
      }
      // Handle regular paragraphs
      else if (line.trim()) {
        elements.push(
          <p key={index} className="mb-4 leading-relaxed text-foreground">
            {processInlineMarkdown(line)}
          </p>
        );
      }
      // Handle empty lines (add spacing)
      else {
        elements.push(<div key={index} className="h-2" />);
      }
    };

    lines.forEach(processLine);

    // Flush any remaining list
    if (currentList.length > 0) {
      elements.push(
        <ul key="final-list" className="list-disc pl-6 my-4 space-y-2">
          {currentList}
        </ul>
      );
    }

    // Flush any remaining quote
    if (inQuote && quoteContent.length > 0) {
      elements.push(
        <blockquote
          key="final-quote"
          className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground"
        >
          {quoteContent.map((quoteLine, i) => (
            <p key={i}>{processInlineMarkdown(quoteLine)}</p>
          ))}
        </blockquote>
      );
    }

    return elements;
  };

  const processInlineMarkdown = (text: string): React.ReactNode => {
    // Handle inline code
    text = text.replace(
      /`([^`]+)`/g,
      '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>'
    );

    // Handle bold text
    text = text.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-bold">$1</strong>'
    );

    // Handle italic text
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');

    // Handle links
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Return as JSX
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const elements = parseMarkdown(content);

  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <div className="space-y-0">{elements}</div>
    </div>
  );
}

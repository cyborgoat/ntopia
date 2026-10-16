import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { serverUrlFor } from "@/lib/orbit";

// remark-rehype already prefixes footnote ids with "user-content-"; don't let sanitize double it.
const schema = { ...defaultSchema, clobberPrefix: "" };

/**
 * GitHub Flavored Markdown (https://github.github.com/gfm/): CommonMark plus tables, task lists,
 * strikethrough, extended autolinks, footnotes and raw HTML, plus `$math$` / `$$math$$` via KaTeX. HTML is passed through
 * rehype-sanitize's default (GitHub) schema, which also covers the spec's disallowed-tag filter.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-ntopia max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        // KaTeX runs after sanitizing so its generated markup is kept.
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex]}
        urlTransform={serverUrlFor}
        components={{
          a: ({ node: _node, ...props }) => <a target="_blank" rel="noreferrer noopener" {...props} />,
          table: ({ node: _node, ...props }) => (
            <div className="overflow-x-auto"><table {...props} /></div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

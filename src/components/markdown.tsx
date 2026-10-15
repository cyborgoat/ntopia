import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "@/lib/orbit";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-ntopia max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => (u.startsWith("/uploads") ? (assetUrl(u) ?? u) : u)}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

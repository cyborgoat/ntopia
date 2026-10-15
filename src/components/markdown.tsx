import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "@/lib/orbit";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-sm max-w-none space-y-3 text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_img]:max-w-full [&_img]:rounded-md [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(u) => (u.startsWith("/uploads") ? (assetUrl(u) ?? u) : u)}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

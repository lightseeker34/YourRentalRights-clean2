import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HtmlContentProps {
  content: string;
  className?: string;
}

const baseClassName = "prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 text-slate-700 ml-[10px] mr-[10px] pt-[10px] pb-[10px]";

function containsHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

export function HtmlContent({ content, className = "" }: HtmlContentProps) {
  if (!content) return null;

  // Legacy forum content may already be HTML from the rich text editor.
  if (containsHtml(content)) {
    const sanitizedHtml = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });

    return (
      <div
        className={`${baseClassName} ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  // New seeded/pinned content is markdown; render it cleanly.
  return (
    <div className={`${baseClassName} ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function stripHtml(content: string): string {
  return content.replace(/<[^>]*>/g, '').trim();
}

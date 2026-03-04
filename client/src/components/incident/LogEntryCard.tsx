import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import { AlertTriangle, Info, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { IncidentLog, getLogSeverity } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type ChatInputHandle } from "@/components/chat-input";
import { compactMarkdownComponents } from "@/lib/markdown/incidentMarkdown";

interface LogEntryCardProps {
  log: IncidentLog;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  highlightedLogId: number | null;
  onSetHighlightedLogId: (id: number | null) => void;
  openPreview: (log: IncidentLog) => void;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
  onEdit: (log: IncidentLog) => void;
  onDelete: (logId: number) => void;
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'call': return 'Call';
    case 'text': return 'Text';
    case 'email': return 'Email';
    case 'photo': return 'Photo';
    case 'chat': return 'Chat';
    case 'note': return 'Note';
    default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
};

const formatDateTime = (date: Date | string) =>
  format(new Date(date), "MMM d, yyyy  h:mm a");

export function LogEntryCard({
  log,
  icon: Icon,
  color,
  highlightedLogId,
  onSetHighlightedLogId,
  openPreview,
  chatInputRef,
  onEdit,
  onDelete,
}: LogEntryCardProps) {
  const isUserChat = log.type === 'chat' && !log.isAi;

  return (
    <Card
      id={`log-entry-${log.id}`}
      key={log.id}
      className={`p-2 rounded-lg group transition-colors cursor-pointer shadow-sm ${
        isUserChat
          ? 'bg-[var(--color-user-bubble)] border-[var(--color-user-bubble-border)] hover:bg-[var(--color-user-bubble)]/90'
          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      } ${highlightedLogId === log.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
      onClick={() => {
        if (log.type === 'chat') {
          const element = document.getElementById(`chat-entry-${log.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'end' });
            onSetHighlightedLogId(log.id);
            setTimeout(() => onSetHighlightedLogId(null), 3000);
          }
        } else if (log.fileUrl) {
          openPreview(log);
        }
      }}
    >
      {/* Header row: icon + label */}
      <div className="flex items-center justify-between gap-1.5 mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`w-3 h-3 ${color} shrink-0`} />
          <span className="font-medium text-slate-800 text-xs line-clamp-1">
            {getTypeLabel(log.type)}{log.title ? `: ${log.title}` : ''}
          </span>
        </div>
      </div>
      {/* Description */}
      <div className="text-slate-600 text-xs line-clamp-2 font-normal prose prose-slate max-w-none prose-p:my-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={compactMarkdownComponents}>
          {log.content}
        </ReactMarkdown>
      </div>
      {/* Footer: date, severity badge, and actions */}
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
          {(() => {
            const sev = getLogSeverity(log);
            if (sev === 'critical') return (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200" data-testid={`badge-severity-${log.id}`}>
                <AlertTriangle className="w-2.5 h-2.5" />Critical
              </span>
            );
            if (sev === 'important') return (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200" data-testid={`badge-severity-${log.id}`}>
                <Info className="w-2.5 h-2.5" />Important
              </span>
            );
            return null;
          })()}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {(log.type === 'call' || log.type === 'text' || log.type === 'email' || log.type === 'service') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
              onClick={() => {
                const typeLabel = log.type === 'call' ? 'Call log' : log.type === 'text' ? 'Text log' : log.type === 'email' ? 'Email log' : 'Service request log';
                chatInputRef.current?.setInput(`Add this to our discussion: [${typeLabel}] ${log.content}`);
                setTimeout(() => { chatInputRef.current?.focus(); }, 100);
              }}
              title="Add to AI Chat"
            >
              <MessageSquare className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-700"
            onClick={() => onEdit(log)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-700">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove this entry from your case.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(log.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}

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
import { buildAiConversationDraftFromLog, canAddLogToAiConversation } from "@/lib/incident";
import { compactMarkdownComponents } from "@/lib/markdown/incidentMarkdown";

interface LogEntryCardProps {
  log: IncidentLog;
  logs: IncidentLog[];
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  highlightedLogId: number | null;
  onSetHighlightedLogId: (id: number | null) => void;
  openPreview: (log: IncidentLog) => void;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
  onEdit: (log: IncidentLog) => void;
  onDelete: (logId: number) => void;
  onAddToAiChat?: () => void;
}

const getTypeLabel = (log: IncidentLog) => {
  switch (log.type) {
    case 'call': return 'Call';
    case 'text': return 'Text';
    case 'email': return 'Email';
    case 'photo': return 'Photo';
    case 'chat': return log.isAi ? 'Assistant' : 'You';
    case 'note': return 'Note';
    default: return log.type.charAt(0).toUpperCase() + log.type.slice(1);
  }
};

const formatDateTime = (date: Date | string) =>
  format(new Date(date), "MMM d, yyyy  h:mm a");

export function LogEntryCard({
  log,
  logs,
  icon: Icon,
  color,
  highlightedLogId,
  onSetHighlightedLogId,
  openPreview,
  chatInputRef,
  onEdit,
  onDelete,
  onAddToAiChat,
}: LogEntryCardProps) {
  const canAddToAiConversation = canAddLogToAiConversation(log);
  const aiConversationDraft = canAddToAiConversation
    ? buildAiConversationDraftFromLog(log, logs)
    : null;

  const cardToneClass = log.type === 'chat'
    ? (
      log.isAi
        ? 'bg-slate-100 border-slate-300 hover:bg-slate-200'
        : 'bg-[var(--color-user-bubble)] border-[var(--color-user-bubble-border)] hover:bg-[var(--color-user-bubble)]/90'
    )
    : 'bg-slate-50 border-slate-200 hover:bg-slate-100';

  return (
    <Card
      id={`log-entry-${log.id}`}
      key={log.id}
      className={`p-3 rounded-lg min-h-[96px] group transition-colors cursor-pointer shadow-sm flex flex-col ${cardToneClass} ${highlightedLogId === log.id ? 'ring-2 ring-blue-500' : ''}`}
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
            {getTypeLabel(log)}{log.title ? `: ${log.title}` : ''}
          </span>
        </div>
      </div>
      {/* Description */}
      <div className="text-slate-600 text-xs line-clamp-2 font-normal prose prose-slate max-w-none prose-p:my-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={compactMarkdownComponents}>
          {log.content}
        </ReactMarkdown>
      </div>
      {/* Footer: severity above, timestamp and actions on one line */}
      <div className="mt-auto pt-0.5">
        <div className="flex items-end justify-end w-full">
          <div className="ml-auto flex items-end justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            {formatDateTime(log.createdAt)}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {canAddToAiConversation && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-700"
                onClick={() => {
                  if (!aiConversationDraft) return;
                  chatInputRef.current?.setInput(aiConversationDraft.message);
                  chatInputRef.current?.setAttachments(aiConversationDraft.attachments);
                  onAddToAiChat?.();
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
              className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-700"
              onClick={() => onEdit(log)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-700">
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
      </div>
    </Card>
  );
}

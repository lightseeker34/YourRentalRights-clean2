import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { format } from "date-fns";
import {
  Bot, Phone, MessageSquare, Mail, FileText, Image as ImageIcon,
  Trash2, Calendar, Clock, Pencil, Paperclip, ChevronDown, ChevronRight,
  Download, Wrench, SlidersHorizontal, Globe, X,
} from "lucide-react";
import { Incident, IncidentLog } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ThumbnailWithDelete } from "./ThumbnailWithDelete";
import { LogEntryCard } from "./LogEntryCard";
import { AnalysisUnlockChecklist } from "./AnalysisUnlockChecklist";
import { type ChatInputHandle } from "@/components/chat-input";
import { isAnalysisPdf } from "@/lib/incident";
import { compactMarkdownComponents } from "@/lib/markdown/incidentMarkdown";
import { type TimelineItem } from "@/lib/incident/buildTimelineItems";
import { type FileGroup } from "@/lib/incident/buildFileGroups";

const formatDateTime = (date: Date | string) =>
  format(new Date(date), "MMM d, yyyy  h:mm a");

export interface SidebarContentProps {
  incident: Incident;
  logs: IncidentLog[] | undefined;
  timelineItems: TimelineItem[];
  fileGroups: FileGroup[];
  expandedChatGroups: Set<string>;
  expandedFileGroups: Set<string>;
  highlightedLogId: number | null;
  isExporting: boolean;
  isAnalyzing: boolean;
  canRunAnalysis: boolean;
  hasReachedDailyLimit: boolean;
  hasEnoughEvidence: boolean;
  evidenceCount: number;
  remainingEvidence: number;
  hasUnlockRequirements: boolean;
  analysisUsageCount: number;
  ANALYSIS_DAILY_LIMIT: number;
  MIN_EVIDENCE_COUNT: number;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
  onToggleStatus: () => void;
  toggleStatusPending: boolean;
  onExportPdf: () => void;
  onTriggerAnalysis: () => void;
  onSetEditIncidentOpen: (open: boolean) => void;
  onDeleteIncident: () => void;
  onLogCall: () => void;
  onLogText: () => void;
  onLogEmail: () => void;
  onLogService: () => void;
  onLogPortal: () => void;
  onLogCustom: () => void;
  onToggleChatGroup: (id: string) => void;
  onToggleFileGroup: (id: string) => void;
  onSetHighlightedLogId: (id: number | null) => void;
  openPreview: (log: IncidentLog) => void;
  openEditLog: (log: IncidentLog) => void;
  onDeleteLog: (logId: number) => void;
  onAddToAiChat?: () => void;
  onClosePanel?: () => void;
  /** 'mobile' adds mobile-specific data-testids and styling */
  variant?: 'mobile' | 'desktop';
}

export function SidebarContent({
  incident,
  logs,
  timelineItems,
  fileGroups,
  expandedChatGroups,
  expandedFileGroups,
  highlightedLogId,
  isExporting,
  isAnalyzing,
  canRunAnalysis,
  hasReachedDailyLimit,
  hasEnoughEvidence,
  evidenceCount,
  remainingEvidence,
  hasUnlockRequirements,
  analysisUsageCount,
  ANALYSIS_DAILY_LIMIT,
  MIN_EVIDENCE_COUNT,
  chatInputRef,
  onToggleStatus,
  toggleStatusPending,
  onExportPdf,
  onTriggerAnalysis,
  onSetEditIncidentOpen,
  onDeleteIncident,
  onLogCall,
  onLogText,
  onLogEmail,
  onLogService,
  onLogPortal,
  onLogCustom,
  onToggleChatGroup,
  onToggleFileGroup,
  onSetHighlightedLogId,
  openPreview,
  openEditLog,
  onDeleteLog,
  onAddToAiChat,
  onClosePanel,
  variant = 'desktop',
}: SidebarContentProps) {
  const isMobile = variant === 'mobile';

  const incidentPhotos = logs?.filter(l => l.type === 'photo' && (l.metadata as any)?.category === 'incident_photo') || [];
  const logDocCategories = ['call_document', 'text_document', 'email_document', 'service_document'];
  const incidentDocs = logs?.filter(l => {
    if (l.type !== 'document') return false;
    const cat = (l.metadata as any)?.category;
    return cat === 'incident_document' || !logDocCategories.includes(cat);
  }) || [];

  return (
    <>
      <div className={`border border-slate-300 rounded-lg p-4 ${isMobile ? 'pt-[16px] pb-[16px] mt-[13px] mb-[13px]' : 'mb-6'}`}>
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleStatus}
              disabled={toggleStatusPending}
              className={`px-3 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors ${
                isMobile ? 'pl-[10px] pr-[10px] pt-[4px] pb-[4px]' : ''
              } ${
                incident.status === 'open'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
              data-testid={isMobile ? "status-toggle-mobile" : "status-toggle"}
            >
              <Clock className="w-3 h-3" />
              {incident.status === 'open' ? 'Open' : 'Closed'}
            </button>
            {isMobile && onClosePanel && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                onClick={onClosePanel}
                data-testid="button-close-incident-panel"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-2">{incident.title}</h2>
          <p className="text-sm text-slate-600 mb-3">{incident.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{formatDateTime(incident.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                onClick={() => onSetEditIncidentOpen(true)}
                data-testid={isMobile ? "button-edit-incident-mobile" : "button-edit-incident"}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete This Case?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the case and all its evidence. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteIncident} className="bg-red-600 hover:bg-red-700">
                      Delete Case
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 mb-3 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportPdf}
            disabled={isExporting}
            className="text-slate-600 hover:text-green-700 h-7 px-2 text-xs border border-slate-300 bg-[#4d5e700f]"
            data-testid={isMobile ? "button-export-pdf" : "button-export-pdf-desktop"}
          >
            <Download className={`w-3.5 h-3.5 mr-1 ${isExporting ? 'animate-pulse' : ''}`} />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onTriggerAnalysis}
            disabled={!canRunAnalysis}
            className={`h-7 px-2 text-xs border border-slate-300 ${
              isMobile
                ? 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 min-h-8 rounded-md text-slate-600 hover:text-blue-700 bg-[#4d5e700f] pt-[0px] pb-[0px] mt-[5px] mb-[5px] pl-[8px] pr-[8px] ml-[5px] mr-[5px]'
                : canRunAnalysis ? 'text-slate-600 hover:text-blue-700 bg-[#4d5e700f]' : 'text-slate-400 bg-slate-100 opacity-60 cursor-not-allowed'
            }`}
            title={hasReachedDailyLimit ? 'Daily limit reached — try again tomorrow' : 'Run AI case analysis'}
            data-testid={isMobile ? "button-ai-analysis" : "button-ai-analysis-desktop"}
          >
            <Bot className={`w-3.5 h-3.5 mr-1 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            AI Analysis
          </Button>
        </div>
        <AnalysisUnlockChecklist
          hasEnoughEvidence={hasEnoughEvidence}
          evidenceCount={evidenceCount}
          remainingEvidence={remainingEvidence}
          hasReachedDailyLimit={hasReachedDailyLimit}
          analysisUsageCount={analysisUsageCount}
          hasUnlockRequirements={hasUnlockRequirements}
          ANALYSIS_DAILY_LIMIT={ANALYSIS_DAILY_LIMIT}
          MIN_EVIDENCE_COUNT={MIN_EVIDENCE_COUNT}
        />
      </div>

      <div className="space-y-6 mt-6">
        <div className={isMobile ? "rounded-lg border border-slate-200 bg-white p-3" : ""}>
          <div className={isMobile ? "my-1 ml-4" : "my-2 ml-[24px]"}>
            <h3 className={isMobile
              ? "relative inline-block font-bold tracking-wider text-left text-[16px] mt-[6px] mb-[6px] text-[#0f172a]"
              : "relative inline-block text-sm font-bold text-slate-900 uppercase tracking-wider"
            }>
              <span className="relative z-10 bg-white pr-2">Timeline</span>
              <span className="absolute left-[-14px] top-1/2 w-3 -translate-y-1/2 border-t-2 border-slate-200" />
              <span className="absolute left-[calc(100%+6px)] top-1/2 w-16 -translate-y-1/2 border-t-2 border-slate-200" />
            </h3>
          </div>

          {/* Add Log section */}
          <div className="space-y-2 mt-2 mb-3" data-testid={isMobile ? "log-buttons-mobile" : "log-buttons"}>
            <DropdownMenu>
              <div className="relative">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="relative w-full justify-start gap-2 h-7 px-2 pr-20 text-xs text-slate-600 hover:text-slate-700 bg-[#4d5e700f] border border-slate-300 focus-visible:ring-0 focus-visible:outline-none active:ring-0"
                    data-testid={isMobile ? "button-record-timeline-event-mobile" : "button-record-timeline-event"}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span>Record Timeline Event</span>
                    </span>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <div className="absolute right-0 top-0 h-full w-1/2 z-10" aria-hidden="true" />
              </div>
              <DropdownMenuContent align="start" sideOffset={6} className="w-[var(--radix-dropdown-menu-trigger-width)] p-1">
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm mb-1" onClick={onLogCustom}>
                  <SlidersHorizontal className="w-4 h-4 text-rose-500" />
                  <span>Record Custom</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm mb-1" onClick={onLogService}>
                  <Wrench className="w-4 h-4 text-orange-500" />
                  <span>Record Service</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm mb-1" onClick={onLogPortal}>
                  <Globe className="w-4 h-4 text-cyan-500" />
                  <span>Record Portal</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm mb-1" onClick={onLogEmail}>
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span>Record Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm mb-1" onClick={onLogText}>
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>Record Text</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 border border-slate-200/60 rounded-sm" onClick={onLogCall}>
                  <Phone className="w-4 h-4 text-green-500" />
                  <span>Record Call</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            {/* Master Bubble */}
            <div className={isMobile
              ? "bg-purple-50/30 border border-purple-100 rounded-lg p-3 min-h-[88px] flex flex-col"
              : "bg-white border-2 border-input rounded-lg p-3 shadow-md min-h-[88px] flex flex-col"
            }>
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">{incident.title}</h3>
              </div>
              <p className="text-slate-500 text-xs line-clamp-2 mb-1">{incident.description}</p>
              <div className="text-xs text-slate-400 mt-auto pt-1">
                {format(new Date(incident.createdAt), "MMM d, yyyy  h:mm a")}
              </div>
            </div>

            {/* Sub-entries with connecting line */}
            {(incidentPhotos.length > 0 || timelineItems.length > 0) && (
              <div className="ml-4 border-l-2 border-slate-200 pl-3 space-y-2">
                {/* Incident photos */}
                {incidentPhotos.length > 0 && (
                  isMobile ? (
                    <div className="ml-0 border-l-0 pl-0 pr-1 mt-0.5 flex w-full max-w-full flex-wrap gap-1 justify-start overflow-hidden">
                      {incidentPhotos.map((photo) => (
                        <ThumbnailWithDelete key={photo.id} onDelete={() => onDeleteLog(photo.id)} onPreview={() => openPreview(photo)} className="w-10 h-10 overflow-hidden cursor-pointer rounded-md">
                          <Card className="w-full h-full relative group overflow-hidden border-slate-200 rounded-md">
                            <img
                              src={photo.fileUrl!}
                              loading="lazy"
                              alt={photo.content}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-white" />
                            </div>
                          </Card>
                        </ThumbnailWithDelete>
                      ))}
                      {incidentDocs.map((doc) => (
                        <ThumbnailWithDelete key={doc.id} onDelete={() => onDeleteLog(doc.id)} onPreview={() => openPreview(doc)} className="w-10 h-10 overflow-hidden cursor-pointer rounded-md">
                          <Card className="w-full h-full relative group overflow-hidden border-slate-200 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-md">
                            <Paperclip className="w-4 h-4 text-slate-500" />
                          </Card>
                        </ThumbnailWithDelete>
                      ))}
                    </div>
                  ) : (
                    <div className="ml-4 border-l-2 border-slate-200 pl-3 mt-0.5 flex flex-wrap gap-1">
                      {incidentPhotos.map((photo) => (
                        <ThumbnailWithDelete
                          key={photo.id}
                          onDelete={() => onDeleteLog(photo.id)}
                          onPreview={() => openPreview(photo)}
                          className="w-10 h-10 overflow-hidden cursor-pointer rounded-md"
                        >
                          <Card className="w-full h-full relative group overflow-hidden border-slate-200 rounded-md">
                            <img
                              src={photo.fileUrl!}
                              loading="lazy"
                              alt={photo.content}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-white" />
                            </div>
                          </Card>
                        </ThumbnailWithDelete>
                      ))}
                    </div>
                  )
                )}

                {/* Timeline logs */}
                {timelineItems.map((item) => {
                  if (item.type === 'chat_group') {
                    const isExpanded = expandedChatGroups.has(item.id);
                    const firstChat = item.chats[0];
                    const chatCount = item.chats.length;

                    return (
                      <div key={item.id}>
                        {!isExpanded && (
                          <Card
                            className="p-2 rounded-lg min-h-[88px] shadow-sm cursor-pointer bg-slate-50 border-slate-200 hover:bg-slate-100 transition-colors flex flex-col"
                            onClick={() => onToggleChatGroup(item.id)}
                          >
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <MessageSquare className="w-3 h-3 text-slate-900" />
                                <span className="font-medium text-slate-800 text-xs">Chat</span>
                                <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs">
                                  {chatCount} messages
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </div>
                            <p className="m-0 text-slate-600 text-xs leading-4 line-clamp-2 font-normal mt-1 overflow-hidden break-words">
                              {firstChat.content}
                            </p>
                            <div className="text-xs text-slate-400 mt-auto pt-1">
                              {formatDateTime(firstChat.createdAt)}
                            </div>
                          </Card>
                        )}

                        {isExpanded && (
                          <div className="space-y-2">
                            <button
                              onClick={() => onToggleChatGroup(item.id)}
                              className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-700"
                            >
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>Chat ({chatCount} messages)</span>
                              </div>
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {item.chats.map((log) => (
                              <div key={log.id} id={`log-entry-${log.id}`} className="scroll-mb-24 md:scroll-mb-16 transition-all duration-500">
                                  <LogEntryCard
                                  log={log}
                                  logs={logs || []}
                                  icon={MessageSquare}
                                  color="text-slate-900"
                                  highlightedLogId={highlightedLogId}
                                  onSetHighlightedLogId={onSetHighlightedLogId}
                                  openPreview={openPreview}
                                  chatInputRef={chatInputRef}
                                  onEdit={openEditLog}
                                  onDelete={onDeleteLog}
                                  onAddToAiChat={onAddToAiChat}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Single log entry (non-chat)
                  const log = item.log;
                  let icon: React.ComponentType<{ className?: string }> = FileText;
                  let color = "text-slate-500";

                  if (log.type === 'call') { icon = Phone; color = "text-blue-500"; }
                  else if (log.type === 'text') { icon = MessageSquare; color = "text-green-500"; }
                  else if (log.type === 'email') { icon = Mail; color = "text-purple-500"; }
                  else if (log.type === 'photo') { icon = ImageIcon; color = "text-blue-500"; }
                  else if (log.type === 'service') { icon = Wrench; color = "text-orange-500"; }
                  else if (log.type === 'portal') { icon = Globe; color = "text-cyan-500"; }
                  else if (log.type === 'custom') { icon = SlidersHorizontal; color = "text-rose-500"; }
                  else if (log.type === 'note') { icon = FileText; color = "text-slate-500"; }

                  const attachedPhotos = logs?.filter(l => {
                    const parentLogId = (l.metadata as any)?.parentLogId;
                    return l.type === 'photo' && parentLogId === log.id;
                  }) || [];
                  const attachedDocs = logs?.filter(l => {
                    const parentLogId = (l.metadata as any)?.parentLogId;
                    return l.type === 'document' && parentLogId === log.id;
                  }) || [];
                  const hasAttachments = attachedPhotos.length > 0 || attachedDocs.length > 0;

                  return (
                    <div
                      key={log.id}
                      id={`log-entry-${log.id}`}
                      className="scroll-mb-24 md:scroll-mb-16 transition-all duration-500"
                    >
                      <LogEntryCard
                        log={log}
                        logs={logs || []}
                        icon={icon}
                        color={color}
                        highlightedLogId={highlightedLogId}
                        onSetHighlightedLogId={onSetHighlightedLogId}
                        openPreview={openPreview}
                        chatInputRef={chatInputRef}
                        onEdit={openEditLog}
                        onDelete={onDeleteLog}
                        onAddToAiChat={onAddToAiChat}
                      />
                      {hasAttachments && (
                        <div className="ml-3 border-l-2 border-slate-100 pl-2 pr-1 mt-0.5 flex w-full max-w-full flex-wrap gap-1 justify-start overflow-hidden">
                          {attachedPhotos.map((photo) => (
                            <ThumbnailWithDelete key={photo.id} onDelete={() => onDeleteLog(photo.id)} onPreview={() => openPreview(photo)} className="w-10 h-10 overflow-hidden cursor-pointer rounded-md">
                              <Card className="w-full h-full relative group overflow-hidden border-slate-200 rounded-md">
                                <img
                                  src={photo.fileUrl!}
                                  loading="lazy"
                                  alt={photo.content}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ImageIcon className="w-3 h-3 text-white" />
                                </div>
                              </Card>
                            </ThumbnailWithDelete>
                          ))}
                          {attachedDocs.map((doc) => (
                            <ThumbnailWithDelete key={doc.id} onDelete={() => onDeleteLog(doc.id)} onPreview={() => openPreview(doc)} className="w-10 h-10 overflow-hidden cursor-pointer rounded-md">
                              {isAnalysisPdf(doc) ? (
                                <Card className="w-full h-full relative flex items-center justify-center border-violet-200 bg-violet-50 rounded-md" title="AI-generated PDF analysis">
                                  <Bot className="w-4 h-4 text-violet-600" />
                                  <span className="absolute -bottom-0.5 -right-0.5 text-[8px] px-1 py-[1px] rounded bg-violet-600 text-white font-semibold">PDF</span>
                                </Card>
                              ) : (
                                <Card className="w-full h-full relative group overflow-hidden border-slate-200 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-md">
                                  <Paperclip className="w-4 h-4 text-slate-500" />
                                </Card>
                              )}
                            </ThumbnailWithDelete>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Files Section */}
        {fileGroups.length > 0 && (
          <div className={isMobile ? "rounded-lg border border-slate-200 bg-white p-3" : "ml-[10px]"}>
            <h3 className={isMobile
              ? "text-sm font-bold mb-3 tracking-wider text-[#0f172a]"
              : "text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider"
            }>Files</h3>
            <div className="space-y-1">
              {fileGroups.map((group) => {
                const isExpanded = expandedFileGroups.has(group.id);
                const GroupIcon = group.icon;
                return (
                  <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => onToggleFileGroup(group.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors"
                      data-testid={isMobile ? undefined : `btn-toggle-file-group-${group.id}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <GroupIcon className={`w-4 h-4 ${group.color} shrink-0`} />
                      <span className="text-sm font-medium text-slate-700 truncate flex-1 text-left">{group.label}</span>
                      <span className="text-xs text-slate-400 shrink-0">{group.files.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-2 bg-slate-50">
                        <div className="grid grid-cols-4 gap-1.5">
                          {group.files.map((file) => (
                            file.type === 'photo' ? (
                              <ThumbnailWithDelete key={file.id} onDelete={() => onDeleteLog(file.id)} onPreview={() => openPreview(file)} className="aspect-square overflow-hidden cursor-pointer rounded-md">
                                <Card className="w-full h-full relative group overflow-hidden border-slate-200 rounded-md" data-testid={isMobile ? undefined : `img-file-${file.id}`}>
                                  <img
                                    src={file.fileUrl!}
                                    loading="lazy"
                                    alt={file.content}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ImageIcon className="w-3 h-3 text-white" />
                                  </div>
                                </Card>
                              </ThumbnailWithDelete>
                            ) : (
                              <ThumbnailWithDelete key={file.id} onDelete={() => onDeleteLog(file.id)} onPreview={() => openPreview(file)} className="aspect-square overflow-hidden cursor-pointer rounded-md">
                                {isAnalysisPdf(file) ? (
                                  <Card className="w-full h-full relative flex items-center justify-center border-violet-200 bg-violet-50 rounded-md" title="AI-generated PDF analysis">
                                    <Bot className="w-4 h-4 text-violet-600" />
                                    <span className="absolute -bottom-0.5 -right-0.5 text-[8px] px-1 py-[1px] rounded bg-violet-600 text-white font-semibold">PDF</span>
                                  </Card>
                                ) : (
                                  <Card className="w-full h-full flex items-center justify-center hover:bg-slate-50 border-slate-200 rounded-md" data-testid={isMobile ? undefined : `doc-file-${file.id}`}>
                                    <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
                                  </Card>
                                )}
                              </ThumbnailWithDelete>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

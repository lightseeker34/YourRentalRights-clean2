import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Incident, IncidentLog, SEVERITY_LEVELS, SeverityLevel, DEFAULT_SEVERITY_BY_TYPE, getLogSeverity } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bot, User, Send, Phone, FileText, Image as ImageIcon, Trash2, Calendar, Clock, Pencil, MessageSquare, Mail, Paperclip, X, FolderOpen, RotateCcw, ChevronDown, ChevronRight, Folder, Copy, Check, Download, FolderUp, AlertTriangle, Info, Minus, Wrench, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { GuidedTour, shouldOpenMobileDrawer } from "@/components/guided-tour";
import { ChatInput, type ChatInputHandle } from "@/components/chat-input";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { ZoomableImage } from "@/components/zoomable-image";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getMetaCategory,
  getAttachedPhotos,
  getAttachedDocuments,
  getAttachmentDisplayName,
  isImageAttachmentLog,
  isLikelyImageUrl,
} from "@/lib/incident";
import { buildFileGroups } from "@/lib/incident/buildFileGroups";
import { buildTimelineItems } from "@/lib/incident/buildTimelineItems";
import { exportToPDF } from "@/lib/pdf/exportIncident";
import { saveAnalysisAsPdfToIncident as saveAnalysisPdfHelper, type AnalysisResult } from "@/lib/pdf/exportAnalysis";
import { ThumbnailWithDelete } from "@/components/incident/ThumbnailWithDelete";
import { SidebarContent } from "@/components/incident/SidebarContent";
import { MarkdownRenderer } from "@/components/incident/MarkdownRenderer";
import { LogEntryDialog } from "@/components/incident/LogEntryDialog";

const LOG_TYPE_DISPLAY_LABELS: Record<string, string> = {
  call: 'Call',
  text: 'Text',
  email: 'Email',
  service: 'Service Request',
  portal: 'Portal Entry',
  custom: 'Custom Entry',
};

function getLogTypeLabel(type: string): string {
  return LOG_TYPE_DISPLAY_LABELS[type] ?? 'Entry';
}

export default function IncidentView() {
  const [match, params] = useRoute("/dashboard/incident/:id");
  const id = params?.id;
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const [highlightedLogId, setHighlightedLogId] = useState<number | null>(null);
  
  // Edit incident state
  const [editIncidentOpen, setEditIncidentOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  
  // Log dialogs state
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [logTextOpen, setLogTextOpen] = useState(false);
  const [logEmailOpen, setLogEmailOpen] = useState(false);
  const [logServiceOpen, setLogServiceOpen] = useState(false);
  const [logServiceMode, setLogServiceMode] = useState<'service' | 'portal' | 'custom'>('service');
  const [logTitle, setLogTitle] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logSeverity, setLogSeverity] = useState<SeverityLevel>('routine');
  const [logPhotoFiles, setLogPhotoFiles] = useState<File[]>([]);
  const [logDocFiles, setLogDocFiles] = useState<File[]>([]);
  
  // Edit log state
  const [editLogId, setEditLogId] = useState<number | null>(null);
  const [editLogContent, setEditLogContent] = useState("");
  const [editLogPhoto, setEditLogPhoto] = useState<IncidentLog | null>(null);
  const [editLogAttachments, setEditLogAttachments] = useState<string[]>([]);
  const [editLogSeverity, setEditLogSeverity] = useState<SeverityLevel>('routine');
  const [showEditEvidencePicker, setShowEditEvidencePicker] = useState(false);
  const [editUploadedAttachmentLogIds, setEditUploadedAttachmentLogIds] = useState<number[]>([]);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const editFolderInputRef = useRef<HTMLInputElement>(null);
  
  // Preview state for photos/documents
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'document'>('image');
  const [previewName, setPreviewName] = useState("");
  
  // PDF Export state
  const [isExporting, setIsExporting] = useState(false);
  const [hasExportedPdf, setHasExportedPdf] = useState(false);
  
  // AI Analysis daily usage tracking (3 per day limit)
  const getAnalysisUsageKey = () => `analysis_usage_${id}_${new Date().toISOString().slice(0, 10)}`;
  const getAnalysisUsageCount = () => {
    try { return parseInt(localStorage.getItem(getAnalysisUsageKey()) || '0', 10); } catch { return 0; }
  };
  const incrementAnalysisUsage = () => {
    const count = getAnalysisUsageCount() + 1;
    localStorage.setItem(getAnalysisUsageKey(), String(count));
    setAnalysisUsageCount(count);
  };
  const [analysisUsageCount, setAnalysisUsageCount] = useState(() => {
    try { return parseInt(localStorage.getItem(`analysis_usage_${id}_${new Date().toISOString().slice(0, 10)}`) || '0', 10); } catch { return 0; }
  });
  const [loadingDots, setLoadingDots] = useState('.');
  const ANALYSIS_DAILY_LIMIT = 3;
  const MIN_EVIDENCE_COUNT = 3;

  // Litigation Review state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const [isSavingAnalysisPdf, setIsSavingAnalysisPdf] = useState(false);

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drawerOpenedByTour, setDrawerOpenedByTour] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  
  // Auto-open mobile drawer when tour step requires it (only controls tour-related opens)
  useEffect(() => {
    const checkTourDrawer = () => {
      if (window.innerWidth < 768) {
        const tourNeedsDrawer = shouldOpenMobileDrawer();
        if (tourNeedsDrawer && !mobileDrawerOpen) {
          setMobileDrawerOpen(true);
          setDrawerOpenedByTour(true);
        } else if (!tourNeedsDrawer && drawerOpenedByTour) {
          // Only auto-close if the drawer was opened by the tour
          setMobileDrawerOpen(false);
          setDrawerOpenedByTour(false);
        }
      }
    };
    checkTourDrawer();
    // Check periodically in case tour step changes
    const interval = setInterval(checkTourDrawer, 500);
    return () => clearInterval(interval);
  }, [mobileDrawerOpen, drawerOpenedByTour]);
  
  // Toast dismiss ref for persistent regeneration toast
  const resendToastRef = useRef<(() => void) | null>(null);
  
  // Log dialog photo refs and evidence picker
  const logPhotoInputRef = useRef<HTMLInputElement>(null);
  const logDocInputRef = useRef<HTMLInputElement>(null);
  const [showLogEvidencePicker, setShowLogEvidencePicker] = useState(false);
  
  // Files section state - track expanded groups
  const [expandedFileGroups, setExpandedFileGroups] = useState<Set<string>>(new Set());
  
  // Chat groups state - track which chat groups are expanded
  const [expandedChatGroups, setExpandedChatGroups] = useState<Set<string>>(new Set());

  const { data: incident, refetch: refetchIncident } = useQuery<Incident>({
    queryKey: [`/api/incidents/${id}`],
    enabled: !!id,
  });

  const { data: logs } = useQuery<IncidentLog[]>({
    queryKey: [`/api/incidents/${id}/logs`],
    enabled: !!id,
  });

  // Get log ID from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const targetLogId = urlParams.get('log');
  
  // Track which log ID we've scrolled to (to prevent duplicate scrolls)
  const scrolledToLogId = useRef<string | null>(null);
  
  // Reset scroll tracking when incident ID changes (new page load)
  useEffect(() => {
    scrolledToLogId.current = null;
  }, [id]);
  
  useEffect(() => {
    // Only scroll if we have a target log ID and logs are loaded
    if (targetLogId && logs && logs.length > 0 && scrolledToLogId.current !== targetLogId) {
      const logIdNum = parseInt(targetLogId);
      const targetLog = logs.find((l) => l.id === logIdNum);
      setHighlightedLogId(logIdNum);
      scrolledToLogId.current = targetLogId;

      // On mobile, open timeline drawer for non-chat logs so the incident timeline is visible.
      if (typeof window !== 'undefined' && window.innerWidth < 768 && targetLog && targetLog.type !== 'chat') {
        setMobileDrawerOpen(true);
        setDrawerOpenedByTour(false);
      }
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        // Try chat-entry first (main chat panel) since that's the primary view
        const chatElement = document.getElementById(`chat-entry-${targetLogId}`);
        const timelineElement = document.getElementById(`log-entry-${targetLogId}`);
        
        // Scroll chat panel first
        if (chatElement) {
          chatElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
        // Also scroll timeline if element exists (or appears after drawer opens)
        const scrollTimeline = () => {
          const el = document.getElementById(`log-entry-${targetLogId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        };
        if (timelineElement) {
          setTimeout(scrollTimeline, 150);
        } else {
          setTimeout(scrollTimeline, 500);
        }
        
        // Clear highlight after 3 seconds
        setTimeout(() => setHighlightedLogId(null), 3000);
      }, 400);
    } else if (!targetLogId && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
      scrolledToLogId.current = null;
    }
  }, [logs, targetLogId]);

  useEffect(() => {
    // Scroll to bottom when logs change, with small delay to ensure content is rendered
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [logs?.length]);

  // Count evidence entries for AI analysis gate
  const evidenceTypes = ['call', 'text', 'email', 'photo', 'document', 'note', 'call_photo', 'text_photo', 'email_photo', 'service', 'service_photo', 'service_document'];
  const evidenceCount = useMemo(() => logs?.filter(l => evidenceTypes.includes(l.type)).length || 0, [logs]);
  const hasEnoughEvidence = evidenceCount >= MIN_EVIDENCE_COUNT;
  const hasReachedDailyLimit = analysisUsageCount >= ANALYSIS_DAILY_LIMIT;
  const canRunAnalysis = hasEnoughEvidence && !hasReachedDailyLimit && !isAnalyzing;

  const getAnalysisButtonLabel = () => 'AI Analysis';

  const remainingEvidence = Math.max(0, MIN_EVIDENCE_COUNT - evidenceCount);
  const hasUnlockRequirements = hasEnoughEvidence;

  // Auto-focus chat input when no messages (shows blinking cursor)
  // DISABLED per user request to prevent keyboard popup on mobile
  // const chatLogsCount = logs?.filter(l => l.type === 'chat').length || 0;
  // const shouldAutoFocus = chatLogsCount === 0;
  const shouldAutoFocus = false;

  useEffect(() => {
    if (incident) {
      setEditTitle(incident.title);
      setEditDescription(incident.description || "");
    }
  }, [incident]);

  useEffect(() => {
    // Check for pending chat message from dashboard
    const pendingMsg = localStorage.getItem('pending_chat_msg');
    if (pendingMsg) {
      chatInputRef.current?.setInput(pendingMsg);
      localStorage.removeItem('pending_chat_msg');
      // Only focus on desktop to avoid keyboard popup on mobile
      if (window.innerWidth >= 768) {
        setTimeout(() => {
          chatInputRef.current?.focus();
        }, 500);
      }
    }
  }, []);


  const sendMutation = useMutation({
    mutationFn: async ({ message, attachments }: { message: string; attachments: string[] }) => {
      const res = await apiRequest("POST", "/api/chat", {
        incidentId: parseInt(id!),
        message,
        attachedImages: attachments.length > 0 ? attachments : undefined,
      });
      return await res.json();
    },
    onMutate: async ({ message, attachments }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const previousLogs = queryClient.getQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`]);
      const savedInput = message;
      const savedAttachments = [...attachments];
      const optimisticLog: IncidentLog = {
        id: -Date.now(),
        incidentId: parseInt(id!),
        type: "chat",
        title: null,
        content: message,
        fileUrl: null,
        metadata: attachments.length > 0 ? { attachedImages: attachments } : null,
        isAi: false,
        createdAt: new Date(),
      };
      queryClient.setQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`], (old) => 
        old ? [...old, optimisticLog] : [optimisticLog]
      );
      return { previousLogs, savedInput, savedAttachments };
    },
    onError: (err, variables, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData([`/api/incidents/${id}/logs`], context.previousLogs);
      }
      if (context?.savedInput) chatInputRef.current?.setInput(context.savedInput);
      if (context?.savedAttachments) chatInputRef.current?.setAttachments(context.savedAttachments);
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const scrollToBottom = () => {
        if (scrollRef.current) {
          const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
      };
      setTimeout(scrollToBottom, 200);
      setTimeout(scrollToBottom, 500);
      setTimeout(scrollToBottom, 1000);
    },
  });

  // Cascade delete - delete a message and all messages after it
  const cascadeDeleteMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/logs/${logId}/cascade`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      toast({ title: "Messages Deleted", description: "Message and all following messages have been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete messages.", variant: "destructive" });
    },
  });

  // Resend/regenerate AI response - delete from a message onwards and resend
  const resendMutation = useMutation({
    mutationFn: async ({ logId, message }: { logId: number; message: string }) => {
      // First cascade delete from the message
      await apiRequest("DELETE", `/api/logs/${logId}/cascade`);
      // Then send the message again
      const res = await apiRequest("POST", "/api/chat", {
        incidentId: parseInt(id!),
        message,
      });
      return await res.json();
    },
    onMutate: () => {
      const t = toast({ title: "Regenerating", description: "Getting a new response...", duration: Infinity });
      resendToastRef.current = t.dismiss;
    },
    onSuccess: () => {
      resendToastRef.current?.();
      resendToastRef.current = null;
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
    },
    onError: () => {
      resendToastRef.current?.();
      resendToastRef.current = null;
      toast({ title: "Error", description: "Failed to regenerate response.", variant: "destructive" });
    },
  });

  // Edit and resend - delete from this message, save new content and get new AI response
  const editAndResendMutation = useMutation({
    mutationFn: async ({ logId, newContent, attachments }: { logId: number; newContent: string; attachments: string[] }) => {
      // Cascade delete from this message
      await apiRequest("DELETE", `/api/logs/${logId}/cascade`);
      // Send the edited message with attachments
      const res = await apiRequest("POST", "/api/chat", {
        incidentId: parseInt(id!),
        message: newContent,
        attachedImages: attachments.length > 0 ? attachments : undefined,
      });
      return await res.json();
    },
    onSuccess: () => {
      resetEditComposerState();
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resend message.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const isBusy = sendMutation.isPending || resendMutation.isPending || editAndResendMutation.isPending;
    if (!isBusy) {
      setLoadingDots('.');
      return;
    }

    const dots = ['.', '..', '...'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % dots.length;
      setLoadingDots(dots[idx]);
    }, 450);

    return () => clearInterval(interval);
  }, [sendMutation.isPending, resendMutation.isPending, editAndResendMutation.isPending]);
  
  const resetEditComposerState = () => {
    setEditLogId(null);
    setEditLogContent("");
    setEditLogPhoto(null);
    setEditLogAttachments([]);
    setShowEditEvidencePicker(false);
    setEditUploadedAttachmentLogIds([]);
  };

  const cancelEditComposer = async () => {
    const pendingLogIds = [...editUploadedAttachmentLogIds];
    for (const uploadedLogId of pendingLogIds) {
      try {
        await apiRequest("DELETE", `/api/logs/${uploadedLogId}`);
      } catch (err) {
        console.warn("Failed to delete cancelled edit attachment", uploadedLogId, err);
      }
    }
    resetEditComposerState();
    if (pendingLogIds.length > 0) {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
    }
  };

  // Handle file upload during edit (supports multiple files - photos and documents)
  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Determine base category based on the log type being edited
    const editingLog = logs?.find(l => l.id === editLogId);
    const logType = editingLog?.type;
    
    for (const file of Array.from(files)) {
      // Determine if file is a photo or document based on mime type
      const isPhoto = file.type.startsWith('image/');
      const suffix = isPhoto ? '_photo' : '_document';
      
      let category = isPhoto ? 'chat_photo' : 'chat_document'; // fallback for chat messages
      if (logType === 'email') category = `email${suffix}`;
      else if (logType === 'text') category = `text${suffix}`;
      else if (logType === 'call') category = `call${suffix}`;
      
      const formData = new FormData();
      formData.append("file", file);
      // Include parentLogId to link file to this specific log
      if (editLogId) {
        formData.append("parentLogId", editLogId.toString());
      }
      try {
        const res = await fetch(`/api/incidents/${id}/upload?category=${category}`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setEditLogAttachments(prev => [...prev, data.fileUrl]);
          if (typeof data.id === 'number') {
            setEditUploadedAttachmentLogIds(prev => [...prev, data.id]);
          }
        }
      } catch (err) {
        toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" });
      }
    }
    e.target.value = '';
  };

  const deleteIncidentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/incidents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident Deleted", description: "The case has been removed." });
      navigate("/dashboard");
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/incidents/${id}`, { 
        title: editTitle, 
        description: editDescription 
      });
      return await res.json();
    },
    onSuccess: () => {
      refetchIncident();
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setEditIncidentOpen(false);
      toast({ title: "Updated", description: "Entry details have been updated." });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = incident?.status === "open" ? "closed" : "open";
      const res = await apiRequest("PATCH", `/api/incidents/${id}/status`, { status: newStatus });
      return await res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [`/api/incidents/${id}`] });
      const previous = queryClient.getQueryData([`/api/incidents/${id}`]);
      queryClient.setQueryData([`/api/incidents/${id}`], (old: any) => {
        if (!old) return old;
        return { ...old, status: old.status === 'open' ? 'closed' : 'open' };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([`/api/incidents/${id}`], context.previous);
      }
    },
    onSettled: () => {
      refetchIncident();
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
    },
    onSuccess: () => {
      toast({ title: "Status Updated" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      const url = category 
        ? `/api/incidents/${id}/upload?category=${category}`
        : `/api/incidents/${id}/upload`;
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    },
    onMutate: async ({ file, category }: { file: File; category?: string }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const previousLogs = queryClient.getQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`]);
      const isImage = file.type.startsWith('image/');
      const optimisticLog: IncidentLog = {
        id: -Date.now(),
        incidentId: parseInt(id!),
        type: isImage ? "photo" : "document",
        title: null,
        content: file.name,
        fileUrl: isImage ? URL.createObjectURL(file) : null,
        metadata: { uploading: true, originalName: file.name, ...(category && { category }) },
        isAi: false,
        createdAt: new Date(),
      };
      queryClient.setQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`], (old) => 
        old ? [...old, optimisticLog] : [optimisticLog]
      );
      return { previousLogs };
    },
    onError: (err, variables, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData([`/api/incidents/${id}/logs`], context.previousLogs);
      }
      toast({ title: "Upload Failed", description: "Could not upload file.", variant: "destructive" });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const type = data.type === "photo" ? "Photo" : "Document";
      toast({ title: `${type} Added`, description: "Your evidence has been logged." });
    },
  });

  const createLogWithPhotoMutation = useMutation({
    mutationFn: async ({ type, title, notes, photos, documents, severity }: { type: string; title: string; notes: string; photos: File[]; documents: File[]; severity?: SeverityLevel }) => {
      const now = new Date();
      const typeLabel = getLogTypeLabel(type);
      const effectiveSeverity = severity || DEFAULT_SEVERITY_BY_TYPE[type] || 'routine';
      
      const logRes = await apiRequest("POST", `/api/incidents/${id}/logs`, {
        incidentId: parseInt(id!),
        type,
        title: title || null,
        content: notes || `${typeLabel} logged at ${format(now, "MMM d, yyyy 'at' h:mm a")}`,
        isAi: false,
        metadata: { loggedAt: now.toISOString(), hasPhoto: photos.length > 0, photoCount: photos.length, hasDocument: documents.length > 0, documentCount: documents.length, severity: effectiveSeverity },
      });
      const logData = await logRes.json();
      
      // Upload all photos with a category reference
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        formData.append("category", `${type}_photo`);
        formData.append("parentLogId", logData.id.toString());
        const uploadRes = await fetch(`/api/incidents/${id}/upload?category=${type}_photo`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Photo upload failed");
      }
      
      // Upload all documents with a category reference
      for (const doc of documents) {
        const formData = new FormData();
        formData.append("file", doc);
        formData.append("category", `${type}_document`);
        formData.append("parentLogId", logData.id.toString());
        const uploadRes = await fetch(`/api/incidents/${id}/upload?category=${type}_document`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) throw new Error("Document upload failed");
      }
      
      return logData;
    },
    onMutate: async ({ type, title, notes, photos, severity }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const previousLogs = queryClient.getQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`]);
      const now = new Date();
      const typeLabel = getLogTypeLabel(type);
      const effectiveSeverity = severity || DEFAULT_SEVERITY_BY_TYPE[type] || 'routine';
      const optimisticLog: IncidentLog = {
        id: -Date.now(),
        incidentId: parseInt(id!),
        type,
        title: title || null,
        content: notes || `${typeLabel} logged at ${format(now, "MMM d, yyyy 'at' h:mm a")}`,
        fileUrl: null,
        metadata: { loggedAt: now.toISOString(), hasPhoto: photos.length > 0, photoCount: photos.length, severity: effectiveSeverity },
        isAi: false,
        createdAt: now,
      };
      queryClient.setQueryData<IncidentLog[]>([`/api/incidents/${id}/logs`], (old) => 
        old ? [...old, optimisticLog] : [optimisticLog]
      );
      setLogTitle("");
      setLogNotes("");
      setLogSeverity('routine');
      setLogPhotoFiles([]);
      setLogDocFiles([]);
      setLogCallOpen(false);
      setLogTextOpen(false);
      setLogEmailOpen(false);
      setLogServiceOpen(false);
      return { previousLogs };
    },
    onError: (err, variables, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData([`/api/incidents/${id}/logs`], context.previousLogs);
      }
      toast({ title: "Error", description: "Failed to create log.", variant: "destructive" });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      const typeLabel = getLogTypeLabel(variables.type);
      toast({ title: `${typeLabel} Logged`, description: `${typeLabel} has been recorded.` });
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: async ({ logId, content, severity }: { logId: number; content: string; severity?: SeverityLevel }) => {
      const log = logs?.find(l => l.id === logId);
      const metadata = log ? { ...(log.metadata as any), severity } : { severity };
      const res = await apiRequest("PATCH", `/api/logs/${logId}`, { content, metadata });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      setEditLogId(null);
      setEditLogContent("");
      setEditLogSeverity('routine');
      toast({ title: "Updated", description: "Timeline entry has been updated." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] }); // Invalidate incidents to refresh active logs everywhere
      toast({ title: "Deleted", description: "Evidence removed from case." });
    },
  });

  // Track PDF export and trigger AI litigation review
  const trackPdfExport = async () => {
    try {
      await apiRequest("POST", `/api/incidents/${id}/pdf-export`);
    } catch (error) {
      console.error("Failed to track PDF export:", error);
    }
  };

  const triggerLitigationReview = async () => {
    if (!id || !canRunAnalysis) return;
    
    setIsAnalyzing(true);
    incrementAnalysisUsage();
    try {
      const response = await apiRequest("POST", `/api/incidents/${id}/litigation-review`, {
        triggeredBy: 'user'
      });
      const data = await response.json();
      const result = data.fullAnalysis || data;
      setAnalysisResult(result);
      setShowAnalysisModal(true);
      toast({
        title: "Analysis Complete",
        description: "Your case has been analyzed for litigation potential.",
      });
    } catch (error: any) {
      console.error("Litigation review error:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze case. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveAnalysisAsPdfToIncident = () => {
    if (!incident || !analysisResult || !id) return;
    saveAnalysisPdfHelper({ incident, analysisResult, id, setIsSavingAnalysisPdf, toast, queryClient });
  };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileMutation.mutate({ file, category: 'incident_photo' });
    e.target.value = "";
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileMutation.mutate({ file, category: 'incident_document' });
    e.target.value = "";
  };

  const handleLogSubmit = (type: string) => {
    const photos = logPhotoFiles.filter(f => f.type.startsWith('image/'));
    const documents = [...logDocFiles, ...logPhotoFiles.filter(f => !f.type.startsWith('image/'))];
    createLogWithPhotoMutation.mutate({ type, title: logTitle, notes: logNotes, photos, documents, severity: logSeverity });
  };
  
  const handleLogPhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setLogPhotoFiles(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = "";
  };
  
  const removeLogPhoto = (index: number) => {
    setLogPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLogDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setLogDocFiles(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = "";
  };
  
  const removeLogDoc = (index: number) => {
    setLogDocFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openEditLog = (log: IncidentLog) => {
    setEditLogId(log.id);
    setEditLogContent(log.content);
    setEditLogSeverity(getLogSeverity(log));
    setEditUploadedAttachmentLogIds([]);
    // Load existing attachments (photos and documents) linked via parentLogId
    const attachedPhotos = getAttachedPhotos(log, logs || []);
    const attachedDocs = getAttachedDocuments(log, logs || []);
    const allAttachmentUrls = [
      ...attachedPhotos.map(p => p.fileUrl!),
      ...attachedDocs.map(d => d.fileUrl!)
    ].filter(Boolean);
    setEditLogAttachments(allAttachmentUrls);
    // For photo entries with their own fileUrl, also include it
    if (log.type === 'photo' && log.fileUrl) {
      setEditLogPhoto(log);
    } else {
      setEditLogPhoto(null);
    }
  };

  const openPreview = (log: IncidentLog) => {
    if (log.fileUrl) {
      const isImage = log.type === 'photo' || log.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      setPreviewUrl(log.fileUrl);
      setPreviewType(isImage ? 'image' : 'document');
      setPreviewName(log.content);
    }
  };

  const chatLogs = useMemo(() => logs?.filter(l => l.type === 'chat').sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
  }) || [], [logs]);

  const fileGroups = useMemo(() => buildFileGroups(logs || [], incident), [logs, incident]);

  const toggleFileGroup = (groupId: string) => {
    setExpandedFileGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const allTimelineLogs = useMemo(() => logs?.filter(l =>
    l.type === 'note' ||
    l.type === 'call' ||
    l.type === 'text' ||
    l.type === 'email' ||
    l.type === 'service' ||
    l.type === 'portal' ||
    l.type === 'custom' ||
    l.type === 'chat' ||
    (l.type === 'photo' && (getMetaCategory(l) || l.title))
  ).sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  }) || [], [logs]);

  const timelineItems = useMemo(() => buildTimelineItems(allTimelineLogs), [allTimelineLogs]);


  const toggleChatGroup = (groupId: string) => {
    setExpandedChatGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Skeleton loading state
  if (!incident) {
    return (
      <div className="flex w-full max-w-full box-border overflow-x-hidden flex-col md:flex-row h-[100svh] md:h-[100dvh] bg-slate-50">
        {/* Sidebar skeleton */}
        <div className="hidden md:flex md:flex-col md:w-80 bg-white border-r border-slate-200 p-4">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-full bg-slate-200 rounded animate-pulse mb-1" />
          <div className="h-4 w-2/3 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="space-y-3 flex-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 p-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mb-1" />
                  <div className="h-3 w-full bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Chat area skeleton */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'justify-end' : ''}`}>
                <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse" />
                <div className="max-w-[70%]">
                  <div className="h-20 w-64 bg-slate-200 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="h-12 w-full bg-slate-200 rounded animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  const formatDateTime = (date: Date | string) => {
    return format(new Date(date), "MMM d, yyyy  h:mm a");
  };

  const ImageWithFallback = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
    const [resolvedSrc, setResolvedSrc] = useState(src);
    const [triedProxy, setTriedProxy] = useState(false);

    useEffect(() => {
      setResolvedSrc(src);
      setTriedProxy(false);
    }, [src]);

    const toProxyUrl = (url: string) => {
      try {
        const u = new URL(url, window.location.origin);
        const marker = "/evidence/";
        const idx = u.pathname.indexOf(marker);
        if (idx === -1) return null;
        const key = u.pathname.slice(idx + 1);
        return `/api/r2/${key}`;
      } catch {
        return null;
      }
    };

    return (
      <img
        src={resolvedSrc}
        loading="lazy"
        alt={alt}
        className={className}
        onError={() => {
          if (!triedProxy) {
            const proxy = toProxyUrl(resolvedSrc);
            if (proxy) {
              setTriedProxy(true);
              setResolvedSrc(proxy);
              return;
            }
          }
          setResolvedSrc('/favicon.png');
        }}
      />
    );
  };


  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    if (touchStartX.current !== null && touchCurrentX.current !== null) {
      const diff = touchCurrentX.current - touchStartX.current;
      // Swipe right from left edge to open
      if (touchStartX.current < 80 && diff > 45) {
        setMobileDrawerOpen(true);
        setDrawerOpenedByTour(false);
      }
      // Swipe left to close
      if (mobileDrawerOpen && diff < -80) {
        setMobileDrawerOpen(false);
        setDrawerOpenedByTour(false);
      }
    }
    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  const handleExportToPDF = () => {
    if (!incident || !logs) return;
    exportToPDF({
      incident,
      logs,
      setIsExporting,
      setHasExportedPdf,
      toast,
      trackPdfExport,
    });
  };


  const serviceModalTitleByMode: Record<'service' | 'portal' | 'custom', string> = {
    service: 'Service Request Title',
    portal: 'Portal Entry Title',
    custom: 'Custom Entry Title',
  };
  const serviceModalDetailsByMode: Record<'service' | 'portal' | 'custom', string> = {
    service: 'Service request details',
    portal: 'Portal entry details',
    custom: 'Custom entry details',
  };
  const serviceModalSaveByMode: Record<'service' | 'portal' | 'custom', string> = {
    service: 'Save Service Request',
    portal: 'Save Portal Entry',
    custom: 'Save Custom Entry',
  };

  const evidencePhotoTypes = ['photo', 'call_photo', 'text_photo', 'email_photo', 'chat_photo', 'service_photo'];
  const evidencePhotoLogs = logs?.filter(l => evidencePhotoTypes.includes(l.type) && l.fileUrl).map(l => ({ id: l.id, fileUrl: l.fileUrl! })) || [];

  const resetLogDialogState = () => {
    setLogPhotoFiles([]);
    setLogDocFiles([]);
    setLogTitle("");
    setLogNotes("");
    setLogSeverity('routine');
    setShowLogEvidencePicker(false);
  };

  const addEvidencePhotoToLogFiles = async (fileUrl: string, logId: number) => {
    const response = await fetch(fileUrl);
    const blob = await response.blob();
    const file = new File([blob], `evidence-${logId}.jpg`, { type: blob.type });
    setLogPhotoFiles(prev => [...prev, file]);
    setShowLogEvidencePicker(false);
  };

  const sidebarProps = {
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
    onToggleStatus: () => toggleStatusMutation.mutate(),
    toggleStatusPending: toggleStatusMutation.isPending,
    onExportPdf: handleExportToPDF,
    onTriggerAnalysis: triggerLitigationReview,
    onSetEditIncidentOpen: setEditIncidentOpen,
    onDeleteIncident: () => deleteIncidentMutation.mutate(),
    onLogCall: () => {
      setLogCallOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onLogText: () => {
      setLogTextOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onLogEmail: () => {
      setLogEmailOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onLogService: () => {
      setLogServiceMode('service');
      setLogServiceOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onLogPortal: () => {
      setLogServiceMode('portal');
      setLogServiceOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onLogCustom: () => {
      setLogServiceMode('custom');
      setLogServiceOpen(true);
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onToggleChatGroup: toggleChatGroup,
    onToggleFileGroup: toggleFileGroup,
    onSetHighlightedLogId: (logId: number | null) => {
      setHighlightedLogId(logId);
      if (logId !== null) {
        setMobileDrawerOpen(false);
        setDrawerOpenedByTour(false);
      }
    },
    openPreview,
    openEditLog,
    onDeleteLog: (logId: number) => deleteMutation.mutate(logId),
    onAddToAiChat: () => {
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
    onClosePanel: () => {
      setMobileDrawerOpen(false);
      setDrawerOpenedByTour(false);
    },
  } as const;


  return (
    <div 
      className="flex w-full max-w-full box-border overflow-x-hidden h-[100svh] md:h-[100dvh] bg-slate-50"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocUpload}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
              handlePhotoUpload({ target: { files: [file] } } as any);
            } else {
              handleDocUpload({ target: { files: [file] } } as any);
            }
          });
          e.target.value = '';
        }}
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as any)}
      />
      <input
        type="file"
        ref={generalFileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.type.startsWith('image/')) {
            handlePhotoUpload(e);
          } else {
            handleDocUpload(e);
          }
          e.target.value = '';
        }}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
      {/* Edit Incident Dialog - rendered at root level to avoid mobile drawer conflicts */}
      <Dialog open={editIncidentOpen} onOpenChange={setEditIncidentOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90%] rounded-xl sm:max-w-[425px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] transition-transform duration-200 pt-[35px] pb-[35px]">
          <div className="space-y-4 pt-[8px] pb-[8px]">
            <Input 
              placeholder="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-[6px] mb-[6px] placeholder:text-slate-400"
            />
            <Textarea 
              placeholder="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="min-h-[140px] mt-[5px] mb-[5px] placeholder:text-slate-400"
            />
            {(() => {
              const editPhotos = logs?.filter(l => l.type === 'photo' && (l.metadata as any)?.category === 'incident_photo' && l.fileUrl) || [];
              const logDocCategories = ['call_document', 'text_document', 'email_document', 'service_document'];
              const editDocs = logs?.filter(l => {
                if (l.type !== 'document' || !l.fileUrl) return false;
                const cat = (l.metadata as any)?.category;
                return cat === 'incident_document' || !logDocCategories.includes(cat);
              }) || [];
              const editFiles = [...editPhotos, ...editDocs];
              if (editFiles.length === 0) return null;
              return (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-2">Attached Files</div>
                  <div className="flex flex-wrap gap-2">
                    {editPhotos.map((photo) => (
                      <ThumbnailWithDelete key={photo.id} onDelete={() => deleteMutation.mutate(photo.id)} onPreview={() => openPreview(photo)} className="w-14 h-14 overflow-hidden cursor-pointer rounded-lg">
                        <div
                          className="w-full h-full relative group overflow-hidden rounded-lg border border-slate-200"
                          data-testid={`edit-dialog-photo-${photo.id}`}
                        >
                          <img 
                            src={photo.fileUrl!} 
                            loading="lazy"
                            alt={photo.content}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      </ThumbnailWithDelete>
                    ))}
                    {editDocs.map((doc) => (
                      <ThumbnailWithDelete key={doc.id} onDelete={() => deleteMutation.mutate(doc.id)} onPreview={() => openPreview(doc)} className="w-14 h-14 overflow-hidden cursor-pointer rounded-lg">
                        <div
                          className="w-full h-full flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                          title={doc.content}
                          data-testid={`edit-dialog-doc-${doc.id}`}
                        >
                          <Paperclip className="w-4 h-4 text-slate-500" />
                        </div>
                      </ThumbnailWithDelete>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => generalFileInputRef.current?.click()}
                className="w-full justify-start"
                disabled={uploadFileMutation.isPending}
                data-testid="button-edit-incident-upload-file"
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="w-full justify-start"
                disabled={uploadFileMutation.isPending}
                data-testid="button-edit-incident-upload-folder"
              >
                <FolderUp className="w-4 h-4 mr-2" />
                Upload Folder
              </Button>
            </div>
            <Button 
              onClick={() => updateIncidentMutation.mutate()} 
              className="w-full"
              disabled={updateIncidentMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Fixed back button (mobile) */}
      <div className="fixed top-3 left-3 z-30 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm rounded-xl w-10 h-10 hover:bg-white"
          onClick={() => navigate('/dashboard')}
          aria-label="Go back"
          data-testid="button-back"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.5] text-slate-700" />
        </Button>
      </div>

      {/* Fixed back button (desktop) */}
      <div className="hidden md:block fixed top-3 right-3 z-30">
        <Button
          variant="ghost"
          className="bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm rounded-xl h-10 px-3 hover:bg-white"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to dashboard"
          data-testid="button-back-desktop"
        >
          <ArrowLeft className="w-4 h-4 mr-2 text-slate-700" />
          <span className="text-sm text-slate-700">Back</span>
        </Button>
      </div>
      {/* Mobile drawer overlay */}
      {mobileDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => { setMobileDrawerOpen(false); setDrawerOpenedByTour(false); }}
        />
      )}
      {/* Mobile drawer */}
      <div className={`fixed top-0 left-0 h-[100dvh] w-80 bg-white z-50 transform transition-transform duration-300 ease-out md:hidden flex flex-col shadow-xl rounded-r-xl ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide pb-32">
          <SidebarContent {...sidebarProps} variant="mobile" />
        </div>
      </div>
      {/* Mobile edge indicator - swipe hint */}
      <div 
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 md:hidden bg-white border border-slate-300 w-3 h-[22.5rem] rounded-r-lg shadow-md cursor-pointer"
        onClick={() => { setMobileDrawerOpen(true); setDrawerOpenedByTour(false); }}
        aria-label="Open incident panel"
      />
      {/* Desktop Sidebar / Case Info */}
      <div className="w-96 border-r border-slate-200 bg-white p-6 hidden md:block overflow-y-auto pl-[20px] pr-[20px]">
        <SidebarContent {...sidebarProps} variant="desktop" />
      </div>
      {/* Edit Log Dialog */}
      <Dialog open={editLogId !== null && !chatLogs.some(l => l.id === editLogId)} onOpenChange={(open) => { if (!open) { void cancelEditComposer(); } }}>
        <DialogContent aria-describedby={undefined} className="w-[90%] rounded-xl py-[45px]">
          <div className="space-y-4">
            <Textarea 
              value={editLogContent}
              onChange={(e) => setEditLogContent(e.target.value)}
              className="min-h-[140px]"
            />
            <div className="space-y-2">
              {/* Show existing attachments inline with remove buttons */}
              {(editLogAttachments.length > 0 || (editLogPhoto && !editLogAttachments.includes(editLogPhoto.fileUrl!))) && (
                <div className="flex gap-2 flex-wrap flex-row">
                  {/* Legacy single photo first if exists */}
                  {editLogPhoto && !editLogAttachments.includes(editLogPhoto.fileUrl!) && (
                    <div className="relative group">
                      <img 
                        src={editLogPhoto.fileUrl!} 
                        loading="lazy"
                        alt="Attached photo"
                        className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer"
                        onClick={() => openPreview(editLogPhoto)}
                      />
                      <button
                        onClick={() => {
                          if (editLogPhoto.id) {
                            deleteMutation.mutate(editLogPhoto.id);
                            setEditLogPhoto(null);
                          }
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {/* Attachments in order added */}
                  {editLogAttachments.map((url, idx) => {
                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                    return (
                      <div key={idx} className="relative group">
                        {isImage ? (
                          <img 
                            src={url} 
                            loading="lazy"
                            alt={`Attachment ${idx + 1}`}
                            className="w-12 h-12 object-cover rounded border border-slate-200"
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center rounded border border-slate-200 bg-slate-50">
                            <Paperclip className="w-4 h-4 text-slate-500" />
                          </div>
                        )}
                        <button 
                          onClick={() => setEditLogAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`remove-edit-attachment-modal-${idx}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Evidence picker for modal */}
              {showEditEvidencePicker && (() => {
                const photoTypes = ['photo', 'call_photo', 'text_photo', 'email_photo', 'chat_photo', 'service_photo'];
                const photoLogs = logs?.filter(l => photoTypes.includes(l.type) && l.fileUrl) || [];
                return (
                  <div className="p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
                    <div className="text-xs text-slate-500 mb-1">Select from evidence:</div>
                    <div className="flex gap-1 flex-wrap">
                      {photoLogs.map(l => (
                        <button 
                          key={l.id} 
                          onClick={() => {
                            if (!editLogAttachments.includes(l.fileUrl!)) {
                              setEditLogAttachments(prev => [...prev, l.fileUrl!]);
                            }
                            setShowEditEvidencePicker(false);
                          }}
                          className="relative"
                          data-testid={`modal-evidence-picker-${l.id}`}
                        >
                          <img 
                            src={l.fileUrl!} 
                            loading="lazy"
                            alt="Evidence" 
                            className="w-10 h-10 object-cover rounded border border-slate-300 hover:border-blue-500 transition-colors"
                          />
                        </button>
                      ))}
                      {photoLogs.length === 0 && (
                        <div className="text-xs text-slate-400">No photos in evidence</div>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Stacked attachment buttons */}
              <div className="flex flex-col gap-2">
                <input 
                  type="file" 
                  ref={editPhotoInputRef} 
                  onChange={handleEditPhotoUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt" 
                  multiple
                  className="hidden"
                />
                <input 
                  type="file" 
                  ref={editFolderInputRef} 
                  onChange={handleEditPhotoUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt" 
                  multiple
                  className="hidden"
                  {...({ webkitdirectory: "", directory: "" } as any)}
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => editPhotoInputRef.current?.click()}
                  className="w-full justify-start"
                  data-testid="button-modal-upload-file"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => editFolderInputRef.current?.click()}
                  className="w-full justify-start"
                  data-testid="button-modal-upload-folder"
                >
                  <FolderUp className="w-4 h-4 mr-2" />
                  Upload Folder
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowEditEvidencePicker(!showEditEvidencePicker)}
                  className="w-full justify-start"
                  data-testid="button-modal-pick-evidence"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  From Evidence
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Severity</Label>
              <div className="flex gap-1">
                {SEVERITY_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setEditLogSeverity(level)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${editLogSeverity === level 
                      ? level === 'critical' ? 'bg-red-100 border-red-300 text-red-700' 
                        : level === 'important' ? 'bg-amber-100 border-amber-300 text-amber-700' 
                        : 'bg-slate-100 border-slate-300 text-slate-600'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    data-testid={`severity-edit-${level}`}
                  >
                    {level === 'critical' ? <AlertTriangle className="w-3 h-3" /> : level === 'important' ? <Info className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Button 
              onClick={() => editLogId && updateLogMutation.mutate({ logId: editLogId, content: editLogContent, severity: editLogSeverity })} 
              className="w-full"
              disabled={updateLogMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Log Entry Dialogs */}
      <LogEntryDialog
        open={logCallOpen}
        onOpenChange={setLogCallOpen}
        type="call"
        titlePlaceholder="Call Title"
        notesPlaceholder="Call notes"
        saveLabel="Save Call Entry"
        title={logTitle}
        notes={logNotes}
        files={logPhotoFiles}
        severity={logSeverity}
        showEvidencePicker={showLogEvidencePicker}
        photoInputRef={logPhotoInputRef}
        folderInputId="log-call-folder-input"
        disabled={createLogWithPhotoMutation.isPending}
        evidencePhotos={evidencePhotoLogs}
        onTitleChange={setLogTitle}
        onNotesChange={setLogNotes}
        onSeverityChange={setLogSeverity}
        onFileAdd={handleLogPhotoAdd}
        onRemoveFile={removeLogPhoto}
        onToggleEvidencePicker={() => setShowLogEvidencePicker(!showLogEvidencePicker)}
        onPickEvidence={addEvidencePhotoToLogFiles}
        onSave={() => handleLogSubmit('call')}
        onReset={resetLogDialogState}
        severityTestIdPrefix="severity-call"
        uploadFileTestId="button-log-call-upload-file"
        uploadFolderTestId="button-log-call-upload-folder"
        pickEvidenceTestId="button-log-call-pick-evidence"
        evidencePickerTestIdPrefix="log-evidence-picker"
      />
      <LogEntryDialog
        open={logTextOpen}
        onOpenChange={setLogTextOpen}
        type="text"
        titlePlaceholder="Text Title"
        notesPlaceholder="Text message"
        saveLabel="Save Text Entry"
        title={logTitle}
        notes={logNotes}
        files={logPhotoFiles}
        severity={logSeverity}
        showEvidencePicker={showLogEvidencePicker}
        photoInputRef={logPhotoInputRef}
        folderInputId="log-text-folder-input"
        disabled={createLogWithPhotoMutation.isPending}
        evidencePhotos={evidencePhotoLogs}
        onTitleChange={setLogTitle}
        onNotesChange={setLogNotes}
        onSeverityChange={setLogSeverity}
        onFileAdd={handleLogPhotoAdd}
        onRemoveFile={removeLogPhoto}
        onToggleEvidencePicker={() => setShowLogEvidencePicker(!showLogEvidencePicker)}
        onPickEvidence={addEvidencePhotoToLogFiles}
        onSave={() => handleLogSubmit('text')}
        onReset={resetLogDialogState}
        severityTestIdPrefix="severity-text"
        uploadFileTestId="button-log-text-upload-file"
        uploadFolderTestId="button-log-text-upload-folder"
        pickEvidenceTestId="button-log-text-pick-evidence"
        evidencePickerTestIdPrefix="log-text-evidence-picker"
      />
      <LogEntryDialog
        open={logEmailOpen}
        onOpenChange={setLogEmailOpen}
        type="email"
        titlePlaceholder="Email Title"
        notesPlaceholder="Email summary"
        saveLabel="Save Email Entry"
        title={logTitle}
        notes={logNotes}
        files={logPhotoFiles}
        severity={logSeverity}
        showEvidencePicker={showLogEvidencePicker}
        photoInputRef={logPhotoInputRef}
        folderInputId="log-email-folder-input"
        disabled={createLogWithPhotoMutation.isPending}
        evidencePhotos={evidencePhotoLogs}
        onTitleChange={setLogTitle}
        onNotesChange={setLogNotes}
        onSeverityChange={setLogSeverity}
        onFileAdd={handleLogPhotoAdd}
        onRemoveFile={removeLogPhoto}
        onToggleEvidencePicker={() => setShowLogEvidencePicker(!showLogEvidencePicker)}
        onPickEvidence={addEvidencePhotoToLogFiles}
        onSave={() => handleLogSubmit('email')}
        onReset={resetLogDialogState}
        severityTestIdPrefix="severity-email"
        uploadFileTestId="button-log-email-upload-file"
        uploadFolderTestId="button-log-email-upload-folder"
        pickEvidenceTestId="button-log-email-pick-evidence"
        evidencePickerTestIdPrefix="log-email-evidence-picker"
      />
      <LogEntryDialog
        open={logServiceOpen}
        onOpenChange={setLogServiceOpen}
        type="service"
        titlePlaceholder={serviceModalTitleByMode[logServiceMode]}
        notesPlaceholder={serviceModalDetailsByMode[logServiceMode]}
        saveLabel={serviceModalSaveByMode[logServiceMode]}
        title={logTitle}
        notes={logNotes}
        files={logPhotoFiles}
        severity={logSeverity}
        showEvidencePicker={showLogEvidencePicker}
        photoInputRef={logPhotoInputRef}
        folderInputId="log-service-folder-input"
        disabled={createLogWithPhotoMutation.isPending}
        evidencePhotos={evidencePhotoLogs}
        onTitleChange={setLogTitle}
        onNotesChange={setLogNotes}
        onSeverityChange={setLogSeverity}
        onFileAdd={handleLogPhotoAdd}
        onRemoveFile={removeLogPhoto}
        onToggleEvidencePicker={() => setShowLogEvidencePicker(!showLogEvidencePicker)}
        onPickEvidence={addEvidencePhotoToLogFiles}
        onSave={() => handleLogSubmit(logServiceMode)}
        onReset={resetLogDialogState}
        severityTestIdPrefix="severity-service"
        uploadFileTestId="button-log-service-upload-file"
        uploadFolderTestId="button-log-service-upload-folder"
        pickEvidenceTestId="button-log-service-pick-evidence"
        evidencePickerTestIdPrefix="log-service-evidence-picker"
        removeFileTestIdPrefix="remove-log-service-file"
      />
      {/* Preview Dialog for Photos/Documents */}
      <ImagePreviewModal
        open={previewUrl !== null}
        onOpenChange={(open) => { if (!open) { setPreviewUrl(null); } }}
        previewType={previewType}
        previewUrl={previewUrl}
        previewName={previewName}
        renderImage={() => (
          <ZoomableImage>
            <ImageWithFallback
              src={previewUrl || ''}
              alt={previewName}
              className="block mx-auto h-auto max-w-[96vw] max-h-[92vh] object-contain"
            />
          </ZoomableImage>
        )}
      />
      {/* AI Analysis Results Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Case Analysis
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveAnalysisAsPdfToIncident}
                disabled={!analysisResult || isSavingAnalysisPdf}
                data-testid="button-save-analysis-pdf"
              >
                {isSavingAnalysisPdf ? 'Saving...' : 'Save PDF to Incident'}
              </Button>
            </div>
            <DialogDescription className="sr-only">AI summary and recommendations for this incident.</DialogDescription>
          </DialogHeader>
          {analysisResult && (
            <div className="space-y-6 py-4">
              {/* Summary */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
                <p className="text-slate-600 text-sm">{analysisResult.summary}</p>
              </div>

              {/* Evidence Score & Recommendation */}
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-50 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500 mb-1">Evidence Score</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{analysisResult.evidenceScore}</span>
                    <span className="text-slate-400">/10</span>
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-lg p-4">
                  <div className="text-xs font-medium text-slate-500 mb-1">Recommendation</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    analysisResult.recommendation === 'strong' 
                      ? 'bg-green-100 text-green-700' 
                      : analysisResult.recommendation === 'moderate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {analysisResult.recommendation === 'strong' ? 'Strong Case' : 
                     analysisResult.recommendation === 'moderate' ? 'Moderate Case' : 'Weak Case'}
                  </span>
                </div>
              </div>

              {/* Violations */}
              {analysisResult.violations && analysisResult.violations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Potential Violations</h3>
                  <div className="space-y-2">
                    {analysisResult.violations.map((v, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <span className="font-mono text-xs text-blue-600">{v.code}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            v.severity === 'high' ? 'bg-red-100 text-red-600' :
                            v.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {v.severity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{v.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline Analysis */}
              {analysisResult.timelineAnalysis && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Timeline Analysis</h3>
                  <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{analysisResult.timelineAnalysis}</p>
                </div>
              )}

              {/* Strength & Weakness Factors */}
              <div className="grid grid-cols-2 gap-4">
                {analysisResult.strengthFactors && analysisResult.strengthFactors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Strengths</h3>
                    <ul className="space-y-1">
                      {analysisResult.strengthFactors.map((f, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                          <span className="text-green-500 mt-0.5">+</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysisResult.weaknessFactors && analysisResult.weaknessFactors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Weaknesses</h3>
                    <ul className="space-y-1">
                      {analysisResult.weaknessFactors.map((f, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                          <span className="text-red-500 mt-0.5">-</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Next Steps */}
              {analysisResult.nextSteps && analysisResult.nextSteps.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Recommended Next Steps</h3>
                  <ol className="space-y-2">
                    {analysisResult.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="text-xs text-slate-400 pt-4 border-t">
                This analysis is for informational purposes only and does not constitute legal advice. 
                Consult with a qualified attorney for specific legal guidance.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Chat Area */}
      <div className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden flex flex-col">
        <ScrollArea ref={scrollRef} className="chat-scroll-area relative w-full max-w-full overflow-hidden flex-1 p-4 bg-slate-50 pb-[0px]">
          <div className="w-full min-w-0 max-w-5xl mx-auto md:px-2 space-y-6 pb-28 md:pb-6 overflow-x-hidden">
            {chatLogs.length === 0 && (
              <div className="flex items-center justify-center h-full min-h-[280px] bg-gradient-to-b from-slate-50 to-slate-100/50 overflow-hidden mt-16 md:mt-6 mb-6" data-testid="chat-empty-state">
                <div className="flex flex-col items-center select-none w-full max-w-[calc(100vw-2rem)] px-2 overflow-hidden" data-testid="ai-assistant-placeholder">
                  <div className="bg-white/90 border border-slate-200/60 rounded-3xl px-8 py-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-full overflow-hidden flex flex-col items-center">
                    <span className="block text-7xl font-light text-slate-300 leading-[0.8] text-center tracking-tighter">Your</span>
                    <span className="block text-7xl font-light text-slate-300 leading-[0.8] text-center tracking-tighter mt-[9px] mb-[9px]">Assistant</span>
                  </div>
                  <div className="mt-6 w-full max-w-[340px]">
                    <div className="bg-white/70 border border-slate-200/50 rounded-2xl px-6 py-4 shadow-[0_4px_15px_rgb(0,0,0,0.02)] pt-[1px] pb-[1px]">
                      <span className="text-slate-400 font-light text-[18px] text-center block leading-relaxed">Ask a question about your case to get started.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {chatLogs.map((log) => (
              <div id={`chat-entry-${log.id}`} key={log.id} className={`scroll-mb-24 md:scroll-mb-16 flex w-full max-w-full min-w-0 gap-2 md:gap-4 transition-all duration-500 ${!log.isAi ? "flex-row-reverse" : ""}`}>
                <div className={`flex flex-col min-w-0 w-full ${log.isAi ? 'max-w-full md:max-w-[92%] pr-0 md:pr-1' : 'max-w-[calc(88%-15px)] md:max-w-[calc(85%-15px)] ml-auto items-end mr-0 md:mr-0'}`}>
                  {editLogId === log.id && (
                    <>
                      {/* Desktop inline edit */}
                      <div className="hidden md:flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm w-full">
                        <Textarea
                          value={editLogContent}
                          onChange={(e) => setEditLogContent(e.target.value)}
                          className="min-h-[140px] text-sm mt-[10px] mb-[10px]"
                          data-testid={`edit-chat-textarea-${log.id}`}
                        />
                        
                        {/* Attachment management section */}
                        <div className="space-y-2">
                          {/* Show existing attachments with remove buttons */}
                          {editLogAttachments.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {editLogAttachments.map((url, idx) => (
                                <div key={idx} className="relative group mt-[5px] mb-[5px]">
                                  <img 
                                    src={url} 
                                    loading="lazy"
                                    alt={`Attachment ${idx + 1}`}
                                    className="w-12 h-12 object-cover rounded border border-slate-200 mt-[6px] mb-[6px]"
                                  />
                                  <button 
                                    onClick={() => setEditLogAttachments(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    data-testid={`remove-edit-attachment-${idx}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Evidence picker for edit */}
                          {showEditEvidencePicker && (() => {
                            const photoTypes = ['photo', 'call_photo', 'text_photo', 'email_photo', 'chat_photo', 'service_photo'];
                            const photoLogs = logs?.filter(l => photoTypes.includes(l.type) && l.fileUrl) || [];
                            return (
                              <div className="p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
                                <div className="text-xs text-slate-500 mb-1">Select from evidence:</div>
                                <div className="flex gap-1 flex-wrap">
                                  {photoLogs.map(l => (
                                    <button 
                                      key={l.id} 
                                      onClick={() => {
                                        if (!editLogAttachments.includes(l.fileUrl!)) {
                                          setEditLogAttachments(prev => [...prev, l.fileUrl!]);
                                        }
                                        setShowEditEvidencePicker(false);
                                      }}
                                      className="relative"
                                      data-testid={`edit-evidence-picker-${l.id}`}
                                    >
                                      <img 
                                        src={l.fileUrl!} 
                                        loading="lazy"
                                        alt="Evidence" 
                                        className="w-10 h-10 object-cover rounded border border-slate-300 hover:border-blue-500 transition-colors"
                                      />
                                    </button>
                                  ))}
                                  {photoLogs.length === 0 && (
                                    <div className="text-xs text-slate-400">No photos in evidence</div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Add attachment buttons - stacked vertically */}
                          <div className="flex flex-col gap-2">
                            <input 
                              type="file" 
                              ref={editPhotoInputRef} 
                              onChange={handleEditPhotoUpload}
                              accept="image/*,.pdf,.doc,.docx,.txt" 
                              multiple
                              className="hidden"
                            />
                            <input 
                              type="file" 
                              accept="image/*,.pdf,.doc,.docx,.txt"
                              multiple
                              onChange={handleEditPhotoUpload}
                              className="hidden"
                              id="edit-chat-folder-input-desktop"
                              {...({ webkitdirectory: "", directory: "" } as any)}
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => editPhotoInputRef.current?.click()}
                              className="text-xs w-full justify-start"
                              data-testid="button-edit-upload-file"
                            >
                              <Paperclip className="w-4 h-4 mr-1" />
                              Upload File
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => document.getElementById('edit-chat-folder-input-desktop')?.click()}
                              className="text-xs w-full justify-start"
                              data-testid="button-edit-upload-folder"
                            >
                              <FolderUp className="w-4 h-4 mr-1" />
                              Upload Folder
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowEditEvidencePicker(!showEditEvidencePicker)}
                              className="text-xs w-full justify-start"
                              data-testid="button-edit-pick-evidence"
                            >
                              <FolderOpen className="w-4 h-4 mr-1" />
                              From Evidence
                            </Button>
                          </div>
                        </div>
                        
                        <div className={`flex gap-2 ${log.isAi ? 'md:ml-15' : 'md:mr-10'} ${log.isAi ? 'justify-start' : 'justify-end'}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { void cancelEditComposer(); }}
                            data-testid={`cancel-edit-chat-${log.id}`}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => editAndResendMutation.mutate({ logId: log.id, newContent: editLogContent, attachments: editLogAttachments })}
                            disabled={editAndResendMutation.isPending}
                            className={editAndResendMutation.isPending ? 'button-wave-loading disabled:opacity-100 min-w-[130px]' : 'min-w-[130px]'}
                            data-testid={`save-edit-chat-${log.id}`}
                          >
                            {editAndResendMutation.isPending ? (
                              <span className="inline-flex items-center">
                                <span>Reanalyzing</span>
                                <span className="inline-block w-[3ch] text-left">{loadingDots}</span>
                              </span>
                            ) : 'Save & Resend'}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Mobile centered modal edit */}
                      <div className="md:hidden">
                        {/* Backdrop */}
                        <div 
                          className="fixed inset-0 bg-black/50 z-[9998]"
                          onClick={() => { void cancelEditComposer(); }}
                        />
                        {/* Centered modal */}
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                          <div className="w-[90%] max-w-md bg-white border border-slate-200 rounded-xl shadow-lg pt-12 pb-4 px-4 flex flex-col gap-2 relative">
                            <button
                              onClick={() => { void cancelEditComposer(); }}
                              className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 transition-colors"
                              data-testid="close-edit-chat-mobile"
                            >
                              <X className="w-4 h-4 text-slate-500" />
                            </button>
                            <Textarea
                              value={editLogContent}
                              onChange={(e) => setEditLogContent(e.target.value)}
                              className="min-h-[140px] text-sm placeholder:text-slate-400"
                              placeholder="Edit message..."
                            />
                            
                            {/* Show existing attachments */}
                            {editLogAttachments.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {editLogAttachments.map((url, idx) => (
                                  <div key={idx} className="relative group">
                                    <img 
                                      src={url} 
                                      loading="lazy"
                                      alt={`Attachment ${idx + 1}`}
                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                    />
                                    <button 
                                      onClick={() => setEditLogAttachments(prev => prev.filter((_, i) => i !== idx))}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Attachment buttons */}
                            <div className="flex flex-col gap-2">
                              <input 
                                type="file" 
                                accept="image/*,.pdf,.doc,.docx,.txt"
                                multiple
                                onChange={handleEditPhotoUpload}
                                className="hidden"
                                id="edit-chat-folder-input-mobile"
                                {...({ webkitdirectory: "", directory: "" } as any)}
                              />
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => editPhotoInputRef.current?.click()}
                                className="w-full justify-start"
                              >
                                <Paperclip className="w-4 h-4 mr-2" />
                                Upload File
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => document.getElementById('edit-chat-folder-input-mobile')?.click()}
                                className="w-full justify-start"
                              >
                                <FolderUp className="w-4 h-4 mr-2" />
                                Upload Folder
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowEditEvidencePicker(!showEditEvidencePicker)}
                                className="w-full justify-start"
                              >
                                <FolderOpen className="w-4 h-4 mr-2" />
                                From Evidence
                              </Button>
                            </div>
                            
                            {/* Evidence picker */}
                            {showEditEvidencePicker && (() => {
                              const photoTypes = ['photo', 'call_photo', 'text_photo', 'email_photo', 'chat_photo', 'service_photo'];
                              const photoLogs = logs?.filter(l => photoTypes.includes(l.type) && l.fileUrl) || [];
                              return (
                                <div className="p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
                                  <div className="text-xs text-slate-500 mb-1">Select from evidence:</div>
                                  <div className="flex gap-1 flex-wrap">
                                    {photoLogs.map(l => (
                                      <button 
                                        key={l.id} 
                                        onClick={() => {
                                          if (!editLogAttachments.includes(l.fileUrl!)) {
                                            setEditLogAttachments(prev => [...prev, l.fileUrl!]);
                                          }
                                          setShowEditEvidencePicker(false);
                                        }}
                                        className="relative"
                                      >
                                        <img 
                                          src={l.fileUrl!} 
                                          loading="lazy"
                                          alt="Evidence" 
                                          className="w-10 h-10 object-cover rounded border border-slate-300 hover:border-blue-500 transition-colors"
                                        />
                                      </button>
                                    ))}
                                    {photoLogs.length === 0 && (
                                      <div className="text-xs text-slate-400">No photos in evidence</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { void cancelEditComposer(); }}
                              >
                                Cancel
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={() => editAndResendMutation.mutate({ logId: log.id, newContent: editLogContent, attachments: editLogAttachments })}
                                disabled={editAndResendMutation.isPending}
                                className={editAndResendMutation.isPending ? 'button-wave-loading disabled:opacity-100 min-w-[130px]' : 'min-w-[130px]'}
                              >
                                {editAndResendMutation.isPending ? (
                                  <span className="inline-flex items-center">
                                    <span>Reanalyzing</span>
                                    <span className="inline-block w-[3ch] text-left">{loadingDots}</span>
                                  </span>
                                ) : 'Save & Resend'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {editLogId !== log.id && (
                    <>
                      <div className={`px-[10px] md:px-5 md:mx-10 rounded-xl transition-all duration-500 mt-[10px] mb-[10px] pt-[8px] pb-[8px] min-w-0 max-w-full overflow-hidden ${
                        log.isAi 
                          ? "bg-transparent text-slate-700 text-[16px] md:text-[15px] leading-7 md:leading-relaxed" 
                          : "bg-[var(--color-user-bubble)] text-slate-600 text-sm leading-relaxed font-normal border border-[var(--color-user-bubble-border)] shadow-sm whitespace-pre-wrap break-words max-w-full"
                      }`}>
                        {log.isAi ? (
                          <div className="w-full min-w-0 overflow-hidden">
                            <MarkdownRenderer content={log.content} isAi={true} />
                          </div>
                        ) : (
                          <>
                            <MarkdownRenderer content={log.content} isAi={false} />
                            {/* Show attachment thumbnails for user messages */}
                            {(log.metadata as any)?.attachedImages?.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap max-w-full overflow-hidden">
                                {((log.metadata as any).attachedImages as string[]).map((url, idx) => (
                                  (() => {
                                    const attachmentLog = logs?.find((entry) => entry.fileUrl === url);
                                    const isImage = attachmentLog ? isImageAttachmentLog(attachmentLog) : isLikelyImageUrl(url);
                                    const attachmentName = attachmentLog ? getAttachmentDisplayName(attachmentLog) : `Attachment ${idx + 1}`;

                                    const handleAttachmentClick = (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (attachmentLog) {
                                        openPreview(attachmentLog);
                                        return;
                                      }

                                      if (isImage) {
                                        setPreviewUrl(url);
                                        setPreviewType('image');
                                        setPreviewName(attachmentName);
                                        return;
                                      }

                                      window.open(url, "_blank", "noopener,noreferrer");
                                    };

                                    if (isImage) {
                                      return (
                                        <img
                                          key={idx}
                                          src={url}
                                          loading="lazy"
                                          alt={attachmentName}
                                          className="w-8 h-8 object-cover rounded border border-white/30 cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={handleAttachmentClick}
                                          data-testid={`chat-attachment-thumb-${log.id}-${idx}`}
                                        />
                                      );
                                    }

                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        className="w-8 h-8 rounded border border-white/30 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                                        onClick={handleAttachmentClick}
                                        title={attachmentName}
                                        data-testid={`chat-attachment-thumb-${log.id}-${idx}`}
                                      >
                                        <Paperclip className="w-3 h-3 text-white" />
                                      </button>
                                    );
                                  })()
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 pt-[0px] pb-[0px] mt-[0px] mb-[0px] min-w-0 flex-wrap ${log.isAi ? "justify-start ml-[10px] md:ml-15" : "justify-end md:mr-10"}`}>
                        <span className="text-xs text-slate-400 ml-[5px] mr-[5px]">
                          {formatDateTime(log.createdAt)}
                        </span>
                        {log.isAi ? (
                          <>
                            {/* AI message controls: copy, resend, delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                navigator.clipboard.writeText(log.content);
                                toast({ title: "Copied!", description: "Message copied to clipboard" });
                              }}
                              title="Copy message"
                              data-testid={`copy-ai-${log.id}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${resendMutation.isPending ? 'text-slate-900 bg-slate-200 opacity-60 cursor-not-allowed' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                              disabled={resendMutation.isPending}
                              onClick={() => {
                                // Find the user message before this AI response and resend it
                                const chatLogsArr = chatLogs || [];
                                const idx = chatLogsArr.findIndex(l => l.id === log.id);
                                if (idx > 0) {
                                  const prevUserLog = chatLogsArr[idx - 1];
                                  if (!prevUserLog.isAi) {
                                    resendMutation.mutate({ logId: prevUserLog.id, message: prevUserLog.content });
                                  }
                                }
                              }}
                              title={resendMutation.isPending ? "Regenerating..." : "Regenerate response"}
                              data-testid={`resend-ai-${log.id}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => cascadeDeleteMutation.mutate(log.id)}
                              title="Delete this and all messages below"
                              data-testid={`delete-ai-${log.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* User message controls: edit, resend, delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => { 
                                setEditLogId(log.id); 
                                setEditLogContent(log.content);
                                // Load existing attachments
                                const existingAttachments = (log.metadata as any)?.attachedImages || [];
                                setEditLogAttachments(existingAttachments);
                                setShowEditEvidencePicker(false);
                              }}
                              title="Edit message"
                              data-testid={`edit-chat-${log.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${resendMutation.isPending ? 'text-slate-900 bg-slate-200 opacity-60 cursor-not-allowed' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                              disabled={resendMutation.isPending}
                              onClick={() => resendMutation.mutate({ logId: log.id, message: log.content })}
                              title={resendMutation.isPending ? "Regenerating..." : "Resend message"}
                              data-testid={`resend-user-${log.id}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => cascadeDeleteMutation.mutate(log.id)}
                              title="Delete this and all messages below"
                              data-testid={`delete-user-${log.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {(sendMutation.isPending || resendMutation.isPending || editAndResendMutation.isPending) && (
              <div className="flex gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-4 min-w-[120px] rounded-xl bg-white border border-slate-200 text-slate-500 text-sm italic">
                  {`Analyzing${loadingDots}`}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="relative bg-slate-50">
          <div className="pointer-events-none absolute -top-10 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-slate-50" />
          <ChatInput
            ref={chatInputRef}
            incidentId={id!}
            logs={logs}
            isSending={sendMutation.isPending}
            autoFocusWhenEmpty={shouldAutoFocus}
            onSend={(message, attachments) => sendMutation.mutate({ message, attachments })}
          />
        </div>
      </div>
      <GuidedTour />
    </div>
  );
}

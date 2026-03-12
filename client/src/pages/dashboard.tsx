import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Incident, InsertIncident, IncidentLog } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Clock, CheckCircle, Phone, MessageSquare, Mail, FileText, Image as ImageIcon, Trash2, ChevronRight, ChevronDown, Paperclip, X, FolderUp, Wrench, Globe, SlidersHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { GuidedTour } from "@/components/guided-tour";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton card that mimics the incident card layout
function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-full sm:w-72">
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex justify-between items-start mb-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-2/3 mb-1" />
        <Skeleton className="h-3 w-24 mt-2" />
      </div>
    </div>
  );
}

// Prefetch incident data
function prefetchIncident(incidentId: number, prefetchedSet: Set<number>) {
  if (prefetchedSet.has(incidentId)) return;
  prefetchedSet.add(incidentId);
  
  queryClient.prefetchQuery({
    queryKey: [`/api/incidents/${incidentId}`],
    queryFn: async () => {
      const res = await fetch(`/api/incidents/${incidentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30000,
  });
  queryClient.prefetchQuery({
    queryKey: [`/api/incidents/${incidentId}/logs`],
    queryFn: async () => {
      const res = await fetch(`/api/incidents/${incidentId}/logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30000,
  });
}

function TimelineCard({ incident, onPrefetch }: { incident: Incident; onPrefetch?: (id: number) => void }) {
  const [expandedChatGroups, setExpandedChatGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: logs } = useQuery<IncidentLog[]>({
    queryKey: [`/api/incidents/${incident.id}/logs`],
  });

  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [editIncidentOpen, setEditIncidentOpen] = useState(false);

  const updateIncidentMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const res = await apiRequest("PATCH", `/api/incidents/${incident.id}`, data);
      return await res.json();
    },
    onMutate: async (updatedIncident: { title: string; description: string }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/incidents"] });
      const previousIncidents = queryClient.getQueryData<Incident[]>(["/api/incidents"]);

      queryClient.setQueryData<Incident[]>(["/api/incidents"], (old) =>
        old?.map((existingIncident) =>
          existingIncident.id === incident.id
            ? { ...existingIncident, ...updatedIncident }
            : existingIncident
        )
      );

      return { previousIncidents };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousIncidents) {
        queryClient.setQueryData(["/api/incidents"], context.previousIncidents);
      }
      toast({ title: "Save Failed", description: "Could not save incident details.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setEditIncidentOpen(false);
      setEditingIncident(null);
      toast({ title: "Changes Saved", description: "Incident details updated." });
    },
  });

  const handleEditIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIncident) {
      updateIncidentMutation.mutate({ 
        title: editingIncident.title, 
        description: editingIncident.description || "" 
      });
    }
  };

  const entryLogs = logs?.filter(l => l.type !== 'document' && (l.type !== 'photo' || l.title)).sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }) || [];

  type TimelineItem = { type: 'single'; log: IncidentLog } | { type: 'chat_group'; id: string; chats: IncidentLog[] };
  
  const groupedEntries = (): TimelineItem[] => {
    const items: TimelineItem[] = [];
    let currentChatGroup: IncidentLog[] = [];
    let chatGroupIndex = 0;
    
    for (const log of entryLogs) {
      if (log.type === 'chat') {
        currentChatGroup.push(log);
      } else {
        if (currentChatGroup.length > 0) {
          items.push({ type: 'chat_group', id: `chat-group-${incident.id}-${chatGroupIndex}`, chats: currentChatGroup });
          chatGroupIndex++;
          currentChatGroup = [];
        }
        items.push({ type: 'single', log });
      }
    }
    
    if (currentChatGroup.length > 0) {
      items.push({ type: 'chat_group', id: `chat-group-${incident.id}-${chatGroupIndex}`, chats: currentChatGroup });
    }
    
    return items;
  };
  
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

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="w-3 h-3 text-blue-500" />;
      case 'text': return <MessageSquare className="w-3 h-3 text-green-500" />;
      case 'email': return <Mail className="w-3 h-3 text-purple-500" />;
      case 'service': return <Wrench className="w-3 h-3 text-orange-500" />;
      case 'portal': return <Globe className="w-3 h-3 text-cyan-500" />;
      case 'custom': return <SlidersHorizontal className="w-3 h-3 text-rose-500" />;
      case 'note': return <FileText className="w-3 h-3 text-slate-500" />;
      case 'photo': return <ImageIcon className="w-3 h-3 text-blue-500" />;
      case 'chat': return <MessageSquare className="w-3 h-3 text-slate-900" />;
      default: return <FileText className="w-3 h-3 text-slate-500" />;
    }
  };

  return (
    <div className="flex-shrink-0 w-full sm:w-[16.5rem]" data-testid={`incident-card-${incident.id}`}>
      <div className="relative group/master">
        <Link 
          className="block w-full"
          href={`/dashboard/incident/${incident.id}`}
          onPointerDown={() => onPrefetch?.(incident.id)}
          onMouseEnter={() => onPrefetch?.(incident.id)}
          onFocus={() => onPrefetch?.(incident.id)}
        >
          <div
            className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer w-[94%] sm:w-[15.5rem] mx-auto"
            data-testid={`incident-card-bubble-${incident.id}`}
          >
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">{incident.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {incident.status === 'open' ? (
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-0.5 shrink-0">
                    <Clock className="w-2.5 h-2.5" /> Open
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-0.5 shrink-0">
                    <CheckCircle className="w-2.5 h-2.5" /> Closed
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-500 text-xs line-clamp-2 mb-1">{incident.description}</p>
            <div className="text-xs text-slate-400">
              {format(new Date(incident.createdAt), "MMM d, yyyy  h:mm a")}
            </div>
          </div>
        </Link>
      </div>
      <Dialog open={editIncidentOpen} onOpenChange={setEditIncidentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditIncident} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input 
                value={editingIncident?.title || ""} 
                onChange={e => setEditingIncident(prev => prev ? {...prev, title: e.target.value} : null)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={editingIncident?.description || ""} 
                onChange={e => setEditingIncident(prev => prev ? {...prev, description: e.target.value} : null)}
                required 
                className="min-h-[140px]"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateIncidentMutation.isPending}>
              {updateIncidentMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {groupedEntries().length > 0 && (
        <div className="relative w-[94%] sm:w-[15.5rem] mx-auto pl-2 mt-2 space-y-2">
          <div aria-hidden="true" className="absolute top-0 bottom-0 left-[14px] border-l-2 border-slate-200" />
          {groupedEntries().map((item) => {
            if (item.type === 'chat_group') {
              const isExpanded = expandedChatGroups.has(item.id);
              const firstChat = item.chats[0];
              const chatCount = item.chats.length;
              
              return (
                <div key={item.id}>
                  {!isExpanded && (
                    <div 
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2 min-h-[88px] shadow-sm hover:bg-slate-100 transition-colors cursor-pointer w-[92%] ml-auto flex flex-col"
                      onClick={() => toggleChatGroup(item.id)}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MessageSquare className="w-3 h-3 text-slate-900" />
                          <span className="font-medium text-slate-800 text-xs">Chat</span>
                          <span className="bg-slate-200 text-slate-600 px-1 py-0.5 rounded text-[10px]">
                            {chatCount} msgs
                          </span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>
                      <div className="text-slate-600 text-xs line-clamp-2 font-normal prose prose-slate max-w-none prose-p:my-0">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({children}) => <span className="inline">{children}</span>,
                            strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                            em: ({children}) => <em className="italic">{children}</em>,
                            h1: ({children}) => <span className="font-bold">{children}</span>,
                            h2: ({children}) => <span className="font-bold">{children}</span>,
                            h3: ({children}) => <span className="font-bold">{children}</span>,
                            table: ({children}) => (
                              <div className="w-full max-w-full overflow-x-auto my-2 border rounded bg-white">
                                <table className="w-full border-collapse text-xs text-left">{children}</table>
                              </div>
                            ),
                            thead: ({children}) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>,
                            tbody: ({children}) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                            tr: ({children}) => <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>,
                            th: ({children}) => <th className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">{children}</th>,
                            td: ({children}) => <td className="px-2 py-1 text-slate-600 whitespace-pre-wrap min-w-[100px]">{children}</td>,
                          }}
                        >
                          {firstChat.content}
                        </ReactMarkdown>
                      </div>
                      <div className="text-xs text-slate-400 mt-auto pt-1">
                        {format(new Date(firstChat.createdAt), "MMM d, yyyy  h:mm a")}
                      </div>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="space-y-1">
                      <button 
                        onClick={() => toggleChatGroup(item.id)}
                        className="flex items-center justify-between w-[92%] ml-auto text-xs text-slate-500 hover:text-slate-700"
                      >
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span className="font-semibold">Chat ({chatCount} msgs)</span>
                        </div>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {item.chats.map((log) => (
                        <Link key={log.id} href={`/dashboard/incident/${incident.id}?log=${log.id}`} className="block w-full">
                          <div className={`border rounded-lg p-2 min-h-[88px] shadow-sm transition-colors cursor-pointer w-[92%] ml-auto flex flex-col ${
                            log.isAi 
                              ? "bg-slate-100 border-slate-300 hover:bg-slate-200" 
                              : "bg-[var(--color-user-bubble)] border-[var(--color-user-bubble-border)] hover:bg-[var(--color-user-bubble)]/90"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <MessageSquare className="w-3 h-3 text-slate-900" />
                              <span className="font-medium text-xs text-slate-800">
                                {log.isAi ? 'Assistant' : 'You'}
                              </span>
                            </div>
                            <div className="text-xs line-clamp-2 font-normal prose prose-slate max-w-none prose-p:my-0 text-slate-600">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({children}) => <span className="inline">{children}</span>,
                                  strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                                  em: ({children}) => <em className="italic">{children}</em>,
                                  h1: ({children}) => <span className="font-bold">{children}</span>,
                                  h2: ({children}) => <span className="font-bold">{children}</span>,
                                  h3: ({children}) => <span className="font-semibold">{children}</span>,
                                  table: ({children}) => (
                                    <div className="w-full max-w-full overflow-x-auto my-2 border rounded bg-white">
                                      <table className="w-full border-collapse text-xs text-left">{children}</table>
                                    </div>
                                  ),
                                  thead: ({children}) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>,
                                  tbody: ({children}) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                                  tr: ({children}) => <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>,
                                  th: ({children}) => <th className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">{children}</th>,
                                  td: ({children}) => <td className="px-2 py-1 text-slate-600 whitespace-pre-wrap min-w-[100px]">{children}</td>,
                                }}
                              >
                                {log.content}
                              </ReactMarkdown>
                            </div>
                            <div className="text-xs text-slate-400 mt-auto pt-1">
                              {format(new Date(log.createdAt), "MMM d, yyyy  h:mm a")}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            
            const log = item.log;
            return (
              <div key={log.id} className="relative group/entry">
                <Link href={`/dashboard/incident/${incident.id}?log=${log.id}`} className="block w-full">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 min-h-[88px] shadow-sm hover:bg-slate-100 transition-colors cursor-pointer w-[92%] ml-auto flex flex-col">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getEntryIcon(log.type)}
                        <span className="font-medium text-slate-800 text-xs line-clamp-1">
                          {log.type.charAt(0).toUpperCase() + log.type.slice(1)}{log.title ? `: ${log.title}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-slate-600 text-xs line-clamp-2 font-normal prose prose-slate max-w-none prose-p:my-0">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({children}) => <span className="inline">{children}</span>,
                          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                          em: ({children}) => <em className="italic">{children}</em>,
                          h1: ({children}) => <span className="font-bold">{children}</span>,
                          h2: ({children}) => <span className="font-bold">{children}</span>,
                          h3: ({children}) => <span className="font-semibold">{children}</span>,
                          table: ({children}) => (
                            <div className="w-full max-w-full overflow-x-auto my-2 border rounded bg-white">
                              <table className="w-full border-collapse text-xs text-left">{children}</table>
                            </div>
                          ),
                          thead: ({children}) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>,
                          tbody: ({children}) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
                          tr: ({children}) => <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>,
                          th: ({children}) => <th className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">{children}</th>,
                          td: ({children}) => <td className="px-2 py-1 text-slate-600 whitespace-pre-wrap min-w-[100px]">{children}</td>,
                        }}
                      >
                        {log.content}
                      </ReactMarkdown>
                    </div>
                    <div className="text-xs text-slate-400 mt-auto pt-1">
                      {format(new Date(log.createdAt), "MMM d, yyyy  h:mm a")}
                    </div>
                  </div>
                </Link>
                <div className="absolute bottom-1 right-1 flex items-center gap-0.5 opacity-0 group-hover/entry:opacity-100 transition-opacity">
                  {(log.type === 'call' || log.type === 'text' || log.type === 'email') && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-blue-500 hover:text-blue-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const typeLabel = log.type === 'call' ? 'Call log' : log.type === 'text' ? 'Text log' : 'Email log';
                        localStorage.setItem('pending_chat_msg', `Add this to our discussion: [${typeLabel}] ${log.content}`);
                        window.location.href = `/dashboard/incident/${incident.id}`;
                      }}
                      title="Add to AI Chat"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [incidentPhotos, setIncidentPhotos] = useState<File[]>([]);
  const [location] = useLocation();
  
  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });
  
  // IntersectionObserver ref for observing cards
  const observerRef = useRef<IntersectionObserver | null>(null);
  

  // Track prefetched incidents for this component lifecycle
  const prefetchedRef = useRef<Set<number>>(new Set());
  
  // Sorted incidents for consistent ordering
  const sortedIncidents = useMemo(() => 
    incidents?.slice().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ), [incidents]);
  
  // Eagerly prefetch the first few incidents when dashboard loads
  useEffect(() => {

    if (sortedIncidents && sortedIncidents.length > 0) {
      // Prefetch up to 3 incidents immediately for instant navigation
      const idsToPrefetch = sortedIncidents.slice(0, 3).map(i => i.id);
      idsToPrefetch.forEach(id => prefetchIncident(id, prefetchedRef.current));
    }
  }, [sortedIncidents]);
  
  // Prefetch handler for Link events

  const handlePrefetch = useCallback((incidentId: number) => {
    prefetchIncident(incidentId, prefetchedRef.current);
  }, []);
  
  // Create callback ref function to observe cards on mount/unmount
  const createCardRef = useCallback((incidentId: number) => (el: HTMLDivElement | null) => {
    if (el) {
      cardRefsMap.current.set(incidentId, el);
      observerRef.current?.observe(el);
    } else {
      const existing = cardRefsMap.current.get(incidentId);
      if (existing) {
        observerRef.current?.unobserve(existing);
        cardRefsMap.current.delete(incidentId);
      }
    }
  }, []);
  
  // Scroll to specific incident by index
  const scrollToIndex = useCallback((index: number) => {
    if (!sortedIncidents || index < 0 || index >= sortedIncidents.length) return;
    const incidentId = sortedIncidents[index].id;
    const cardElement = cardRefsMap.current.get(incidentId);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setCurrentIndex(index);
    }
  }, [sortedIncidents]);
  
  // Track if we've initialized the index
  const hasInitializedRef = useRef(false);
  
  // Setup IntersectionObserver with carousel container as root
  useEffect(() => {
    const container = carouselRef.current;
    if (!container || !sortedIncidents) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Find incident ID from the element
            const entries = Array.from(cardRefsMap.current.entries());
            for (let i = 0; i < entries.length; i++) {
              const [incidentId, element] = entries[i];
              if (element === entry.target) {
                // Find index in sorted list
                const index = sortedIncidents.findIndex(inc => inc.id === incidentId);
                if (index !== -1) {
                  setCurrentIndex(index);
                }
                break;
              }
            }
          }
        });
      },
      { root: container, threshold: 0.5 }
    );
    
    // Observe any already-mounted cards
    cardRefsMap.current.forEach((ref) => {
      observerRef.current?.observe(ref);
    });
    
    // Initialize currentIndex to 0 only on first mount
    if (!hasInitializedRef.current) {
      setCurrentIndex(0);
      hasInitializedRef.current = true;
    }
    
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [sortedIncidents]);

  const createMutation = useMutation({
    mutationFn: async ({ data, photos }: { data: InsertIncident; photos: File[] }) => {
      const res = await apiRequest("POST", "/api/incidents", data);
      const incident = await res.json();
      
      // Upload all photos with incident_photo category
      let uploadFailures = 0;
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("file", photo);
        const uploadRes = await fetch(`/api/incidents/${incident.id}/upload?category=incident_photo`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!uploadRes.ok) {
          uploadFailures++;
        }
      }
      
      return { incident, uploadFailures };
    },
    onMutate: async ({ data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/incidents"] });
      
      // Snapshot the previous value
      const previousIncidents = queryClient.getQueryData<Incident[]>(["/api/incidents"]);
      
      // Optimistically add new incident with temporary ID
      const optimisticIncident: Incident = {
        id: -Date.now(), // Temporary negative ID
        userId: user?.id || 0,
        title: data.title,
        description: data.description || "",
        status: "open",
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<Incident[]>(["/api/incidents"], (old) => 
        old ? [optimisticIncident, ...old] : [optimisticIncident]
      );
      
      // Close dialog immediately for snappy feel
      setOpen(false);
      setTitle("");
      setDesc("");
      setIncidentPhotos([]);
      
      // Optimistic toast
      toast({ title: "Incident Created", description: "New timeline started." });

      return { previousIncidents };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousIncidents) {
        queryClient.setQueryData(["/api/incidents"], context.previousIncidents);
      }
      toast({ title: "Error", description: "Failed to create incident. Please try again.", variant: "destructive" });
    },
    onSuccess: ({ uploadFailures }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      // Scroll to top/start to show the new incident
      if (carouselRef.current) {
        carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        setCurrentIndex(0);
      }
      scrollToIndex(0);
      
      // Try to focus the first card for accessibility/keyboard users
      setTimeout(() => {
        const firstCard = document.querySelector('[data-testid^="incident-card-"] a');
        if (firstCard instanceof HTMLElement) {
          firstCard.focus();
        }
      }, 500); // Wait for optimistic render
      
      if (uploadFailures > 0) {
        toast({ title: "Upload Issue", description: `${uploadFailures} photo(s) failed to upload, but incident was created.`, variant: "destructive" });
      }
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || !desc.trim()) return;
    createMutation.mutate({ data: { title, description: desc }, photos: incidentPhotos });
  };

  const newIncidentDialogContent = (
    <DialogContent className="w-[90%] rounded-xl sm:max-w-[425px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] transition-transform duration-200 pt-[45px] pb-[45px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Input 
            placeholder="Log Title" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            required 
            className="mt-[6px] mb-[6px] placeholder:text-slate-400"
            data-testid="input-log-title"
          />
        </div>
        <div className="space-y-2">
          <Textarea 
            placeholder="Briefly describe what happened..." 
            value={desc} 
            onChange={e => setDesc(e.target.value)} 
            required 
            className="min-h-[140px] mt-[5px] mb-[5px] placeholder:text-slate-400"
            data-testid="input-log-description"
          />
        </div>
        <div className="space-y-2">
          {incidentPhotos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {incidentPhotos.map((file, idx) => (
                <div key={idx} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt="" className="w-12 h-12 object-cover rounded border border-slate-200" data-testid={`img-incident-photo-${idx}`} />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center rounded border border-slate-200 bg-slate-50">
                      <Paperclip className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid={`btn-remove-incident-photo-${idx}`}
                    onClick={() => setIncidentPhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input 
              type="file" 
              accept="image/*,.pdf,.doc,.docx,.txt"
              multiple
              data-testid="input-incident-photos"
              onChange={(e) => {
                setIncidentPhotos(prev => [...prev, ...Array.from(e.target.files || [])]);
                e.target.value = '';
              }}
              className="hidden"
              ref={(el) => { if (el) (el as any)._newLogFileInput = true; }}
              id="new-log-file-input"
            />
            <input 
              type="file" 
              accept="image/*,.pdf,.doc,.docx,.txt"
              multiple
              onChange={(e) => {
                setIncidentPhotos(prev => [...prev, ...Array.from(e.target.files || [])]);
                e.target.value = '';
              }}
              className="hidden"
              id="new-log-folder-input"
              {...({ webkitdirectory: "", directory: "" } as any)}
            />
            <Button 
              variant="outline" 
              size="sm"
              type="button"
              onClick={() => document.getElementById('new-log-file-input')?.click()}
              className="w-full justify-start"
              data-testid="button-new-log-upload-file"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              type="button"
              onClick={() => document.getElementById('new-log-folder-input')?.click()}
              className="w-full justify-start"
              data-testid="button-new-log-upload-folder"
            >
              <FolderUp className="w-4 h-4 mr-2" />
              Upload Folder
            </Button>
          </div>
        </div>
        <Button 
          onClick={() => handleSubmit()}
          className="w-full" 
          disabled={createMutation.isPending}
          data-testid="btn-create-log"
        >
          Create Log
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-8 max-w-6xl h-[100dvh] sm:h-auto sm:min-h-[calc(100vh-64px)] flex flex-col overflow-hidden sm:overflow-visible bg-slate-50 sm:bg-transparent">
      {/* Mobile CTA only */}
      <div className="shrink-0 pt-4 pb-2 px-4 bg-slate-50 z-10 sm:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-[94%] sm:w-[15.5rem] mx-auto h-[3.25rem] text-base font-semibold btn-gradient shadow-lg rounded-lg" 
              data-testid="add-new-log-button"
            >
              {incidents && incidents.length > 0 ? 'Add New Incident' : 'Create First Incident'}
            </Button>
          </DialogTrigger>
          {newIncidentDialogContent}
        </Dialog>
      </div>

      {/* Desktop Header (Hidden on Mobile) */}
      <div className="hidden sm:flex shrink-0 flex-row justify-between items-center gap-4 mb-8 px-[10px]">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome, {user?.fullName || user?.username}</h1>
          <p className="text-base text-slate-600">Track and manage maintenance and interactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button 
              className="h-[3.25rem] w-[15.5rem] text-base font-semibold btn-gradient shadow-lg rounded-lg px-4" 
              data-testid="add-new-log-button-desktop"
            >
              {incidents && incidents.length > 0 ? 'Add New Incident' : 'Create First Incident'}
            </Button>
          </DialogTrigger>
          {newIncidentDialogContent}
        </Dialog>
      </div>
      {isLoading ? (
        <>
          {/* Mobile skeleton loading */}
          <div className="flex-1 flex flex-col sm:hidden px-4 py-4 overflow-hidden">
            <SkeletonCard />
          </div>
          {/* Desktop skeleton loading */}
          <div className="hidden sm:flex sm:flex-wrap gap-4 p-4 flex-1">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      ) : incidents?.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center py-12 sm:py-16 px-6 sm:px-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 max-w-lg w-full">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No active logs</h3>
            <p className="text-slate-500">Create a new log to start tracking evidence.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: iOS-style horizontal carousel with locked header */}
          <div className="flex-1 flex flex-col sm:hidden relative min-h-0">
            <div 
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full"
            >
              {sortedIncidents?.map((incident) => (
                <div 
                  key={incident.id} 
                  ref={createCardRef(incident.id)}
                  className="w-full flex-shrink-0 snap-center px-4 h-full overflow-y-auto pb-16"
                >
                  <TimelineCard incident={incident} onPrefetch={handlePrefetch} />
                </div>
              ))}
            </div>
            
            {/* iOS-style dot indicators - Fixed at bottom of viewport */}
            {sortedIncidents && sortedIncidents.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
                <div className="pointer-events-auto inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-transparent">
                  {sortedIncidents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                        index === currentIndex 
                          ? 'bg-slate-800 w-4' 
                          : 'bg-slate-300/80 hover:bg-slate-400'
                      }`}
                      aria-label={`Go to incident ${index + 1}`}
                      data-testid={`carousel-dot-${index}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop: Original horizontal row layout */}
          <div className="hidden sm:flex sm:flex-row gap-4 sm:gap-6 sm:overflow-x-auto px-2 sm:px-[30px] flex-1 md:overflow-y-visible pt-2 pb-32">
            {sortedIncidents?.map((incident) => (
              <TimelineCard key={incident.id} incident={incident} />
            ))}
          </div>
        </>
      )}
      <GuidedTour />
    </div>
  );
}

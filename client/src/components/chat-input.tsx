import { useState, useRef, memo, forwardRef, useImperativeHandle, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, Paperclip, FolderOpen, FolderUp, X, Check } from "lucide-react";
import type { IncidentLog } from "@shared/schema";

export interface ChatInputHandle {
  setInput: (value: string) => void;
  setAttachments: (attachments: string[]) => void;
  getState: () => { input: string; attachments: string[] };
  focus: () => void;
}

interface ChatInputProps {
  incidentId: string;
  logs: IncidentLog[] | undefined;
  isSending: boolean;
  autoFocusWhenEmpty?: boolean;
  onSend: (message: string, attachments: string[]) => void;
}

export const ChatInput = memo(forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ incidentId, logs, isSending, autoFocusWhenEmpty, onSend }, ref) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setInput: (value: string) => setInput(value),
    setAttachments: (attachments: string[]) => setChatAttachments(attachments),
    getState: () => ({ input, attachments: chatAttachments }),
    focus: () => textareaRef.current?.focus(),
  }));

  useEffect(() => {
    // Disabled auto-focus to prevent mobile keyboard from popping up
    // if (autoFocusWhenEmpty && textareaRef.current) {
    //   textareaRef.current.focus();
    // }
  }, [autoFocusWhenEmpty]);

  const [chatAttachments, setChatAttachments] = useState<string[]>([]);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showEvidencePicker, setShowEvidencePicker] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatFolderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadChatPhotoMutation = useMutation({
    mutationFn: async ({ file, tempUrl }: { file: File; tempUrl: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      const isPhoto = file.type.startsWith('image/');
      const category = isPhoto ? 'chat_photo' : 'chat_document';
      const res = await fetch(`/api/incidents/${incidentId}/upload?category=${category}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    },
    onMutate: async ({ tempUrl }) => {
      const previousAttachments = [...chatAttachments];
      setChatAttachments(prev => [...prev, tempUrl]);
      return { previousAttachments, tempUrl };
    },
    onError: (err, variables, context) => {
      if (context?.previousAttachments) {
        setChatAttachments(context.previousAttachments);
      }
      toast({ title: "Upload Failed", description: "Could not upload file.", variant: "destructive" });
    },
    onSuccess: (data, variables, context) => {
      if (data.fileUrl && context?.tempUrl) {
        setChatAttachments(prev => prev.map(url => url === context.tempUrl ? data.fileUrl : url));
      }
      toast({ title: "File attached", description: "File will be sent with your message." });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const tempUrl = URL.createObjectURL(file);
        uploadChatPhotoMutation.mutate({ file, tempUrl });
      });
    }
    e.target.value = "";
    setShowPlusMenu(false);
  };

  const addExistingEvidence = (fileUrl: string) => {
    if (!chatAttachments.includes(fileUrl)) {
      setChatAttachments(prev => [...prev, fileUrl]);
    }
  };

  const removeAttachment = (url: string) => {
    setChatAttachments(prev => prev.filter(u => u !== url));
  };

  const handleSend = () => {
    if (!input.trim() && chatAttachments.length === 0) return;
    onSend(input, chatAttachments);
    setInput("");
    setChatAttachments([]);
    setShowPlusMenu(false);
    setShowEvidencePicker(false);
  };

  const photoTypes = ['photo', 'call_photo', 'text_photo', 'email_photo', 'chat_photo', 'service_photo'];
  const photoLogs = logs?.filter(l => photoTypes.includes(l.type) && l.fileUrl) || [];

  return (
    <div className="shrink-0 px-3 pt-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] bg-slate-50">
      <div className="w-full max-w-3xl mx-auto">
        {showEvidencePicker && (
          <div className="mb-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-44 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-600">Select from evidence (tap multiple):</div>
              <button
                onClick={() => setShowEvidencePicker(false)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="close-evidence-picker"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {photoLogs.map(l => {
                const isSelected = chatAttachments.includes(l.fileUrl!);
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      if (isSelected) {
                        removeAttachment(l.fileUrl!);
                      } else {
                        addExistingEvidence(l.fileUrl!);
                      }
                    }}
                    className="relative"
                    data-testid={`evidence-picker-${l.id}`}
                  >
                    <img
                      src={l.fileUrl!}
                      loading="lazy"
                      alt="Evidence"
                      className={`w-12 h-12 object-cover rounded border-2 transition-colors ${isSelected ? 'border-blue-500' : 'border-slate-300 hover:border-blue-400'}`}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/30 rounded flex items-center justify-center">
                        <Check className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
              {photoLogs.length === 0 && (
                <div className="text-xs text-slate-400">No photos in evidence yet</div>
              )}
            </div>
          </div>
        )}

        <div className="min-w-0 w-full border border-slate-200 rounded-xl bg-white focus-within:border-slate-400 transition-colors">
          {chatAttachments.length > 0 && (
            <div className="flex gap-2 flex-wrap px-3 pt-3">
              {chatAttachments.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={url}
                    loading="lazy"
                    alt="Attached"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                    data-testid={`chat-attachment-preview-${idx}`}
                  />
                  <button
                    onClick={() => removeAttachment(url)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    data-testid={`remove-chat-attachment-${idx}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isSending) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[34px] max-h-[160px] px-3 py-1.5 text-sm caret-slate-800 placeholder:text-slate-400"
            data-testid="input-chat-message"
            rows={1}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-0.5 relative">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                multiple
                className="hidden"
              />
              <input
                type="file"
                ref={chatFolderInputRef}
                onChange={handleFileUpload}
                className="hidden"
                {...({ webkitdirectory: "", directory: "" } as any)}
              />

              <button
                type="button"
                onClick={() => { setShowPlusMenu(!showPlusMenu); setShowEvidencePicker(false); }}
                className={`p-1.5 rounded-full transition-colors ${showPlusMenu ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                title="Add attachment"
                data-testid="button-plus-menu"
              >
                <Plus className={`w-6 h-6 transition-transform ${showPlusMenu ? 'rotate-45' : ''}`} />
              </button>

              {showPlusMenu && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px] z-10">
                  <button
                    onClick={() => { chatFileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    disabled={uploadChatPhotoMutation.isPending}
                    data-testid="button-upload-chat-file"
                  >
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    Upload File
                  </button>
                  <button
                    onClick={() => { chatFolderInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    data-testid="button-upload-chat-folder"
                  >
                    <FolderUp className="w-4 h-4 text-slate-500" />
                    Upload Folder
                  </button>
                  <button
                    onClick={() => { setShowEvidencePicker(!showEvidencePicker); setShowPlusMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    data-testid="button-pick-evidence"
                  >
                    <FolderOpen className="w-4 h-4 text-slate-500" />
                    From Evidence
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || (!input.trim() && chatAttachments.length === 0)}
              className={`p-2.5 rounded-full transition-colors ${input.trim() || chatAttachments.length > 0 ? 'bg-[#4d75f7] text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-500'}`}
              data-testid="button-send-chat"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}));

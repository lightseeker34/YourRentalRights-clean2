import { FolderOpen, FolderUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type EvidencePhoto = {
  id: number;
  fileUrl: string;
};

type MobileChatEditDialogProps = {
  open: boolean;
  content: string;
  attachments: string[];
  showEvidencePicker: boolean;
  evidencePhotos: EvidencePhoto[];
  loading: boolean;
  loadingDots: string;
  onClose: () => void;
  onContentChange: (value: string) => void;
  onRemoveAttachment: (index: number) => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onToggleEvidencePicker: () => void;
  onPickEvidence: (fileUrl: string) => void;
  onSave: () => void;
};

export function MobileChatEditDialog({
  open,
  content,
  attachments,
  showEvidencePicker,
  evidencePhotos,
  loading,
  loadingDots,
  onClose,
  onContentChange,
  onRemoveAttachment,
  onUploadFile,
  onUploadFolder,
  onToggleEvidencePicker,
  onPickEvidence,
  onSave,
}: MobileChatEditDialogProps) {
  if (!open) return null;

  return (
    <div className="md:hidden">
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="w-[90%] max-w-md bg-white border border-slate-200 rounded-xl shadow-lg pt-12 pb-4 px-4 flex flex-col gap-2 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-100 transition-colors"
            data-testid="close-edit-chat-mobile"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[140px] text-sm placeholder:text-slate-400"
            placeholder="Edit message..."
          />

          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attachments.map((url, idx) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)(?:[?#].*)?$/i.test(url);
                return (
                  <div key={`${url}-${idx}`} className="relative group">
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
                      onClick={() => onRemoveAttachment(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadFile}
              className="w-full justify-start"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadFolder}
              className="w-full justify-start"
            >
              <FolderUp className="w-4 h-4 mr-2" />
              Upload Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleEvidencePicker}
              className="w-full justify-start"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              From Evidence
            </Button>
          </div>

          {showEvidencePicker && (
            <div className="p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
              <div className="text-xs text-slate-500 mb-1">Select from evidence:</div>
              <div className="flex gap-1 flex-wrap">
                {evidencePhotos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => onPickEvidence(photo.fileUrl)}
                    className="relative"
                  >
                    <img
                      src={photo.fileUrl}
                      loading="lazy"
                      alt="Evidence"
                      className="w-10 h-10 object-cover rounded border border-slate-300 hover:border-blue-500 transition-colors"
                    />
                  </button>
                ))}
                {evidencePhotos.length === 0 && (
                  <div className="text-xs text-slate-400">No photos in evidence</div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={loading}
              className={loading ? 'button-wave-loading disabled:opacity-100 min-w-[130px]' : 'min-w-[130px]'}
            >
              {loading ? (
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
  );
}

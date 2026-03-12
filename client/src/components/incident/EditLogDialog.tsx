import { RefObject } from "react";
import { AlertTriangle, FolderOpen, FolderUp, Info, Minus, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SEVERITY_LEVELS, SeverityLevel } from "@shared/schema";

type EvidencePhoto = {
  id: number;
  fileUrl: string;
};

type LegacyPhoto = {
  id?: number;
  fileUrl?: string | null;
};

type EditLogDialogProps = {
  open: boolean;
  content: string;
  attachments: string[];
  legacyPhoto: LegacyPhoto | null;
  showEvidencePicker: boolean;
  evidencePhotos: EvidencePhoto[];
  severity: SeverityLevel;
  uploadPending?: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onOpenChange: (open: boolean) => void;
  onContentChange: (value: string) => void;
  onRemoveLegacyPhoto: () => void;
  onPreviewLegacyPhoto: () => void;
  onRemoveAttachment: (index: number) => void;
  onToggleEvidencePicker: () => void;
  onPickEvidence: (fileUrl: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeverityChange: (value: SeverityLevel) => void;
  onSave: () => void;
};

export function EditLogDialog({
  open,
  content,
  attachments,
  legacyPhoto,
  showEvidencePicker,
  evidencePhotos,
  severity,
  uploadPending,
  photoInputRef,
  folderInputRef,
  onOpenChange,
  onContentChange,
  onRemoveLegacyPhoto,
  onPreviewLegacyPhoto,
  onRemoveAttachment,
  onToggleEvidencePicker,
  onPickEvidence,
  onFileUpload,
  onSeverityChange,
  onSave,
}: EditLogDialogProps) {
  const showLegacyPhoto = Boolean(legacyPhoto?.fileUrl && !attachments.includes(legacyPhoto.fileUrl));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[90%] rounded-xl py-[45px]">
        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[140px]"
          />
          <div className="space-y-2">
            {(attachments.length > 0 || showLegacyPhoto) && (
              <div className="flex gap-2 flex-wrap flex-row">
                {showLegacyPhoto && (
                  <div className="relative group">
                    <img
                      src={legacyPhoto!.fileUrl!}
                      loading="lazy"
                      alt="Attached photo"
                      className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer"
                      onClick={onPreviewLegacyPhoto}
                    />
                    <button
                      onClick={onRemoveLegacyPhoto}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {attachments.map((url, idx) => {
                  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
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
            {showEvidencePicker && (
              <div className="p-2 bg-slate-50 rounded border border-slate-200 max-h-32 overflow-y-auto">
                <div className="text-xs text-slate-500 mb-1">Select from evidence:</div>
                <div className="flex gap-1 flex-wrap">
                  {evidencePhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => onPickEvidence(photo.fileUrl)}
                      className="relative"
                      data-testid={`modal-evidence-picker-${photo.id}`}
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
            <div className="flex flex-col gap-2">
              <input
                type="file"
                ref={photoInputRef}
                onChange={onFileUpload}
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
              />
              <input
                type="file"
                ref={folderInputRef}
                onChange={onFileUpload}
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                className="hidden"
                {...({ webkitdirectory: "", directory: "" } as any)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                className="w-full justify-start"
                data-testid="button-modal-upload-file"
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="w-full justify-start"
                data-testid="button-modal-upload-folder"
              >
                <FolderUp className="w-4 h-4 mr-2" />
                Upload Folder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleEvidencePicker}
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
              {SEVERITY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSeverityChange(level)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${severity === level
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
          <Button onClick={onSave} className="w-full" disabled={uploadPending}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

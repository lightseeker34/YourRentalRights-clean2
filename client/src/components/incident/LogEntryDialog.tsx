import { RefObject } from "react";
import { AlertTriangle, FolderOpen, FolderUp, Info, Minus, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SEVERITY_BY_TYPE, SEVERITY_LEVELS, SeverityLevel } from "@shared/schema";

type EvidencePhoto = {
  id: number;
  fileUrl: string;
};

type LogEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: string;
  titlePlaceholder: string;
  notesPlaceholder: string;
  saveLabel: string;
  title: string;
  notes: string;
  files: File[];
  severity: SeverityLevel;
  showEvidencePicker: boolean;
  photoInputRef: RefObject<HTMLInputElement | null>;
  folderInputId: string;
  disabled?: boolean;
  evidencePhotos: EvidencePhoto[];
  onTitleChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSeverityChange: (value: SeverityLevel) => void;
  onFileAdd: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onToggleEvidencePicker: () => void;
  onPickEvidence: (fileUrl: string, id: number) => void | Promise<void>;
  onSave: () => void;
  onReset: () => void;
  severityTestIdPrefix: string;
  uploadFileTestId: string;
  uploadFolderTestId: string;
  pickEvidenceTestId: string;
  evidencePickerTestIdPrefix: string;
  removeFileTestIdPrefix?: string;
};

export function LogEntryDialog({
  open,
  onOpenChange,
  type,
  titlePlaceholder,
  notesPlaceholder,
  saveLabel,
  title,
  notes,
  files,
  severity,
  showEvidencePicker,
  photoInputRef,
  folderInputId,
  disabled,
  evidencePhotos,
  onTitleChange,
  onNotesChange,
  onSeverityChange,
  onFileAdd,
  onRemoveFile,
  onToggleEvidencePicker,
  onPickEvidence,
  onSave,
  onReset,
  severityTestIdPrefix,
  uploadFileTestId,
  uploadFolderTestId,
  pickEvidenceTestId,
  evidencePickerTestIdPrefix,
  removeFileTestIdPrefix = "remove-log-file",
}: LogEntryDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (nextOpen) {
          onSeverityChange(DEFAULT_SEVERITY_BY_TYPE[type] || "routine");
          return;
        }
        onReset();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="w-[90%] rounded-xl sm:max-w-[425px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] transition-transform duration-200 pt-[35px] pb-[35px]"
      >
        <div className="space-y-4 pt-[8px] pb-[8px]">
          <div className="space-y-2">
            <Input
              placeholder={titlePlaceholder}
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="mt-[6px] mb-[6px] placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder={notesPlaceholder}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="min-h-[140px] mt-[5px] mb-[5px] placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="relative group">
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt="" className="w-12 h-12 object-cover rounded border border-slate-200" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center rounded border border-slate-200 bg-slate-50">
                        <Paperclip className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveFile(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      data-testid={`${removeFileTestIdPrefix}-${idx}`}
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
                ref={photoInputRef}
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                onChange={onFileAdd}
                className="hidden"
              />
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                multiple
                onChange={onFileAdd}
                className="hidden"
                id={folderInputId}
                {...({ webkitdirectory: "", directory: "" } as any)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                className="w-full justify-start"
                data-testid={uploadFileTestId}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                Upload File
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(folderInputId)?.click()}
                className="w-full justify-start"
                data-testid={uploadFolderTestId}
              >
                <FolderUp className="w-4 h-4 mr-2" />
                Upload Folder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleEvidencePicker}
                className="w-full justify-start"
                data-testid={pickEvidenceTestId}
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
                      onClick={() => onPickEvidence(photo.fileUrl, photo.id)}
                      className="relative"
                      data-testid={`${evidencePickerTestIdPrefix}-${photo.id}`}
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
                    ? level === "critical" ? "bg-red-100 border-red-300 text-red-700"
                      : level === "important" ? "bg-amber-100 border-amber-300 text-amber-700"
                      : "bg-slate-100 border-slate-300 text-slate-600"
                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"}`}
                  data-testid={`${severityTestIdPrefix}-${level}`}
                >
                  {level === "critical" ? <AlertTriangle className="w-3 h-3" /> : level === "important" ? <Info className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={onSave} className="w-full" disabled={disabled}>
            {saveLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

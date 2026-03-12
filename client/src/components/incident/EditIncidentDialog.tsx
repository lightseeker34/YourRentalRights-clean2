import { Image as ImageIcon, FolderUp, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThumbnailWithDelete } from "@/components/incident/ThumbnailWithDelete";

type EditIncidentFile = {
  id: number;
  content: string;
  fileUrl: string;
};

type EditIncidentDialogProps = {
  open: boolean;
  title: string;
  description: string;
  photos: EditIncidentFile[];
  docs: EditIncidentFile[];
  uploadPending?: boolean;
  savePending?: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onDeleteFile: (id: number) => void;
  onPreviewFile: (file: EditIncidentFile) => void;
  onSave: () => void;
};

export function EditIncidentDialog({
  open,
  title,
  description,
  photos,
  docs,
  uploadPending,
  savePending,
  onOpenChange,
  onTitleChange,
  onDescriptionChange,
  onUploadFile,
  onUploadFolder,
  onDeleteFile,
  onPreviewFile,
  onSave,
}: EditIncidentDialogProps) {
  const hasFiles = photos.length > 0 || docs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="w-[90%] rounded-xl sm:max-w-[425px] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] transition-transform duration-200 pt-[35px] pb-[35px]">
        <div className="space-y-4 pt-[8px] pb-[8px]">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="mt-[6px] mb-[6px] placeholder:text-slate-400"
          />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-[140px] mt-[5px] mb-[5px] placeholder:text-slate-400"
          />
          {hasFiles && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">Attached Files</div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo) => (
                  <ThumbnailWithDelete
                    key={photo.id}
                    onDelete={() => onDeleteFile(photo.id)}
                    onPreview={() => onPreviewFile(photo)}
                    className="w-14 h-14 overflow-hidden cursor-pointer rounded-lg"
                  >
                    <div
                      className="w-full h-full relative group overflow-hidden rounded-lg border border-slate-200"
                      data-testid={`edit-dialog-photo-${photo.id}`}
                    >
                      <img
                        src={photo.fileUrl}
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
                {docs.map((doc) => (
                  <ThumbnailWithDelete
                    key={doc.id}
                    onDelete={() => onDeleteFile(doc.id)}
                    onPreview={() => onPreviewFile(doc)}
                    className="w-14 h-14 overflow-hidden cursor-pointer rounded-lg"
                  >
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
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadFile}
              className="w-full justify-start"
              disabled={uploadPending}
              data-testid="button-edit-incident-upload-file"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Upload File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadFolder}
              className="w-full justify-start"
              disabled={uploadPending}
              data-testid="button-edit-incident-upload-folder"
            >
              <FolderUp className="w-4 h-4 mr-2" />
              Upload Folder
            </Button>
          </div>
          <Button onClick={onSave} className="w-full" disabled={savePending}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

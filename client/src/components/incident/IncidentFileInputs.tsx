import { RefObject } from "react";

type IncidentFileInputsProps = {
  photoInputRef: RefObject<HTMLInputElement | null>;
  docInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  generalFileInputRef: RefObject<HTMLInputElement | null>;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDocUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function IncidentFileInputs({
  photoInputRef,
  docInputRef,
  folderInputRef,
  generalFileInputRef,
  onPhotoUpload,
  onDocUpload,
}: IncidentFileInputsProps) {
  return (
    <>
      <input
        type="file"
        ref={photoInputRef}
        onChange={onPhotoUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={onDocUpload}
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          Array.from(files).forEach((file) => {
            if (file.type.startsWith('image/')) {
              onPhotoUpload({ target: { files: [file] } } as any);
            } else {
              onDocUpload({ target: { files: [file] } } as any);
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
            onPhotoUpload(e);
          } else {
            onDocUpload(e);
          }
          e.target.value = '';
        }}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
    </>
  );
}

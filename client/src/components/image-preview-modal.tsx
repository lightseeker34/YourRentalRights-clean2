import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, X } from "lucide-react";
import type { ReactNode } from "react";

type ImagePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewType: "image" | "document";
  previewUrl: string | null;
  previewName: string;
  renderImage: () => ReactNode;
};

export function ImagePreviewModal({
  open,
  onOpenChange,
  previewType,
  previewUrl,
  previewName,
  renderImage,
}: ImagePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        hideCloseButton={previewType === 'image'}
        className={previewType === 'image' ? "w-screen max-w-none h-screen max-h-screen rounded-none border-0 bg-transparent shadow-none p-0" : "w-[90vw] max-w-3xl max-h-[90vh] rounded-2xl mx-auto p-0 overflow-hidden"}
      >
        {previewType !== 'image' && (
          <div className="border-b border-slate-200 px-5 pt-5 pb-4 pr-14">
            <DialogTitle className="text-base leading-snug text-slate-900 break-words">{previewName}</DialogTitle>
            <DialogDescription className="sr-only">Preview uploaded evidence file.</DialogDescription>
          </div>
        )}

        <div className={previewType === 'image' ? "relative flex items-center justify-center w-full h-full overflow-auto bg-black/95" : "flex items-center justify-center p-5 w-full max-h-[75vh] overflow-auto"}>
          {previewType === 'image' ? (
            <>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close preview"
                  className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border-0 outline-none ring-0 shadow-none bg-black/35 text-white opacity-85 transition-opacity hover:opacity-100 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
                >
                  <X className="h-4 w-4 stroke-[2.75]" />
                </button>
              </DialogClose>
              <div className="flex items-center justify-center w-full h-full">
                {renderImage()}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Paperclip className="w-16 h-16 text-slate-400" />
              <a
                href={previewUrl || ''}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open Document
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

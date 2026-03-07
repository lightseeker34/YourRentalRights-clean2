import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
        className={previewType === 'image' ? "w-[98vw] max-w-none h-[96vh] max-h-[96vh] rounded-xl mx-auto p-1" : "w-[90vw] max-w-3xl max-h-[90vh] rounded-xl mx-auto [&>button]:top-8 [&>button]:right-4"}
      >
        {previewType !== 'image' && (
          <DialogHeader>
            <DialogTitle className="pt-[10px] pb-[10px]">{previewName}</DialogTitle>
            <DialogDescription className="sr-only">Preview uploaded evidence file.</DialogDescription>
          </DialogHeader>
        )}

        <div className={previewType === 'image' ? "relative flex items-center justify-center px-1 py-1 w-full h-full overflow-auto" : "flex items-center justify-center p-4 w-full max-h-[75vh] overflow-auto"}>
          {previewType === 'image' ? (
            <>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close preview"
                  className="absolute right-4 top-4 z-10 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-3 w-3" />
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

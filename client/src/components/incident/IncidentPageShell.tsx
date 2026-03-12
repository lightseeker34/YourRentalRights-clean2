import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

type IncidentPageShellProps = {
  mobileDrawerOpen: boolean;
  onBack: () => void;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  mobileSidebar: ReactNode;
  desktopSidebar: ReactNode;
};

export function IncidentPageShell({
  mobileDrawerOpen,
  onBack,
  onOpenDrawer,
  onCloseDrawer,
  mobileSidebar,
  desktopSidebar,
}: IncidentPageShellProps) {
  return (
    <>
      <div className="fixed top-3 left-3 z-30 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm rounded-xl w-10 h-10 hover:bg-white"
          onClick={onBack}
          aria-label="Go back"
          data-testid="button-back"
        >
          <ArrowLeft className="w-6 h-6 stroke-[2.5] text-slate-700" />
        </Button>
      </div>

      <div className="hidden md:block fixed top-3 right-3 z-30">
        <Button
          variant="ghost"
          className="bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm rounded-xl h-10 px-3 hover:bg-white"
          onClick={onBack}
          aria-label="Back to dashboard"
          data-testid="button-back-desktop"
        >
          <ArrowLeft className="w-4 h-4 mr-2 text-slate-700" />
          <span className="text-sm text-slate-700">Back</span>
        </Button>
      </div>

      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onCloseDrawer}
        />
      )}

      <div className={`fixed top-0 left-0 h-[100dvh] w-80 bg-white z-50 transform transition-transform duration-300 ease-out md:hidden flex flex-col shadow-xl rounded-r-xl ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide pb-32">
          {mobileSidebar}
        </div>
      </div>

      <div
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 md:hidden bg-white border border-slate-300 w-3 h-[22.5rem] rounded-r-lg shadow-md cursor-pointer"
        onClick={onOpenDrawer}
        aria-label="Open incident panel"
      />

      <div className="w-96 border-r border-slate-200 bg-white p-6 hidden md:block overflow-y-auto pl-[20px] pr-[20px]">
        {desktopSidebar}
      </div>
    </>
  );
}

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
          className="w-10 h-10 rounded-xl border-0 shadow-none bg-slate-50 text-slate-700 hover:bg-slate-50"
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
          className="h-10 px-3 rounded-xl border-0 shadow-none bg-slate-50 text-slate-700 hover:bg-slate-50"
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

      <button
        type="button"
        className="fixed left-0 top-1/2 -translate-y-1/2 z-30 md:hidden flex h-[22.5rem] w-8 items-center justify-start bg-transparent cursor-pointer"
        onClick={onOpenDrawer}
        aria-label="Open incident panel"
      >
        <span className="pointer-events-none block h-full w-3 rounded-r-lg border border-slate-300 bg-white shadow-md" />
      </button>

      <div className="w-96 border-r border-slate-200 bg-white p-6 hidden md:block overflow-y-auto pl-[20px] pr-[20px]">
        {desktopSidebar}
      </div>
    </>
  );
}

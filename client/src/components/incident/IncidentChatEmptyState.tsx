export function IncidentChatEmptyState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[280px] bg-gradient-to-b from-slate-50 to-slate-100/50 overflow-hidden mt-16 md:mt-6 mb-6" data-testid="chat-empty-state">
      <div className="flex flex-col items-center select-none w-full max-w-[calc(100vw-2rem)] px-2 overflow-hidden" data-testid="ai-assistant-placeholder">
        <div className="bg-white/90 border border-slate-200/60 rounded-3xl px-8 py-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-full overflow-hidden flex flex-col items-center">
          <span className="block text-7xl font-light text-slate-300 leading-[0.8] text-center tracking-tighter">Your</span>
          <span className="block text-7xl font-light text-slate-300 leading-[0.8] text-center tracking-tighter mt-[9px] mb-[9px]">Assistant</span>
        </div>
        <div className="mt-6 w-full max-w-[340px]">
          <div className="bg-white/70 border border-slate-200/50 rounded-2xl px-6 py-4 shadow-[0_4px_15px_rgb(0,0,0,0.02)] pt-[1px] pb-[1px]">
            <span className="text-slate-400 font-light text-[18px] text-center block leading-relaxed">Ask a question about your case to get started.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

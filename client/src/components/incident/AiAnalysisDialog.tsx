import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Violation = {
  code: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
};

type AnalysisResult = {
  summary: string;
  evidenceScore: number;
  recommendation: 'strong' | 'moderate' | 'weak';
  violations?: Violation[];
  timelineAnalysis?: string;
  strengthFactors?: string[];
  weaknessFactors?: string[];
  nextSteps?: string[];
};

type AiAnalysisDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisResult: AnalysisResult | null;
  isSavingAnalysisPdf?: boolean;
  onSavePdf: () => void;
  onDownloadPdf: () => void;
};

export function AiAnalysisDialog({
  open,
  onOpenChange,
  analysisResult,
  isSavingAnalysisPdf,
  onSavePdf,
  onDownloadPdf,
}: AiAnalysisDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-200">
                <Bot className="w-5 h-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg text-slate-900">AI Analysis</DialogTitle>
                <p className="mt-1 text-sm text-slate-500">Review the analysis, then save it to your timeline or download a PDF copy.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:max-w-[220px] sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSavePdf}
                disabled={!analysisResult || isSavingAnalysisPdf}
                data-testid="button-save-analysis-pdf"
                className="w-full justify-center"
              >
                {isSavingAnalysisPdf ? 'Saving...' : 'Save to Timeline'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDownloadPdf}
                disabled={!analysisResult}
                data-testid="button-download-analysis-pdf"
                className="w-full justify-center"
              >
                Download PDF
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">AI summary and recommendations for this incident.</DialogDescription>
        </DialogHeader>
        {analysisResult && (
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
              <p className="text-slate-600 text-sm">{analysisResult.summary}</p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-1">Evidence Score</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">{analysisResult.evidenceScore}</span>
                  <span className="text-slate-400">/10</span>
                </div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-medium text-slate-500 mb-1">Recommendation</div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  analysisResult.recommendation === 'strong'
                    ? 'bg-green-100 text-green-700'
                    : analysisResult.recommendation === 'moderate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                }`}>
                  {analysisResult.recommendation === 'strong'
                    ? 'Strong Case'
                    : analysisResult.recommendation === 'moderate'
                      ? 'Moderate Case'
                      : 'Weak Case'}
                </span>
              </div>
            </div>

            {analysisResult.violations && analysisResult.violations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Potential Violations</h3>
                <div className="space-y-2">
                  {analysisResult.violations.map((v, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <span className="font-mono text-xs text-blue-600">{v.code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          v.severity === 'high'
                            ? 'bg-red-100 text-red-600'
                            : v.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.severity}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{v.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysisResult.timelineAnalysis && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Timeline Analysis</h3>
                <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{analysisResult.timelineAnalysis}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {analysisResult.strengthFactors && analysisResult.strengthFactors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-2">Strengths</h3>
                  <ul className="space-y-1">
                    {analysisResult.strengthFactors.map((f, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">+</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysisResult.weaknessFactors && analysisResult.weaknessFactors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">Weaknesses</h3>
                  <ul className="space-y-1">
                    {analysisResult.weaknessFactors.map((f, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                        <span className="text-red-500 mt-0.5">-</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {analysisResult.nextSteps && analysisResult.nextSteps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Recommended Next Steps</h3>
                <ol className="space-y-2">
                  {analysisResult.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="text-xs text-slate-400 pt-4 border-t">
              This analysis is for informational purposes only and does not constitute legal advice.
              Consult with a qualified attorney for specific legal guidance.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

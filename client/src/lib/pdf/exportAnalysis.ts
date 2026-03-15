import jsPDF from "jspdf";
import { format } from "date-fns";
import { Incident } from "@shared/schema";
import { QueryClient } from "@tanstack/react-query";
export type AppToast = (...args: any[]) => unknown;

export interface AnalysisResult {
  summary: string;
  evidenceScore: number;
  recommendation: 'strong' | 'moderate' | 'weak';
  violations: { code: string; description: string; severity: 'high' | 'medium' | 'low' }[];
  timelineAnalysis: string;
  nextSteps: string[];
  strengthFactors?: string[];
  weaknessFactors?: string[];
}

export interface SaveAnalysisPdfParams {
  incident: Incident;
  analysisResult: AnalysisResult;
  id: string;
  setIsSavingAnalysisPdf: (v: boolean) => void;
  toast: AppToast;
  queryClient: QueryClient;
}

function buildAnalysisPdf(incident: Incident, analysisResult: AnalysisResult) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed = 12) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const addHeading = (text: string) => {
    ensureSpace(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(text, margin, y);
    y += 6;
  };

  const addBody = (text: string) => {
    const safe = (text || '').replace(/\s+/g, ' ').trim();
    if (!safe) return;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85);
    const lines = pdf.splitTextToSize(safe, contentWidth);
    ensureSpace(lines.length * 5 + 2);
    pdf.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text('AI Case Analysis', margin, y);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Incident: ${incident.title}`, margin, y);
  y += 5;
  pdf.text(`Generated: ${format(new Date(), "MMMM d, yyyy h:mm a")}`, margin, y);
  y += 8;

  addHeading('Summary');
  addBody(analysisResult.summary || 'N/A');

  addHeading('Assessment');
  addBody(`Evidence Score: ${analysisResult.evidenceScore}/10`);
  addBody(`Recommendation: ${analysisResult.recommendation}`);

  if (analysisResult.violations?.length) {
    addHeading('Potential Violations');
    analysisResult.violations.forEach((v, i) => addBody(`${i + 1}. ${v.code}: ${v.description} (${v.severity})`));
  }

  if (analysisResult.timelineAnalysis) {
    addHeading('Timeline Analysis');
    addBody(analysisResult.timelineAnalysis);
  }

  if (analysisResult.strengthFactors?.length) {
    addHeading('Strength Factors');
    analysisResult.strengthFactors.forEach((f, i) => addBody(`${i + 1}. ${f}`));
  }

  if (analysisResult.weaknessFactors?.length) {
    addHeading('Weakness Factors');
    analysisResult.weaknessFactors.forEach((f, i) => addBody(`${i + 1}. ${f}`));
  }

  if (analysisResult.nextSteps?.length) {
    addHeading('Next Steps');
    analysisResult.nextSteps.forEach((step, i) => addBody(`${i + 1}. ${step}`));
  }

  ensureSpace(14);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  addBody('This analysis is for informational purposes only and does not constitute legal advice.');

  const generatedAt = format(new Date(), 'MMM d, yyyy h-mm a');
  const fileName = `AI Analysis - ${incident.title} - ${generatedAt}.pdf`
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    blob: pdf.output('blob'),
    fileName,
  };
}

export function downloadAnalysisPdf({
  incident,
  analysisResult,
}: Pick<SaveAnalysisPdfParams, 'incident' | 'analysisResult'>): void {
  if (!incident || !analysisResult) return;
  const { blob, fileName } = buildAnalysisPdf(incident, analysisResult);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveAnalysisAsPdfToIncident({
  incident,
  analysisResult,
  id,
  setIsSavingAnalysisPdf,
  toast,
  queryClient,
}: SaveAnalysisPdfParams): Promise<void> {
  if (!incident || !analysisResult || !id) return;

  setIsSavingAnalysisPdf(true);
  try {
    const { blob, fileName } = buildAnalysisPdf(incident, analysisResult);
    const file = new File([blob], fileName, { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/incidents/${id}/upload?category=analysis_pdf`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to save analysis PDF');

    queryClient.invalidateQueries({ queryKey: [`/api/incidents/${id}/logs`] });
    toast({
      title: 'Analysis PDF Saved',
      description: 'Saved under this incident’s Files section.',
    });
  } catch (error: any) {
    toast({
      title: 'Save Failed',
      description: error?.message || 'Could not save analysis PDF.',
      variant: 'destructive',
    });
  } finally {
    setIsSavingAnalysisPdf(false);
  }
}

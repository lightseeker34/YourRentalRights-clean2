import jsPDF from "jspdf";
import { format } from "date-fns";
import { Incident, IncidentLog } from "@shared/schema";
import type { AppToast } from "./exportAnalysis";

export interface ExportIncidentParams {
  incident: Incident;
  logs: IncidentLog[];
  setIsExporting: (v: boolean) => void;
  setHasExportedPdf: (v: boolean) => void;
  toast: AppToast;
  trackPdfExport: () => Promise<void>;
}

export async function exportToPDF({
  incident,
  logs,
  setIsExporting,
  setHasExportedPdf,
  toast,
  trackPdfExport,
}: ExportIncidentParams): Promise<void> {
  if (!incident || !logs) return;

  setIsExporting(true);
  try {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
    };

    const cleanText = (text: string): string => {
      let cleaned = text;
      cleaned = cleaned.replace(/&amp;/g, '&');
      cleaned = cleaned.replace(/&lt;/g, '<');
      cleaned = cleaned.replace(/&gt;/g, '>');
      cleaned = cleaned.replace(/&nbsp;/g, ' ');
      cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      });
      try {
        const emojiReplacements: [RegExp, string][] = [
          [/📞/g, '[Call]'],
          [/💬/g, '[Message]'],
          [/📧/g, '[Email]'],
          [/📷/g, '[Photo]'],
          [/🤖/g, '[AI]'],
          [/👤/g, '[User]'],
          [/🚀/g, ''],
          [/✅/g, '[OK]'],
          [/❌/g, '[X]'],
          [/⚠️/g, '[!]'],
          [/📋/g, '[List]'],
          [/📁/g, '[Folder]'],
          [/📄/g, '[Doc]'],
          [/🔗/g, '[Link]'],
          [/✓/g, '[OK]'],
          [/✔/g, '[OK]'],
          [/😊/g, ':)'],
        ];
        for (const [emoji, replacement] of emojiReplacements) {
          cleaned = cleaned.replace(emoji, replacement);
        }
      } catch {
        // If regex fails, continue with text as-is
      }
      return cleaned.trim();
    };

    const renderTable = (tableText: string): void => {
      const lines = tableText.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const parseRow = (row: string): string[] => {
        return row.split('|').map(cell => cleanText(cell.trim())).filter(cell => cell);
      };

      const headers = parseRow(lines[0]);
      const dataRows = lines.slice(2).map(parseRow);

      if (headers.length === 0) return;

      pdf.setFontSize(8);
      const maxColCount = Math.min(headers.length, 4);
      const colWidth = contentWidth / maxColCount;
      const cellPadding = 2;
      const rowHeight = 6;
      const maxChars = Math.floor((colWidth - cellPadding * 2) / 2);

      checkPageBreak(rowHeight * 2 + 5);

      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, yPos - 3, contentWidth, rowHeight, 'F');
      pdf.setDrawColor(180, 180, 180);
      pdf.line(margin, yPos - 3, margin + contentWidth, yPos - 3);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);

      headers.slice(0, maxColCount).forEach((header, i) => {
        const cellX = margin + (i * colWidth) + cellPadding;
        const truncated = header.length > maxChars ? header.substring(0, maxChars - 2) + '..' : header;
        pdf.text(truncated, cellX, yPos);
      });
      yPos += rowHeight;

      pdf.line(margin, yPos - 3, margin + contentWidth, yPos - 3);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      for (const row of dataRows) {
        checkPageBreak(rowHeight + 2);
        row.slice(0, maxColCount).forEach((cell, i) => {
          const cellX = margin + (i * colWidth) + cellPadding;
          const truncated = cell.length > maxChars ? cell.substring(0, maxChars - 2) + '..' : cell;
          pdf.text(truncated, cellX, yPos);
        });
        yPos += rowHeight;
      }

      pdf.line(margin, yPos - 3, margin + contentWidth, yPos - 3);
      yPos += 2;
    };

    const renderMarkdown = (content: string): void => {
      const lines = content.split('\n');
      let inTable = false;
      let tableBuffer: string[] = [];
      let inCodeBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          if (!inTable && !inCodeBlock) {
            yPos += 2;
          }
          continue;
        }

        if (trimmedLine.startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          if (!inCodeBlock) {
            yPos += 2;
          }
          continue;
        }

        if (inCodeBlock) {
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(8);
          const codeLines = pdf.splitTextToSize(cleanText(trimmedLine), contentWidth - 10);
          const blockHeight = codeLines.length * 4 + 2;

          checkPageBreak(blockHeight);

          pdf.setFillColor(245, 245, 245);
          pdf.rect(margin, yPos - 3, contentWidth, blockHeight, 'F');
          pdf.setTextColor(60, 60, 60);
          pdf.text(codeLines, margin + 3, yPos);
          pdf.setTextColor(0, 0, 0);
          yPos += blockHeight;
          continue;
        }

        if (trimmedLine.includes('|') && (trimmedLine.startsWith('|') || trimmedLine.match(/^\|?[\w\s-]+\|/))) {
          inTable = true;
          tableBuffer.push(trimmedLine);
          const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
          if (!nextLine.includes('|')) {
            renderTable(tableBuffer.join('\n'));
            tableBuffer = [];
            inTable = false;
            yPos += 3;
          }
          continue;
        }

        if (trimmedLine.startsWith('###')) {
          checkPageBreak(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          const headerText = cleanText(trimmedLine.replace(/^###\s*/, ''));
          pdf.text(headerText, margin, yPos);
          yPos += 6;
          continue;
        }

        if (trimmedLine.startsWith('##')) {
          checkPageBreak(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          const headerText = cleanText(trimmedLine.replace(/^##\s*/, ''));
          pdf.text(headerText, margin, yPos);
          yPos += 7;
          continue;
        }

        if (trimmedLine.startsWith('#')) {
          checkPageBreak(14);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(14);
          const headerText = cleanText(trimmedLine.replace(/^#\s*/, ''));
          pdf.text(headerText, margin, yPos);
          yPos += 8;
          continue;
        }

        if (trimmedLine.match(/^[-*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
          checkPageBreak(6);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          const bulletText = cleanText(trimmedLine.replace(/^[-*]\s/, '• ').replace(/^\d+\.\s/, (m) => m));
          const bulletLines = pdf.splitTextToSize(bulletText, contentWidth - 5);
          pdf.text(bulletLines, margin + 3, yPos);
          yPos += bulletLines.length * 4 + 1;
          continue;
        }

        let processedLine = cleanText(trimmedLine);
        const hasBold = processedLine.includes('**');

        if (hasBold) {
          checkPageBreak(8);
          const textWithoutBold = processedLine.replace(/\*\*([^*]+)\*\*/g, '$1');
          const isMostlyBold = trimmedLine.startsWith('**') && trimmedLine.includes('**:');

          if (isMostlyBold) {
            pdf.setFont('helvetica', 'bold');
          } else {
            pdf.setFont('helvetica', 'normal');
          }
          pdf.setFontSize(9);
          const wrappedBold = pdf.splitTextToSize(textWithoutBold, contentWidth);
          pdf.text(wrappedBold, margin, yPos);
          yPos += wrappedBold.length * 4 + 2;
          continue;
        }

        checkPageBreak(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const wrappedLines = pdf.splitTextToSize(processedLine, contentWidth);
        pdf.text(wrappedLines, margin, yPos);
        yPos += wrappedLines.length * 4 + 1;
      }
    };

    const getFetchableImageUrl = (log: IncidentLog): string | null => {
      const meta = log.metadata && typeof log.metadata === 'object' ? (log.metadata as any) : null;
      const r2Key = meta?.r2Key as string | undefined;
      if (r2Key) return `/api/r2/${encodeURIComponent(r2Key)}`;
      return log.fileUrl || null;
    };

    const loadImageAsBase64 = async (url: string): Promise<string | null> => {
      try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const getPdfImageFormat = (dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' => {
      if (dataUrl.startsWith('data:image/png')) return 'PNG';
      if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
      return 'JPEG';
    };

    // Title
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('CASE REPORT', margin, yPos);
    yPos += 12;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    const titleLines = pdf.splitTextToSize(incident.title, contentWidth);
    pdf.text(titleLines, margin, yPos);
    yPos += titleLines.length * 6 + 5;

    pdf.setFontSize(10);
    const statusColor = incident.status === 'open' ? [34, 197, 94] : [100, 116, 139];
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.roundedRect(margin, yPos - 4, 25, 7, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(incident.status.toUpperCase(), margin + 3, yPos);

    pdf.setTextColor(100, 116, 139);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Created: ${format(new Date(incident.createdAt), "MMMM d, yyyy 'at' h:mm a")}`, margin + 30, yPos);
    yPos += 10;

    if (incident.description) {
      checkPageBreak(20);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('INCIDENT SUMMARY', margin, yPos);
      yPos += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const descLines = pdf.splitTextToSize(cleanText(incident.description), contentWidth);
      pdf.text(descLines, margin, yPos);
      yPos += descLines.length * 4 + 8;
    }

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    const renderPhotoGrid = async (photos: IncidentLog[], leftIndent = 0, showCaption = false) => {
      const unique = photos.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);
      const cellWidth = 82;
      const cellHeight = showCaption ? 62 : 58;
      const gap = 8;
      const captionHeight = showCaption ? 6 : 0;
      let col = 0;

      for (const photo of unique) {
        const photoUrl = getFetchableImageUrl(photo);
        if (!photoUrl) continue;
        const imgData = await loadImageAsBase64(photoUrl);
        if (!imgData) continue;

        const x = margin + leftIndent + (col === 0 ? 0 : cellWidth + gap);
        checkPageBreak(cellHeight + captionHeight + 6);
        try {
          pdf.addImage(imgData, getPdfImageFormat(imgData), x, yPos, cellWidth, cellHeight);
        } catch {
          pdf.setFontSize(9);
          pdf.setTextColor(150, 150, 150);
          pdf.text('[Image could not be embedded]', x, yPos + 6);
        }

        if (showCaption) {
          const caption = (photo.content || 'Photo').slice(0, 40);
          pdf.setFontSize(7);
          pdf.setTextColor(90, 90, 90);
          pdf.text(caption, x, yPos + cellHeight + 4);
        }

        if (col === 0) {
          col = 1;
        } else {
          col = 0;
          yPos += cellHeight + captionHeight + 6;
        }
      }

      if (col === 1) {
        yPos += cellHeight + captionHeight + 6;
      }
    };

    const incidentPhotos = logs
      .filter(p => {
        if (p.type !== 'photo') return false;
        const meta = p.metadata && typeof p.metadata === 'object' ? (p.metadata as any) : null;
        const category = meta?.category;
        const parentLogId = meta?.parentLogId;
        if (category === 'incident_photo') return true;
        if (parentLogId) return false;
        if (category && category !== 'incident_photo') return false;
        // Allow legacy uncategorized standalone photos to remain in the main incident section
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (incidentPhotos.length > 0) {
      checkPageBreak(30);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('CASE EVIDENCE PHOTOS', margin, yPos);
      yPos += 6;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(90, 90, 90);
      pdf.text('Primary incident evidence photos (chronological).', margin, yPos);
      yPos += 6;
      await renderPhotoGrid(incidentPhotos, 0, true);
      yPos += 8;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
    }

    const evidenceLogs = logs.filter(l =>
      l.type === 'call' || l.type === 'text' || l.type === 'email' || l.type === 'service' || l.type === 'portal' || l.type === 'custom' || l.type === 'note'
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (evidenceLogs.length > 0) {
      checkPageBreak(15);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('EVIDENCE TIMELINE', margin, yPos);
      yPos += 10;
      pdf.setTextColor(0, 0, 0);

      for (const log of evidenceLogs) {
        checkPageBreak(36);

        const typeLabel = log.type === 'call' ? '[CALL]' :
                         log.type === 'text' ? '[TEXT]' :
                         log.type === 'email' ? '[EMAIL]' :
                         log.type === 'service' ? '[SERVICE]' :
                         log.type === 'portal' ? '[PORTAL]' :
                         log.type === 'custom' ? '[CUSTOM]' : '[NOTE]';

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(59, 130, 246);
        pdf.text(typeLabel, margin, yPos);

        if (log.title) {
          pdf.setTextColor(0, 0, 0);
          pdf.text(` ${log.title}`, margin + pdf.getTextWidth(typeLabel) + 2, yPos);
        }
        yPos += 5;

        const meta = log.metadata && typeof log.metadata === 'object' ? (log.metadata as any) : null;
        const severity = meta?.severity ? String(meta.severity) : 'Routine';
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(120, 130, 140);
        const metaLine = `Logged: ${format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")} • Severity: ${severity}`;
        const metaLines = pdf.splitTextToSize(metaLine, contentWidth);
        checkPageBreak(metaLines.length * 4 + 4);
        pdf.text(metaLines, margin, yPos);
        yPos += metaLines.length * 4 + 2;

        if (log.content) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          const contentLines = pdf.splitTextToSize(cleanText(log.content), contentWidth);
          checkPageBreak(contentLines.length * 4 + 4);
          pdf.text(contentLines, margin, yPos);
          yPos += contentLines.length * 4 + 3;
        }

        const logCategory = `${log.type}_photo`;
        const attachedPhotos = logs.filter(p => {
          if (p.type !== 'photo') return false;
          const pMeta = p.metadata && typeof p.metadata === 'object' ? (p.metadata as any) : null;
          const parentMatch = pMeta?.parentLogId === log.id;
          const categoryMatch = pMeta?.category === logCategory;
          return parentMatch || categoryMatch;
        });

        if (attachedPhotos.length > 0) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(100, 116, 139);
          pdf.text('Attached photo(s):', margin, yPos);
          yPos += 4;
          await renderPhotoGrid(attachedPhotos, 6, true);
        }

        yPos += 4;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;
      }
    }

    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${i} of ${pageCount}  |  Generated by YourRentalRights.com  |  ${format(new Date(), 'MMMM d, yyyy')}`,
        margin,
        pageHeight - 10
      );
    }

    const filename = `case-report-${incident.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(filename);

    await trackPdfExport();
    setHasExportedPdf(true);

    toast({
      title: "PDF Exported",
      description: "Your case report has been downloaded. You can now run AI analysis.",
    });
  } catch (error) {
    console.error('PDF export error:', error);
    toast({
      title: "Export Failed",
      description: "There was an error generating the PDF. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsExporting(false);
  }
}
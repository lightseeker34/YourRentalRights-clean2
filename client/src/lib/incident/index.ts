import { IncidentLog } from "@shared/schema";

export const getMetaCategory = (log: IncidentLog): string | undefined =>
  (log.metadata as any)?.category;

export const isAnalysisPdf = (log: IncidentLog): boolean =>
  getMetaCategory(log) === "analysis_pdf";

export const getAttachedPhotos = (log: IncidentLog, logs: IncidentLog[]): IncidentLog[] => {
  if (log.type !== 'call' && log.type !== 'text' && log.type !== 'email' && log.type !== 'photo' && log.type !== 'service' && log.type !== 'portal' && log.type !== 'custom') return [];
  return logs.filter(l => {
    const parentLogId = (l.metadata as any)?.parentLogId;
    return l.type === 'photo' && parentLogId === log.id;
  });
};

export const getAttachedDocuments = (log: IncidentLog, logs: IncidentLog[]): IncidentLog[] => {
  if (log.type !== 'call' && log.type !== 'text' && log.type !== 'email' && log.type !== 'service' && log.type !== 'portal' && log.type !== 'custom') return [];
  return logs.filter(l => {
    const parentLogId = (l.metadata as any)?.parentLogId;
    return l.type === 'document' && parentLogId === log.id;
  });
};

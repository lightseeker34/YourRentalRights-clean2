import type { IncidentLog, User, Incident, SeverityLevel } from "@shared/schema";
import { getLogSeverity } from "@shared/schema";
import crypto from "crypto";

const LOG_TYPE_LABELS: Record<string, string> = {
  call: "CALL LOG",
  text: "TEXT MESSAGE",
  email: "EMAIL",
  photo: "PHOTO EVIDENCE",
  document: "DOCUMENT",
  note: "NOTE",
  service: "SERVICE REQUEST",
  portal: "PORTAL ENTRY",
  custom: "CUSTOM ENTRY",
};

const EVIDENCE_TYPES = ["call", "text", "email", "photo", "document", "note", "service", "portal", "custom"];

function formatLogDate(createdAt: Date | string): string {
  const d = new Date(createdAt);
  return d.toISOString().split("T")[0];
}

export interface StructuredTimelineEntry {
  id: number;
  date: string;
  type: string;
  severity: SeverityLevel;
  description: string;
  attachments: string[];
  hasFile: boolean;
}

function buildSingleEntry(log: IncidentLog): StructuredTimelineEntry {
  const attachmentIds: string[] = [];
  const meta = log.metadata as any;
  if (meta?.parentLogId) attachmentIds.push(`parent:${meta.parentLogId}`);
  if (meta?.photoCount && meta.photoCount > 0) attachmentIds.push(`photos:${meta.photoCount}`);
  if (meta?.documentCount && meta.documentCount > 0) attachmentIds.push(`docs:${meta.documentCount}`);

  return {
    id: log.id,
    date: formatLogDate(log.createdAt),
    type: log.type,
    severity: getLogSeverity(log),
    description: log.content,
    attachments: attachmentIds,
    hasFile: !!log.fileUrl,
  };
}

export function buildStructuredTimeline(logs: IncidentLog[]): StructuredTimelineEntry[] {
  const evidenceLogs = logs.filter((l) => EVIDENCE_TYPES.includes(l.type));
  return evidenceLogs.map(buildSingleEntry);
}

const RECENT_WINDOW_DAYS = 14;
const MAX_ROUTINE_ITEMS = 50;

export function assembleContextTwoPasses(
  logs: IncidentLog[],
  options?: { maxRoutine?: number; recentDays?: number; includeBackfill?: boolean }
): { critical: StructuredTimelineEntry[]; recent: StructuredTimelineEntry[]; backfill: StructuredTimelineEntry[]; included: StructuredTimelineEntry[] } {
  const maxRoutine = options?.maxRoutine ?? MAX_ROUTINE_ITEMS;
  const recentDays = options?.recentDays ?? RECENT_WINDOW_DAYS;
  const includeBackfill = options?.includeBackfill ?? false;

  const evidenceLogs = logs.filter((l) => EVIDENCE_TYPES.includes(l.type));
  const now = Date.now();
  const recentCutoff = now - recentDays * 24 * 60 * 60 * 1000;

  const criticalItems: StructuredTimelineEntry[] = [];
  const recentItems: StructuredTimelineEntry[] = [];
  const olderRoutineItems: StructuredTimelineEntry[] = [];

  for (const log of evidenceLogs) {
    const entry = buildSingleEntry(log);
    const entryTime = new Date(log.createdAt).getTime();
    const isRecent = entryTime >= recentCutoff;

    if (entry.severity === 'critical' || entry.severity === 'important') {
      criticalItems.push(entry);
    } else if (isRecent) {
      recentItems.push(entry);
    } else {
      olderRoutineItems.push(entry);
    }
  }

  const backfill = olderRoutineItems.slice(-maxRoutine);

  const included = [
    ...criticalItems,
    ...recentItems,
    ...(includeBackfill ? backfill : []),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  return { critical: criticalItems, recent: recentItems, backfill, included };
}

export function formatStructuredTimelineForPrompt(entries: StructuredTimelineEntry[]): string {
  if (entries.length === 0) return "No evidence logs recorded.";

  return entries
    .map((e) => {
      const severityTag = e.severity === 'critical' ? ' [CRITICAL]' : e.severity === 'important' ? ' [IMPORTANT]' : '';
      const attachTag = e.attachments.length > 0 ? ` (${e.attachments.join(', ')})` : '';
      return `[${e.date}] [ID:${e.id}]${severityTag} ${e.type.toUpperCase()}: ${e.description}${attachTag}`;
    })
    .join("\n");
}

export function formatEvidenceContext(logs: IncidentLog[]): string {
  const { included } = assembleContextTwoPasses(logs);
  return formatStructuredTimelineForPrompt(included);
}

export function formatEvidenceTimeline(logs: IncidentLog[]): { date: string; type: string; content: string; id: number; severity: SeverityLevel }[] {
  const { included } = assembleContextTwoPasses(logs);
  return included.map((e) => ({
    date: e.date,
    type: e.type,
    content: e.description,
    id: e.id,
    severity: e.severity,
  }));
}

export function formatPhotoList(logs: IncidentLog[]): { date: string; description: string; fileUrl: string | null; id: number; severity: SeverityLevel }[] {
  const photoLogs = logs.filter((l) =>
    ["photo", "call_photo", "text_photo", "email_photo", "chat_photo", "service_photo"].includes(l.type)
  );
  return photoLogs.map((log) => ({
    date: formatLogDate(log.createdAt),
    description: log.content,
    fileUrl: log.fileUrl,
    id: log.id,
    severity: getLogSeverity(log),
  }));
}

export function formatTimelineForPrompt(timeline: { date: string; type: string; content: string; id: number; severity?: SeverityLevel }[]): string {
  if (timeline.length === 0) return "No evidence logs recorded.";
  return timeline
    .map((e) => {
      const severityTag = e.severity === 'critical' ? ' [CRITICAL]' : e.severity === 'important' ? ' [IMPORTANT]' : '';
      return `[${e.date}] [ID:${e.id}]${severityTag} ${e.type.toUpperCase()}: ${e.content}`;
    })
    .join("\n");
}

export function formatPhotoListForPrompt(photos: { date: string; description: string; id: number; severity?: SeverityLevel }[]): string {
  if (photos.length === 0) return "No photos documented.";
  return photos
    .map((p) => {
      const severityTag = p.severity === 'critical' ? ' [CRITICAL]' : p.severity === 'important' ? ' [IMPORTANT]' : '';
      return `[${p.date}] [ID:${p.id}]${severityTag} ${p.description}`;
    })
    .join("\n");
}

export function buildUserContext(user: User): string {
  return [
    user.fullName && `Tenant Name: ${user.fullName}`,
    user.phone && `Phone: ${user.phone}`,
    user.email && `Email: ${user.email}`,
    user.address && `Property Address: ${user.address}`,
    user.unitNumber && `Unit: ${user.unitNumber}`,
    user.rentalAgency && `Property Management Company: ${user.rentalAgency}`,
    user.propertyManagerName && `Property Manager: ${user.propertyManagerName}`,
    user.propertyManagerPhone && `Property Manager Phone: ${user.propertyManagerPhone}`,
    user.propertyManagerEmail && `Property Manager Email: ${user.propertyManagerEmail}`,
    user.leaseStartDate && `Lease Start Date: ${user.leaseStartDate}`,
    user.monthlyRent && `Monthly Rent: ${user.monthlyRent}`,
    user.emergencyContact && `Emergency Contact: ${user.emergencyContact}`,
    user.leaseDocumentUrl && `Lease Document: Available for reference`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildIncidentContext(incident: Incident): string {
  return `Current Issue: ${incident.title}\nDescription: ${incident.description}\nStatus: ${incident.status}`;
}

export function computeTimelineHash(logs: IncidentLog[]): string {
  const evidenceLogs = logs.filter((l) => EVIDENCE_TYPES.includes(l.type));
  const payload = evidenceLogs.map((l) => {
    const severity = getLogSeverity(l);
    return `${l.id}:${l.type}:${severity}:${l.content}:${new Date(l.createdAt).toISOString()}`;
  }).join("|");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

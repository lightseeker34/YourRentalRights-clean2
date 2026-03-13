import type { IncidentLog } from "@shared/schema";
import { getLogSeverity } from "@shared/schema";

const IMAGE_LOG_TYPES = new Set([
  "photo",
  "call_photo",
  "text_photo",
  "email_photo",
  "service_photo",
  "chat_photo",
]);

const VISUAL_VERBS = [
  "look at",
  "analyze",
  "review",
  "inspect",
  "check",
  "examine",
  "what do you see",
  "can you see",
  "does this show",
  "does the photo show",
  "does the picture show",
  "tell me what you see",
];

const IMAGE_NOUNS = ["photo", "picture", "image", "screenshot", "pic"];

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, parts: string[]): boolean {
  return parts.some((part) => text.includes(part));
}

function getCategoryHints(text: string): string[] {
  const hints: string[] = [];

  if (text.includes("email")) hints.push("email_photo");
  if (text.includes("text") || text.includes("sms")) hints.push("text_photo");
  if (text.includes("service") || text.includes("maintenance") || text.includes("repair")) hints.push("service_photo");
  if (text.includes("call") || text.includes("voicemail") || text.includes("phone")) hints.push("call_photo");
  if (text.includes("chat")) hints.push("chat_photo");

  return hints;
}

export function shouldAutoAttachTimelineImages(message: string): boolean {
  const text = normalizeMessage(message);
  return hasAny(text, VISUAL_VERBS) && hasAny(text, IMAGE_NOUNS);
}

function isImageLog(log: IncidentLog): boolean {
  return IMAGE_LOG_TYPES.has(log.type) && !!log.fileUrl;
}

function severityRank(log: IncidentLog): number {
  const severity = getLogSeverity(log);
  if (severity === "critical") return 3;
  if (severity === "important") return 2;
  return 1;
}

function sortByPriority(logs: IncidentLog[]): IncidentLog[] {
  return [...logs].sort((a, b) => {
    const severityDiff = severityRank(b) - severityRank(a);
    if (severityDiff !== 0) return severityDiff;

    const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;

    return b.id - a.id;
  });
}

export function selectTimelineImagesForChat(message: string, logs: IncidentLog[], limit = 3): string[] {
  const candidates = logs.filter(isImageLog);
  if (candidates.length === 0) return [];

  const text = normalizeMessage(message);
  const categoryHints = getCategoryHints(text);

  const categoryMatches = categoryHints.length > 0
    ? candidates.filter((log) => categoryHints.includes(log.type))
    : [];

  const primaryPool = categoryMatches.length > 0 ? categoryMatches : candidates;
  const selected = sortByPriority(primaryPool).slice(0, limit);

  return selected
    .map((log) => log.fileUrl)
    .filter((fileUrl): fileUrl is string => Boolean(fileUrl));
}

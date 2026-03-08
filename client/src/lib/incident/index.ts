import { IncidentLog } from "@shared/schema";

export const getMetaCategory = (log: IncidentLog): string | undefined =>
  (log.metadata as any)?.category;

export const isAnalysisPdf = (log: IncidentLog): boolean =>
  getMetaCategory(log) === "analysis_pdf";

export const isImageAttachmentLog = (log: IncidentLog): boolean => {
  if (log.type === "photo") return true;
  const mimeType = (log.metadata as any)?.mimeType;
  return typeof mimeType === "string" && mimeType.startsWith("image/");
};

export const isLikelyImageUrl = (url: string): boolean =>
  /\.(png|gif|webp|jpe?g)(?:[?#].*)?$/i.test(url);

export const getAttachmentDisplayName = (log: IncidentLog): string =>
  log.title || (log.metadata as any)?.originalName || log.content || "Attachment";

const PHOTO_ATTACHMENT_PARENT_TYPES = new Set([
  "call",
  "text",
  "email",
  "photo",
  "service",
  "portal",
  "custom",
]);

const DOCUMENT_ATTACHMENT_PARENT_TYPES = new Set([
  "call",
  "text",
  "email",
  "service",
  "portal",
  "custom",
]);

export const getAttachedPhotos = (log: IncidentLog, logs: IncidentLog[]): IncidentLog[] => {
  if (!PHOTO_ATTACHMENT_PARENT_TYPES.has(log.type)) return [];
  return logs.filter(l => {
    const parentLogId = (l.metadata as any)?.parentLogId;
    return l.type === 'photo' && parentLogId === log.id;
  });
};

export const getAttachedDocuments = (log: IncidentLog, logs: IncidentLog[]): IncidentLog[] => {
  if (!DOCUMENT_ATTACHMENT_PARENT_TYPES.has(log.type)) return [];
  return logs.filter(l => {
    const parentLogId = (l.metadata as any)?.parentLogId;
    return l.type === 'document' && parentLogId === log.id;
  });
};

export const getAttachedFiles = (log: IncidentLog, logs: IncidentLog[]): IncidentLog[] => {
  const attachedFiles = [...getAttachedPhotos(log, logs), ...getAttachedDocuments(log, logs)];

  if ((log.type === "photo" || log.type === "document") && log.fileUrl) {
    attachedFiles.unshift(log);
  }

  const seen = new Set<number>();
  return attachedFiles.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
};

export const canAddLogToAiConversation = (log: IncidentLog): boolean =>
  log.type !== "chat";

export const buildAiConversationDraftFromLog = (
  log: IncidentLog,
  logs: IncidentLog[],
): { message: string; attachments: string[] } => {
  let typeLabel: string;
  switch (log.type) {
    case "chat":
      typeLabel = log.isAi ? "Assistant" : "You";
      break;
    case "photo":
      typeLabel = "Photo";
      break;
    case "note":
      typeLabel = "Note";
      break;
    case "portal":
      typeLabel = "Portal Entry";
      break;
    case "service":
      typeLabel = "Service Request";
      break;
    case "custom":
      typeLabel = "Custom Entry";
      break;
    default:
      typeLabel = log.type.charAt(0).toUpperCase() + log.type.slice(1);
      break;
  }

  const attachedFiles = getAttachedFiles(log, logs);
  const attachmentUrls = attachedFiles
    .map((entry) => entry.fileUrl)
    .filter((fileUrl): fileUrl is string => Boolean(fileUrl));

  const nonImageAttachments = attachedFiles
    .filter((entry) => !isImageAttachmentLog(entry))
    .map(getAttachmentDisplayName);

  const messageParts = [
    `Add this to our discussion: [${typeLabel}${log.title ? `: ${log.title}` : ""}] ${log.content}`.trim(),
  ];

  if (nonImageAttachments.length > 0) {
    messageParts.push(`Associated files: ${nonImageAttachments.join(", ")}`);
  }

  return {
    message: messageParts.join("\n\n"),
    attachments: attachmentUrls,
  };
};

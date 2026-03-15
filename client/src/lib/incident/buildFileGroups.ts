import { IncidentLog, Incident } from "@shared/schema";
import { Phone, MessageSquare, Mail, FileText, Image as ImageIcon, FolderOpen, Wrench, Bot, Paperclip } from "lucide-react";
import { getMetaCategory } from "./index";

export interface FileGroup {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  files: IncidentLog[];
  type: string;
}

export function buildFileGroups(logs: IncidentLog[], incident: Incident | undefined): FileGroup[] {
  const allPhotos = logs.filter(l => l.type === 'photo');
  const allDocuments = logs.filter(l => l.type === 'document');

  const groups: FileGroup[] = [];
  const usedPhotoIds = new Set<number>();
  const usedDocIds = new Set<number>();

  const analysisPdfs = allDocuments.filter(d => getMetaCategory(d) === 'analysis_pdf');
  if (analysisPdfs.length > 0) {
    analysisPdfs.forEach(d => usedDocIds.add(d.id));
    groups.push({ id: 'analysis-pdfs', label: 'AI Analysis PDFs', icon: Bot, color: 'text-violet-600', files: analysisPdfs, type: 'analysis_pdf' });
  }

  const incidentPhotos = allPhotos.filter(p => getMetaCategory(p) === 'incident_photo');
  incidentPhotos.forEach(p => usedPhotoIds.add(p.id));
  if (incidentPhotos.length > 0 && incident) {
    groups.push({
      id: 'incident',
      label: incident.title,
      icon: FolderOpen,
      color: 'text-slate-700',
      files: incidentPhotos,
      type: 'incident'
    });
  }

  const logsWithPotentialAttachments = logs.filter(l =>
    l.type === 'call' || l.type === 'text' || l.type === 'email' || l.type === 'service' || (l.type === 'photo' && l.title)
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  logsWithPotentialAttachments.forEach(log => {
    const attachedPhotos = allPhotos.filter(p => {
      const parentLogId = (p.metadata as any)?.parentLogId;
      return p.type === 'photo' && parentLogId === log.id;
    });
    const attachedDocs = allDocuments.filter(d => {
      const parentLogId = (d.metadata as any)?.parentLogId;
      return parentLogId === log.id;
    });

    let icon: React.ComponentType<any> = FileText;
    let color = 'text-slate-500';
    const typeLabel = log.type.charAt(0).toUpperCase() + log.type.slice(1);

    if (log.type === 'call') { icon = Phone; color = 'text-blue-500'; }
    else if (log.type === 'text') { icon = MessageSquare; color = 'text-green-500'; }
    else if (log.type === 'email') { icon = Mail; color = 'text-purple-500'; }
    else if (log.type === 'service') { icon = Wrench; color = 'text-orange-500'; }
    else if (log.type === 'photo') { icon = ImageIcon; color = 'text-blue-500'; }
    else if (log.type === 'note') { icon = FileText; color = 'text-slate-500'; }

    const label = log.title
      ? `${typeLabel}: ${log.title}`
      : `${typeLabel}: ${log.content?.substring(0, 30)}${(log.content?.length || 0) > 30 ? '...' : ''}`;

    const files: IncidentLog[] = [];
    if (log.type === 'photo' && log.fileUrl) {
      files.push(log);
      usedPhotoIds.add(log.id);
    }
    attachedPhotos.forEach(p => { files.push(p); usedPhotoIds.add(p.id); });
    attachedDocs.forEach(d => { files.push(d); usedDocIds.add(d.id); });

    if (files.length > 0) {
      groups.push({ id: `log-${log.id}`, label, icon, color, files, type: log.type });
    }
  });

  const chatFiles: IncidentLog[] = [];
  const chatCategoryPhotos = allPhotos.filter(p => !usedPhotoIds.has(p.id) && getMetaCategory(p) === 'chat_photo');
  chatCategoryPhotos.forEach(p => { chatFiles.push(p); usedPhotoIds.add(p.id); });
  const chatCategoryDocs = allDocuments.filter(d => !usedDocIds.has(d.id) && getMetaCategory(d) === 'chat_document');
  chatCategoryDocs.forEach(d => { chatFiles.push(d); usedDocIds.add(d.id); });
  if (chatFiles.length > 0) {
    groups.push({
      id: 'chat-files',
      label: 'Chat Files',
      icon: Bot,
      color: 'text-slate-600',
      files: chatFiles.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      type: 'chat'
    });
  }

  const standalonePhotos = allPhotos.filter(p => !usedPhotoIds.has(p.id));
  if (standalonePhotos.length > 0) {
    groups.push({ id: 'standalone-photos', label: 'Other Photos', icon: ImageIcon, color: 'text-slate-500', files: standalonePhotos, type: 'standalone' });
  }

  const standaloneDocuments = allDocuments.filter(d => !usedDocIds.has(d.id));
  const regularDocuments = standaloneDocuments.filter(d => getMetaCategory(d) !== 'analysis_pdf');

  if (regularDocuments.length > 0) {
    groups.push({ id: 'documents', label: 'Documents', icon: Paperclip, color: 'text-slate-500', files: regularDocuments, type: 'document' });
  }

  return groups;
}

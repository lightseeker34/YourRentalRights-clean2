import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false),
  status: text("status").default("active").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  unitNumber: text("unit_number"),
  rentalAgency: text("rental_agency"),
  propertyManagerName: text("property_manager_name"),
  propertyManagerPhone: text("property_manager_phone"),
  propertyManagerEmail: text("property_manager_email"),
  leaseStartDate: text("lease_start_date"),
  monthlyRent: text("monthly_rent"),
  emergencyContact: text("emergency_contact"),
  leaseDocumentUrl: text("lease_document_url"),
  // Forum profile fields
  forumDisplayName: text("forum_display_name"),
  forumBio: text("forum_bio"),
  avatarUrl: text("avatar_url"),
  showOnlineStatus: boolean("show_online_status").default(true),
  lastActiveAt: timestamp("last_active_at"),
  lastLoginAt: timestamp("last_login_at"),
  emailNotifications: boolean("email_notifications").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("incidents_user_id_idx").on(table.userId),
  index("incidents_created_at_idx").on(table.createdAt),
]);

export const incidentLogs = pgTable("incident_logs", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata"),
  isAi: boolean("is_ai").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("incident_logs_incident_id_idx").on(table.incidentId),
  index("incident_logs_created_at_idx").on(table.createdAt),
  index("incident_logs_type_idx").on(table.type),
]);

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forum tables
export const forumCategories = pgTable("forum_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("MessageSquare"),
  color: text("color").default("#64748b"),
  sortOrder: integer("sort_order").default(0),
  isLocked: boolean("is_locked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<{ url: string; name: string; type: string }[]>().default([]),
  isPinned: boolean("is_pinned").default(false),
  isLocked: boolean("is_locked").default(false),
  viewCount: integer("view_count").default(0),
  replyCount: integer("reply_count").default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("forum_posts_category_id_idx").on(table.categoryId),
  index("forum_posts_author_id_idx").on(table.authorId),
  index("forum_posts_last_activity_idx").on(table.lastActivityAt),
]);

export const forumReplies = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  parentReplyId: integer("parent_reply_id"),
  content: text("content").notNull(),
  isAcceptedAnswer: boolean("is_accepted_answer").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("forum_replies_post_id_idx").on(table.postId),
  index("forum_replies_author_id_idx").on(table.authorId),
]);

export const forumReactions = pgTable("forum_reactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id"),
  replyId: integer("reply_id"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("forum_reactions_user_id_idx").on(table.userId),
  index("forum_reactions_post_id_idx").on(table.postId),
  index("forum_reactions_reply_id_idx").on(table.replyId),
]);

export const forumBookmarks = pgTable("forum_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: integer("post_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("forum_bookmarks_user_id_idx").on(table.userId),
  index("forum_bookmarks_post_id_idx").on(table.postId),
]);

export const userTrustLevels = pgTable("user_trust_levels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  level: integer("level").default(0).notNull(),
  postCount: integer("post_count").default(0),
  replyCount: integer("reply_count").default(0),
  likesReceived: integer("likes_received").default(0),
  isModerator: boolean("is_moderator").default(false),
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pdfExports = pgTable("pdf_exports", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("pdf_exports_incident_id_idx").on(table.incidentId),
  index("pdf_exports_user_id_idx").on(table.userId),
  index("pdf_exports_created_at_idx").on(table.createdAt),
]);

export const litigationReviews = pgTable("litigation_reviews", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull(),
  userId: integer("user_id").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  evidenceScore: integer("evidence_score"),
  recommendation: text("recommendation"),
  summary: text("summary"),
  violations: jsonb("violations").$type<{ code: string; description: string; severity: string }[]>(),
  timelineAnalysis: text("timeline_analysis"),
  nextSteps: jsonb("next_steps").$type<string[]>(),
  fullAnalysis: jsonb("full_analysis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("litigation_reviews_incident_id_idx").on(table.incidentId),
  index("litigation_reviews_user_id_idx").on(table.userId),
  index("litigation_reviews_created_at_idx").on(table.createdAt),
]);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  unitNumber: z.string().optional(),
  rentalAgency: z.string().optional(),
  propertyManagerName: z.string().optional(),
  propertyManagerPhone: z.string().optional(),
  propertyManagerEmail: z.string().email().optional().or(z.literal("")),
  leaseStartDate: z.string().optional(),
  monthlyRent: z.string().optional(),
  emergencyContact: z.string().optional(),
  leaseDocumentUrl: z.string().optional(),
  // Forum profile fields
  forumDisplayName: z.string().optional(),
  forumBio: z.string().optional(),
  avatarUrl: z.string().optional(),
  showOnlineStatus: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export const insertIncidentSchema = createInsertSchema(incidents).pick({
  title: true,
  description: true,
});

export const insertLogSchema = createInsertSchema(incidentLogs).pick({
  incidentId: true,
  type: true,
  title: true,
  content: true,
  fileUrl: true,
  metadata: true,
  isAi: true,
});

export const insertContactSchema = createInsertSchema(contactMessages).pick({
  name: true,
  email: true,
  subject: true,
  message: true,
});

export const insertForumCategorySchema = createInsertSchema(forumCategories).pick({
  name: true,
  description: true,
  icon: true,
  color: true,
  sortOrder: true,
});

export const insertForumPostSchema = createInsertSchema(forumPosts).pick({
  categoryId: true,
  title: true,
  content: true,
  attachments: true,
});

export const insertForumReplySchema = createInsertSchema(forumReplies).pick({
  postId: true,
  parentReplyId: true,
  content: true,
});

export const insertForumReactionSchema = createInsertSchema(forumReactions).pick({
  postId: true,
  replyId: true,
  type: true,
});

export const SEVERITY_LEVELS = ['critical', 'important', 'routine'] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

export const DEFAULT_SEVERITY_BY_TYPE: Record<string, SeverityLevel> = {
  call: 'important',
  text: 'routine',
  email: 'important',
  photo: 'important',
  document: 'important',
  note: 'routine',
  call_photo: 'important',
  text_photo: 'routine',
  email_photo: 'important',
  chat: 'routine',
  chat_photo: 'routine',
  service: 'important',
  service_photo: 'important',
  service_document: 'important',
  portal: 'important',
  portal_photo: 'important',
  portal_document: 'important',
  custom: 'routine',
  custom_photo: 'routine',
  custom_document: 'routine',
};

export function getLogSeverity(log: { type: string; metadata: any }): SeverityLevel {
  if (log.metadata && typeof log.metadata === 'object' && 'severity' in log.metadata) {
    const s = (log.metadata as any).severity;
    if (SEVERITY_LEVELS.includes(s)) return s;
  }
  return DEFAULT_SEVERITY_BY_TYPE[log.type] || 'routine';
}

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type User = typeof users.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type IncidentLog = typeof incidentLogs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type ForumReply = typeof forumReplies.$inferSelect;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReaction = typeof forumReactions.$inferSelect;
export type InsertForumReaction = z.infer<typeof insertForumReactionSchema>;
export type ForumBookmark = typeof forumBookmarks.$inferSelect;
export type UserTrustLevel = typeof userTrustLevels.$inferSelect;
export type PdfExport = typeof pdfExports.$inferSelect;
export type LitigationReview = typeof litigationReviews.$inferSelect;

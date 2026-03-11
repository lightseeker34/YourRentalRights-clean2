import type { Express } from "express";
import { storage } from "../storage";
import { insertLogSchema } from "@shared/schema";
import { deleteFromR2, isR2Enabled } from "../r2";

export function registerLogRoutes(app: Express) {
  app.get("/api/incidents/:id/logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Verify ownership of incident
    const incidentId = parseInt(req.params.id);
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const logs = await storage.getLogsByIncident(incidentId);
    res.json(logs);
  });

  app.post("/api/incidents/:id/logs", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Use URL param as source of truth for incidentId
    const incidentId = parseInt(req.params.id);

    // Verify ownership of incident
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const parsed = insertLogSchema.safeParse({ ...req.body, incidentId });
    if (!parsed.success) return res.status(400).json(parsed.error);

    const log = await storage.addLog(parsed.data);
    res.status(201).json(log);
  });

  app.delete("/api/logs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const logId = parseInt(req.params.id);
    const log = await storage.getLog(logId);
    if (!log) return res.sendStatus(404);

    // Verify ownership via incident
    const incident = await storage.getIncident(log.incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const r2Key = (log.metadata as any)?.r2Key as string | undefined;
    if (r2Key && isR2Enabled()) {
      try {
        await deleteFromR2(r2Key);
      } catch (err) {
        console.warn("Failed to delete R2 object for log", logId, err);
      }
    }

    await storage.deleteLog(logId);
    res.sendStatus(204);
  });

  // Cascade delete - delete a log and all logs after it (by createdAt timestamp + ID as tie-breaker)
  app.delete("/api/logs/:id/cascade", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const logId = parseInt(req.params.id);
    const log = await storage.getLog(logId);
    if (!log) return res.sendStatus(404);

    // Verify ownership via incident
    const incident = await storage.getIncident(log.incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    // Get all chat logs for this incident, sort by createdAt then by ID for deterministic ordering
    const allLogs = await storage.getLogsByIncident(log.incidentId);
    const chatLogs = allLogs
      .filter((l: any) => l.type === "chat")
      .sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id - b.id;
      });

    const targetCreatedAt = new Date(log.createdAt).getTime();
    const targetId = log.id;

    // Delete all chat logs with (createdAt > target) OR (createdAt == target AND id >= targetId)
    const logsToDelete = chatLogs.filter((l: any) => {
      const logTime = new Date(l.createdAt).getTime();
      if (logTime > targetCreatedAt) return true;
      if (logTime === targetCreatedAt && l.id >= targetId) return true;
      return false;
    });

    for (const logToDelete of logsToDelete) {
      const r2Key = (logToDelete.metadata as any)?.r2Key as string | undefined;
      if (r2Key && isR2Enabled()) {
        try {
          await deleteFromR2(r2Key);
        } catch (err) {
          console.warn("Failed to delete R2 object for log", logToDelete.id, err);
        }
      }
      await storage.deleteLog(logToDelete.id);
    }

    res.sendStatus(204);
  });

  app.patch("/api/logs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const logId = parseInt(req.params.id);
    const log = await storage.getLog(logId);
    if (!log) return res.sendStatus(404);

    // Verify ownership via incident
    const incident = await storage.getIncident(log.incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const { content, metadata } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const updates: { content?: string; metadata?: any } = { content };
    if (metadata !== undefined) updates.metadata = metadata;
    const updated = await storage.updateLog(logId, updates);
    res.json(updated);
  });
}

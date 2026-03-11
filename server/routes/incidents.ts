import type { Express } from "express";
import { storage } from "../storage";
import { insertIncidentSchema } from "@shared/schema";

export function registerIncidentRoutes(app: Express) {
  app.get("/api/incidents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incidents = await storage.getIncidentsByUser(req.user!.id);
    res.json(incidents);
  });

  app.post("/api/incidents", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = insertIncidentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const incident = await storage.createIncident({
      ...parsed.data,
      userId: req.user!.id,
    });
    res.status(201).json(incident);
  });

  app.get("/api/incidents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incident = await storage.getIncident(parseInt(req.params.id));
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);
    res.json(incident);
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incidentId = parseInt(req.params.id);
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const { title, description } = req.body;
    const updates: { title?: string; description?: string } = {};
    if (title) updates.title = title;
    if (description) updates.description = description;

    const updated = await storage.updateIncident(incidentId, updates);
    res.json(updated);
  });

  app.patch("/api/incidents/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incidentId = parseInt(req.params.id);
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const { status } = req.body;
    if (!status || !["open", "closed"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'open' or 'closed'" });
    }

    const updated = await storage.updateIncidentStatus(incidentId, status);
    res.json(updated);
  });

  app.delete("/api/incidents/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incidentId = parseInt(req.params.id);
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    await storage.deleteIncident(incidentId);
    res.sendStatus(204);
  });
}

import type { Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { uploadDir, uploadEvidence } from "../uploads";
import { getFromR2, isR2Enabled, uploadToR2 } from "../r2";

export function registerEvidenceRoutes(app: Express) {
  app.post(
    "/api/incidents/:id/upload",
    (req, res, next) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      next();
    },
    uploadEvidence.single("file"),
    async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const idParam = req.params.id;
      const incidentId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam);
      const incident = await storage.getIncident(incidentId);
      if (!incident) return res.sendStatus(404);
      if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

      const isPhoto = req.file.mimetype.startsWith("image/");
      const r2Key = `evidence/${incidentId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await uploadToR2({
        key: r2Key,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });
      const fileUrl = upload.url;

      const category = req.query.category as string | undefined;
      const parentLogId = req.body.parentLogId ? parseInt(req.body.parentLogId) : undefined;

      const log = await storage.addLog({
        incidentId,
        type: isPhoto ? "photo" : "document",
        content: req.file.originalname,
        fileUrl,
        isAi: false,
        metadata: {
          r2Key,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
          ...(category && { category }),
          ...(parentLogId && { parentLogId }),
        },
      });

      res.status(201).json(log);
    },
  );

  app.get("/api/evidence/:filename", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const filename = req.params.filename;
    const fileUrl = `/api/evidence/${filename}`;

    const log = await storage.getLogByFileUrl(fileUrl);
    if (!log) return res.sendStatus(404);

    const incident = await storage.getIncident(log.incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== req.user!.id && !req.user!.isAdmin) return res.sendStatus(403);

    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) return res.sendStatus(404);
    res.sendFile(filePath);
  });

  app.get(/^\/api\/r2\/(.+)$/, requireAuth, async (req, res) => {
    try {
      if (!isR2Enabled()) return res.status(503).json({ error: "R2 not configured" });
      const key = decodeURIComponent(String((req.params as any)[0] || ""));
      if (!key) return res.status(400).json({ error: "Missing key" });

      const r2Obj = await getFromR2(key);
      const body = r2Obj.Body;
      if (!body) return res.sendStatus(404);

      if (r2Obj.ContentType) {
        res.setHeader("Content-Type", r2Obj.ContentType);
      }

      const stream = body as any;
      if (typeof stream.pipe === "function") {
        return stream.pipe(res);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return res.send(Buffer.concat(chunks));
    } catch (error) {
      console.error("R2 read failed", error);
      return res.sendStatus(404);
    }
  });
}

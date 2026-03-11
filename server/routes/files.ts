import type { Express } from "express";
import fs from "fs";
import { storage } from "../storage";
import { getSafeFilename, resolveFileWithin } from "../lib/files";
import { uploadDir, uploadLease } from "../uploads";

export function registerFileRoutes(app: Express) {
  app.post(
    "/api/upload/lease",
    (req, res, next) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      next();
    },
    uploadLease.single("file"),
    async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const url = `/api/uploads/${req.file.filename}`;
      await storage.updateProfile(req.user!.id, { leaseDocumentUrl: url });
      res.json({ url });
    },
  );

  // Serve uploaded files - verify ownership via database
  app.get("/api/uploads/:filename", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const filename = getSafeFilename(req.params.filename);
    if (!filename) return res.status(400).json({ error: "Invalid filename" });

    const requestedPath = `/api/uploads/${filename}`;
    const user = req.user!;

    // Get fresh user data from database to check ownership
    const currentUser = await storage.getUser(user.id);
    if (!currentUser) return res.sendStatus(401);

    // Only allow access if this is the user's own lease file OR admin accessing any file
    const isOwner = currentUser.leaseDocumentUrl === requestedPath;
    if (!isOwner && !user.isAdmin) return res.sendStatus(403);

    const filePath = resolveFileWithin(uploadDir, filename);
    if (!filePath || !fs.existsSync(filePath)) return res.sendStatus(404);
    res.sendFile(filePath);
  });

  // Download document file (no auth required)
  app.get("/api/download/:filename", async (req, res) => {
    const filename = getSafeFilename(req.params.filename);
    if (!filename) return res.status(400).json({ error: "Invalid filename" });

    const filePath = resolveFileWithin(process.cwd(), filename);
    if (!filePath || !fs.existsSync(filePath)) return res.sendStatus(404);

    // Set proper headers for Word document download
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.download(filePath, filename);
  });

  // Delete lease
  app.delete("/api/user/lease", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Get fresh user data from database
    const currentUser = await storage.getUser(req.user!.id);
    if (!currentUser) return res.sendStatus(401);

    if (currentUser.leaseDocumentUrl) {
      const filename = getSafeFilename(currentUser.leaseDocumentUrl.replace("/api/uploads/", ""));
      if (filename) {
        const filePath = resolveFileWithin(uploadDir, filename);
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    await storage.updateProfile(currentUser.id, { leaseDocumentUrl: "" });
    res.sendStatus(204);
  });
}

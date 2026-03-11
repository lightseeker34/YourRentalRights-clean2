import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { seedCommunityTopicsIfEmpty, syncCommunityTopicsVersioned } from "./forum-seed";

const app = express();
app.use(compression());
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const contentLength = res.getHeader("content-length");
      const sizeSuffix = contentLength ? ` :: ${contentLength}b` : "";
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms${sizeSuffix}`);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  try {
    const seeded = await seedCommunityTopicsIfEmpty();
    if (seeded.seeded) {
      log(`forum starter content seeded (${seeded.categories} categories, ${seeded.posts} posts)`, "seed");
    }

    const synced = await syncCommunityTopicsVersioned();
    if (synced.ran) {
      log(`forum starter content sync ${synced.version} applied (${synced.categories} categories, ${synced.created} created, ${synced.updated} updated)`, "seed");
    }
  } catch (error) {
    console.error("forum seed on startup failed:", error);
  }

  app.get("/healthz", async (_req, res) => {
    try {
      await pool.query("select 1");
      return res.status(200).json({
        ok: true,
        uptimeSec: Math.floor(process.uptime()),
        env: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      console.error("healthz db check failed:", error);
      return res.status(503).json({ ok: false });
    }
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

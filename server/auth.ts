import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, insertUserSchema } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle both : and . separators for backwards compatibility
  const separator = stored.includes(":") ? ":" : ".";
  const parts = stored.split(separator);

  // Format is salt:hash (new) or hash.salt (old)
  let salt: string, hashed: string;
  if (separator === ":") {
    [salt, hashed] = parts;
  } else {
    [hashed, salt] = parts;
  }

  if (!salt) {
    return false; // Invalid format
  }

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const isProd = app.get("env") === "production";

  if (isProd && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "replit_session_secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
  };

  if (isProd) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const parsed = insertUserSchema.safeParse({
        username: String(req.body?.username || "").trim(),
        password: String(req.body?.password || ""),
      });

      if (!parsed.success) {
        return res.status(400).send("Invalid registration payload");
      }

      const { username, password } = parsed.data;

      if (username.length < 3) {
        return res.status(400).send("Username must be at least 3 characters");
      }
      if (password.length < 8) {
        return res.status(400).send("Password must be at least 8 characters");
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      const hashedPassword = await hashPassword(password);

      // First user becomes admin automatically
      const userCount = await storage.getUserCount();
      const isFirstUser = userCount === 0;

      const createdUser = await storage.createUser({
        username,
        password: hashedPassword,
      });

      const user = isFirstUser
        ? await storage.updateUser(createdUser.id, { isAdmin: true }) ?? createdUser
        : createdUser;

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (err) {
      console.error("register failed:", err);
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    // Update last login time
    const user = req.user as User;
    if (user?.id) {
      await storage.updateUserLastLogin(user.id);
    }
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

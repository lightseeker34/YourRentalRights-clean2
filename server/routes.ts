import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { updateProfileSchema, User, insertForumCategorySchema, insertForumPostSchema, insertForumReplySchema } from "@shared/schema";
import "./types";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { assembleContextTwoPasses, formatStructuredTimelineForPrompt, formatEvidenceTimeline, formatPhotoList, formatTimelineForPrompt, formatPhotoListForPrompt, buildUserContext, buildIncidentContext, computeTimelineHash } from "./ai-context";
import { uploadToR2 } from "./r2";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { uploadDir, uploadForumAttachment } from "./uploads";
import { registerFileRoutes } from "./routes/files";
import { registerIncidentRoutes } from "./routes/incidents";
import { registerLogRoutes } from "./routes/logs";
import { registerEvidenceRoutes } from "./routes/evidence";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  registerFileRoutes(app);
  registerIncidentRoutes(app);
  registerLogRoutes(app);
  registerEvidenceRoutes(app);

  // --- User Profile ---
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const user = await storage.updateProfile(req.user!.id, parsed.data);
    res.json(user);
  });

  // --- AI Agent Endpoint ---
  app.post("/api/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { message, incidentId, attachedImages } = req.body;
    const user = req.user!;
    
    // Verify ownership of incident
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    // Store user message
    await storage.addLog({
      incidentId,
      type: "chat",
      content: message,
      isAi: false,
      metadata: attachedImages ? { attachedImages } : undefined,
    });

    // Check for "let's get started" message - respond with welcome message
    const normalizedMessage = message.toLowerCase().trim().replace(/[\u2018\u2019\u0027]/g, "'").replace(/\s+/g, ' ');
    if (normalizedMessage === "let's get started" || normalizedMessage === "lets get started") {
      const welcomeResponse = "Welcome! I'm here to help you understand your rights as a tenant. To get started, tell me about the issue you're experiencing with your rental. For example: heating problems, mold, security deposits, or lease disputes.";
      
      await storage.addLog({
        incidentId,
        type: "chat",
        content: welcomeResponse,
        isAi: true,
      });
      
      return res.json({ response: welcomeResponse });
    }

    // Get system prompt and API key from settings
    const systemPrompt = await storage.getSetting("ai_system_prompt");
    const grokApiKey = await storage.getSetting("grok_api_key");
    const openaiApiKey = await storage.getSetting("openai_api_key");

    // Build comprehensive context with user profile
    const userContext = buildUserContext(user);

    // Incident context
    const incidentContext = buildIncidentContext(incident);

    // Get all evidence logs for RAG context (deterministic: sorted by timestamp ASC, id ASC)
    const allLogs = await storage.getLogsByIncident(incidentId);
    const pass1Context = assembleContextTwoPasses(allLogs, { includeBackfill: false });
    const pass2Context = assembleContextTwoPasses(allLogs, { includeBackfill: true });
    const evidenceContextPass1 = formatStructuredTimelineForPrompt(pass1Context.included);
    const evidenceContextPass2 = formatStructuredTimelineForPrompt(pass2Context.included);

    function parseBackfillDecision(raw: string): boolean {
      try {
        const obj = JSON.parse(raw);
        return !!obj?.needs_backfill;
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return false;
        try {
          const obj = JSON.parse(match[0]);
          return !!obj?.needs_backfill;
        } catch {
          return false;
        }
      }
    }

    function buildSystemPrompt(evidenceContext: string, includeBackfill: boolean): string {
      return `${systemPrompt || "You are a tenant advocacy assistant."}

## TENANT PROFILE
${userContext || "No profile information available."}

## CURRENT CASE
${incidentContext}

## EVIDENCE & COMMUNICATION LOG
Items tagged [CRITICAL] or [IMPORTANT] are high-priority evidence. Always reference these when relevant.
${evidenceContext || "No evidence logged yet."}

Remember: You have access to the tenant's case information above. Use this context to provide personalized, actionable advice. Reference specific dates, communications, and evidence when relevant.

IMPORTANT: The TENANT PROFILE section contains the USER's personal information (their phone, email, address, etc.) - NOT yours. You are an AI assistant and do not have a phone number or email. Never say things like "call me anytime" or offer your own contact information.

PHOTO ANALYSIS GUIDELINES:
- Analyze photos accurately and honestly based ONLY on what you can actually see
- Do NOT embellish, exaggerate, or invent details that are not clearly visible
- If something is unclear or ambiguous in a photo, say so
- Be consistent - the same photo should receive the same analysis
- Only describe conditions you can genuinely observe
- If you cannot determine something from the image, admit uncertainty rather than guessing

CONTEXT-PASS MODE: ${includeBackfill ? "PASS 2 (older routine history included)" : "PASS 1 (critical + recent only)"}`;
    }

    const fullSystemPromptPass1 = buildSystemPrompt(evidenceContextPass1, false);
    const fullSystemPromptPass2 = buildSystemPrompt(evidenceContextPass2, true);

    let aiResponse = "";

    try {
      const imageMimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
      };
      const isImageUrl = (url: string) =>
        /\.(png|gif|webp|jpe?g)(?:[?#].*)?$/i.test(url);

      // Try xAI Grok first
      if (grokApiKey) {
        const xai = new OpenAI({
          apiKey: grokApiKey,
          baseURL: "https://api.x.ai/v1",
        });

        // Build message content with text and optional images
        const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: "text", text: message }
        ];

        // Add attached images from this message - convert to base64 for local files
        if (attachedImages && Array.isArray(attachedImages)) {
          for (const imageUrl of attachedImages) {
            try {
              // Handle local file URLs by converting to base64
              if (imageUrl.startsWith('/api/evidence/') || imageUrl.startsWith('/api/uploads/')) {
                const filename = imageUrl.split('/').pop();
                const filePath = path.join(uploadDir, filename || '');
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  // Skip files larger than 5MB to avoid API limits
                  if (stats.size > 5 * 1024 * 1024) {
                    console.log(`Skipping large image (${stats.size} bytes): ${filename}`);
                    continue;
                  }
                  const fileBuffer = fs.readFileSync(filePath);
                  const base64 = fileBuffer.toString('base64');
                  const ext = path.extname(filePath).toLowerCase();
                  const mimeType = imageMimeTypes[ext];
                  if (!mimeType) continue;
                  messageContent.push({
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                  });
                }
              } else if (imageUrl.startsWith('http') && isImageUrl(imageUrl)) {
                // External URLs can be passed directly
                messageContent.push({
                  type: "image_url",
                  image_url: { url: imageUrl }
                });
              }
            } catch (imgErr) {
              console.error("Error processing image for AI:", imgErr);
            }
          }
        }

        // Get recent chat history for context
        const chatHistory = allLogs
          .filter((l: any) => l.type === 'chat')
          .slice(-10) // Last 10 messages
          .map((l: any) => ({
            role: l.isAi ? "assistant" as const : "user" as const,
            content: l.content
          }));

        const completion = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [
            { role: "system", content: fullSystemPromptPass1 },
            ...chatHistory,
            { role: "user", content: messageContent }
          ],
          max_tokens: 4096,
        });

        aiResponse = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response. Please try again.";

        const backfillDecision = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [
            {
              role: "system",
              content: "Return ONLY valid JSON with this schema: {\"needs_backfill\": boolean, \"reason\": string}. Set needs_backfill=true only if older routine logs are required to answer reliably."
            },
            {
              role: "user",
              content: `Question: ${message}\n\nDraft answer: ${aiResponse}`
            }
          ],
          max_tokens: 120,
        });

        const needsBackfill = parseBackfillDecision(backfillDecision.choices[0]?.message?.content || "");
        if (needsBackfill) {
          const completionPass2 = await xai.chat.completions.create({
            model: "grok-4-1-fast-reasoning",
            messages: [
              { role: "system", content: fullSystemPromptPass2 },
              ...chatHistory,
              { role: "user", content: messageContent }
            ],
            max_tokens: 4096,
          });
          aiResponse = completionPass2.choices[0]?.message?.content || aiResponse;
        }
      } 
      // Fallback to OpenAI if no Grok key
      else if (openaiApiKey) {
        const openai = new OpenAI({
          apiKey: openaiApiKey,
        });

        const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: "text", text: message }
        ];

        // Add attached images - convert to base64 for local files
        if (attachedImages && Array.isArray(attachedImages)) {
          for (const imageUrl of attachedImages) {
            try {
              if (imageUrl.startsWith('/api/evidence/') || imageUrl.startsWith('/api/uploads/')) {
                const filename = imageUrl.split('/').pop();
                const filePath = path.join(uploadDir, filename || '');
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  if (stats.size > 5 * 1024 * 1024) {
                    console.log(`Skipping large image (${stats.size} bytes): ${filename}`);
                    continue;
                  }
                  const fileBuffer = fs.readFileSync(filePath);
                  const base64 = fileBuffer.toString('base64');
                  const ext = path.extname(filePath).toLowerCase();
                  const mimeType = imageMimeTypes[ext];
                  if (!mimeType) continue;
                  messageContent.push({
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                  });
                }
              } else if (imageUrl.startsWith('http') && isImageUrl(imageUrl)) {
                messageContent.push({
                  type: "image_url",
                  image_url: { url: imageUrl }
                });
              }
            } catch (imgErr) {
              console.error("Error processing image for AI:", imgErr);
            }
          }
        }

        const chatHistory = allLogs
          .filter((l: any) => l.type === 'chat')
          .slice(-10)
          .map((l: any) => ({
            role: l.isAi ? "assistant" as const : "user" as const,
            content: l.content
          }));

        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: fullSystemPromptPass1 },
            ...chatHistory,
            { role: "user", content: messageContent }
          ],
          max_tokens: 4096,
        });

        aiResponse = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response. Please try again.";

        const backfillDecision = await openai.chat.completions.create({
          model: "gpt-4.1",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "backfill_decision",
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  needs_backfill: { type: "boolean" },
                  reason: { type: "string" }
                },
                required: ["needs_backfill", "reason"]
              }
            }
          },
          messages: [
            {
              role: "system",
              content: "Decide if older routine logs are required for a reliable answer."
            },
            {
              role: "user",
              content: `Question: ${message}\n\nDraft answer: ${aiResponse}`
            }
          ],
          max_tokens: 120,
        });

        const needsBackfill = parseBackfillDecision(backfillDecision.choices[0]?.message?.content || "");
        if (needsBackfill) {
          const completionPass2 = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
              { role: "system", content: fullSystemPromptPass2 },
              ...chatHistory,
              { role: "user", content: messageContent }
            ],
            max_tokens: 4096,
          });
          aiResponse = completionPass2.choices[0]?.message?.content || aiResponse;
        }
      } 
      else {
        aiResponse = "No AI API key configured. Please add your Grok or OpenAI API key in the admin panel to enable AI responses.";
      }
    } catch (error: any) {
      console.error("AI API Error:", error?.status, error?.message, error?.response?.data || error);
      const errorMsg = error?.status === 401 
        ? "API key authorization failed. Please check your API key in the admin panel."
        : error?.status === 400
        ? "Invalid request to AI service. The image format may not be supported."
        : error?.message || "Unknown error";
      aiResponse = `I encountered an error processing your request: ${errorMsg}. Please try again or contact support.`;
    }

    const aiLog = await storage.addLog({
      incidentId,
      type: "chat",
      content: aiResponse,
      isAi: true,
    });

    res.json(aiLog);
  });

  // --- PDF Export Tracking ---
  app.post("/api/incidents/:id/pdf-export", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const incidentId = parseInt(req.params.id);
    const user = req.user!;
    
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    const pdfExport = await storage.createPdfExport(incidentId, user.id);
    res.json(pdfExport);
  });

  app.get("/api/incidents/:id/pdf-exports", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const incidentId = parseInt(req.params.id);
    const user = req.user!;
    
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    const exports = await storage.getPdfExportsByIncident(incidentId);
    res.json(exports);
  });

  // --- Litigation Review (AI Case Analysis) ---
  app.post("/api/incidents/:id/litigation-review", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const incidentId = parseInt(req.params.id);
    const user = req.user!;
    const { triggeredBy } = req.body; // 'user' or 'admin'
    
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    // Get full user profile for the incident owner
    const incidentOwner = await storage.getUser(incident.userId);
    if (!incidentOwner) return res.sendStatus(404);
    
    // Get all evidence logs (deterministic: sorted by timestamp ASC, id ASC)
    const allLogs = await storage.getLogsByIncident(incidentId);
    
    // Check cache: if timeline hasn't changed, return cached result
    const timelineHash = computeTimelineHash(allLogs);
    const cacheKey = `litigation_cache_${incidentId}`;
    const cachedRaw = await storage.getSetting(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.hash === timelineHash && cached.review) {
          return res.json({ ...cached.review, cached: true });
        }
      } catch {}
    }
    
    // Compile case context
    const userProfile = {
      fullName: incidentOwner.fullName,
      address: incidentOwner.address,
      unitNumber: incidentOwner.unitNumber,
      rentalAgency: incidentOwner.rentalAgency,
      propertyManagerName: incidentOwner.propertyManagerName,
      propertyManagerPhone: incidentOwner.propertyManagerPhone,
      propertyManagerEmail: incidentOwner.propertyManagerEmail,
      leaseStartDate: incidentOwner.leaseStartDate,
      monthlyRent: incidentOwner.monthlyRent,
    };
    
    // Use shared deterministic formatters for evidence
    const evidenceTimeline = formatEvidenceTimeline(allLogs);
    const photos = formatPhotoList(allLogs);
    const chatLogs = allLogs.filter((l: any) => l.type === 'chat');
    
    // Calculate case duration from earliest log (logs sorted ASC, first element is oldest)
    const firstLogDate = allLogs.length > 0 ? new Date(allLogs[0].createdAt) : new Date(incident.createdAt);
    const caseDurationDays = Math.floor((Date.now() - firstLogDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Get API keys
    const grokApiKey = await storage.getSetting("grok_api_key");
    const openaiApiKey = await storage.getSetting("openai_api_key");
    
    if (!grokApiKey && !openaiApiKey) {
      return res.status(400).json({ error: "No AI API key configured. Please add your Grok or OpenAI API key in the admin panel." });
    }
    
    // Build comprehensive litigation analysis prompt
    const litigationPrompt = `You are a legal analyst specializing in tenant rights and housing law. Analyze this tenant's case and provide a comprehensive litigation assessment.

## TENANT PROFILE
${userProfile.fullName ? `Name: ${userProfile.fullName}` : 'Name: Not provided'}
${userProfile.address ? `Property Address: ${userProfile.address}${userProfile.unitNumber ? `, Unit ${userProfile.unitNumber}` : ''}` : 'Address: Not provided'}
${userProfile.rentalAgency ? `Property Management: ${userProfile.rentalAgency}` : ''}
${userProfile.propertyManagerName ? `Property Manager: ${userProfile.propertyManagerName}` : ''}
${userProfile.leaseStartDate ? `Lease Start: ${userProfile.leaseStartDate}` : ''}
${userProfile.monthlyRent ? `Monthly Rent: ${userProfile.monthlyRent}` : ''}

## CASE INFORMATION
Title: ${incident.title}
Description: ${incident.description}
Status: ${incident.status}
Case Duration: ${caseDurationDays} days
Total Evidence Items: ${evidenceTimeline.length}
Photos Documented: ${photos.length}

## EVIDENCE TIMELINE
Items tagged [CRITICAL] or [IMPORTANT] are high-priority evidence that must be addressed in your analysis.
${formatTimelineForPrompt(evidenceTimeline)}

## PHOTO EVIDENCE
${formatPhotoListForPrompt(photos)}

## ANALYSIS INSTRUCTIONS
Pay special attention to entries marked [CRITICAL] — these represent health hazards, legal deadlines, or severe conditions. Entries marked [IMPORTANT] indicate significant communications or documentation.

Based on the tenant's location (${userProfile.address || 'address not provided'}), identify relevant local housing codes and tenant protection laws. Analyze:

1. **Timeline Analysis**: Evaluate the chronology of events, landlord response times, and any patterns of delay or neglect.

2. **Code Violations**: Based on the property location, identify specific housing code violations that may apply. Consider:
   - Habitability standards (heat, water, pests, mold)
   - Safety requirements (locks, smoke detectors, structural integrity)
   - Health hazards (sewage, lead paint, ventilation)
   - Local ordinances specific to the jurisdiction

3. **Evidence Strength**: Assess the quality and completeness of documentation:
   - Written vs verbal communications
   - Photo documentation quality
   - Dated records and paper trail
   - Witness statements or third-party documentation

4. **Landlord Response Pattern**: Evaluate:
   - Whether landlord acknowledged issues
   - Promised repairs that weren't completed
   - Any signs of retaliation
   - Communication responsiveness

5. **Litigation Recommendation**: Provide a clear assessment:
   - STRONG: Multiple documented violations, extensive evidence, clear landlord negligence
   - MODERATE: Some documentation gaps but clear pattern of issues
   - WEAK: Limited evidence, short timeline, or minor issues

## REQUIRED OUTPUT FORMAT
Provide your response in this exact JSON format:
{
  "summary": "2-3 sentence executive summary of the case",
  "evidenceScore": <number 1-10>,
  "recommendation": "strong" | "moderate" | "weak",
  "violations": [
    {
      "code": "Specific code or law citation",
      "description": "What the violation is",
      "severity": "high" | "medium" | "low"
    }
  ],
  "timelineAnalysis": "Analysis of the timeline and landlord response patterns",
  "nextSteps": [
    "Specific actionable step 1",
    "Specific actionable step 2",
    "Specific actionable step 3"
  ],
  "strengthFactors": ["List of factors strengthening the case"],
  "weaknessFactors": ["List of factors weakening the case"]
}`;

    // Prepare photo data for multimodal analysis (limit to 5 most recent photos)
    const recentPhotos = photos.slice(0, 5);
    const messageContent: any[] = [{ type: "text", text: litigationPrompt }];
    
    // Add photos as base64 for visual analysis
    for (const photo of recentPhotos) {
      try {
        if (photo.fileUrl) {
          const filename = photo.fileUrl.split('/').pop();
          const filePath = path.join(uploadDir, filename || '');
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size <= 5 * 1024 * 1024) {
              const fileBuffer = fs.readFileSync(filePath);
              const base64 = fileBuffer.toString('base64');
              const ext = path.extname(filePath).toLowerCase();
              const mimeTypes: Record<string, string> = {
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg'
              };
              const mimeType = mimeTypes[ext] || 'image/jpeg';
              messageContent.push({
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` }
              });
            }
          }
        }
      } catch (imgErr) {
        console.error("Error processing photo for litigation review:", imgErr);
      }
    }

    let analysisResult: any = null;
    
    try {
      if (grokApiKey) {
        const xai = new OpenAI({
          apiKey: grokApiKey,
          baseURL: "https://api.x.ai/v1",
        });
        
        const completion = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [
            { role: "system", content: "You are a legal analyst. Always respond with valid JSON matching the requested format." },
            { role: "user", content: messageContent }
          ],
          max_tokens: 4096,
        });
        
        const responseText = completion.choices[0]?.message?.content || "";
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      } else if (openaiApiKey) {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: "You are a legal analyst. Always respond with valid JSON matching the requested format." },
            { role: "user", content: messageContent }
          ],
          max_tokens: 4096,
        });
        
        const responseText = completion.choices[0]?.message?.content || "";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      }
      
      if (!analysisResult) {
        throw new Error("Failed to parse AI response");
      }
      
      // Store the review
      const review = await storage.createLitigationReview({
        incidentId,
        userId: user.id,
        triggeredBy: triggeredBy || 'user',
        evidenceScore: analysisResult.evidenceScore,
        recommendation: analysisResult.recommendation,
        summary: analysisResult.summary,
        violations: analysisResult.violations,
        timelineAnalysis: analysisResult.timelineAnalysis,
        nextSteps: analysisResult.nextSteps,
        fullAnalysis: analysisResult,
      });
      
      // Cache the result with timeline hash for invalidation
      await storage.setSetting(cacheKey, JSON.stringify({ hash: timelineHash, review }));
      
      res.json(review);
      
    } catch (error: any) {
      console.error("Litigation review error:", error);
      res.status(500).json({ error: error.message || "Failed to generate litigation review" });
    }
  });

  app.get("/api/incidents/:id/litigation-reviews", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const incidentId = parseInt(req.params.id);
    const user = req.user!;
    
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    const reviews = await storage.getLitigationReviewsByIncident(incidentId);
    res.json(reviews);
  });

  // Admin endpoints for PDF exports and litigation reviews
  app.get("/api/admin/pdf-exports", requireAdmin, async (req, res) => {
    const exports = await storage.getRecentPdfExports(50);
    res.json(exports);
  });

  app.get("/api/admin/litigation-stats", requireAdmin, async (req, res) => {
    const pdfExportCount = await storage.getPdfExportCount();
    const litigationReviewCount = await storage.getLitigationReviewCount();
    const strongCaseCount = await storage.getStrongCaseCount();
    
    res.json({
      pdfExports: pdfExportCount,
      litigationReviews: litigationReviewCount,
      strongCases: strongCaseCount,
    });
  });

  // --- Content Management (for editable text) ---
  app.get("/api/content/:key", async (req, res) => {
    try {
      const value = await storage.getSetting(`content_${req.params.key}`);
      // Graceful fallback: avoid 404s for unset CMS keys so clients can safely use
      // their component-level default copy without noisy error responses.
      if (value === undefined) {
        return res.json({ key: req.params.key, value: null, fallback: true });
      }
      return res.json({ key: req.params.key, value, fallback: false });
    } catch (error) {
      // Hard fallback: if storage is temporarily unavailable, keep content reads
      // non-fatal for clients and allow default copy to render.
      console.error("Failed to load content key", req.params.key, error);
      return res.json({ key: req.params.key, value: null, fallback: true, degraded: true });
    }
  });

  app.put("/api/content/:key", requireAdmin, async (req, res) => {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: "value required" });
    await storage.setSetting(`content_${req.params.key}`, value);
    res.json({ key: req.params.key, value });
  });

  // --- Contact Form ---
  app.post("/api/contact", async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: "name, email, and message are required" });
    }
    const contactMessage = await storage.createContactMessage({ name, email, subject: subject || "", message });
    res.status(201).json(contactMessage);
  });

  app.get("/api/admin/contact-messages", requireAdmin, async (req, res) => {
    const messages = await storage.getContactMessages();
    res.json(messages);
  });

  // --- Forum Routes ---
  
  // Public user info for forum (safe fields only)
  app.get("/api/forum/users", async (req, res) => {
    const users = await storage.getAllUsers();
    const trustLevels = await storage.getAllUserTrustLevels();
    const trustMap = new Map(trustLevels.map(t => [t.userId, t]));
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    const safeUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      forumDisplayName: u.forumDisplayName,
      forumBio: u.forumBio,
      avatarUrl: u.avatarUrl,
      showOnlineStatus: u.showOnlineStatus,
      isOnline: u.showOnlineStatus && u.lastActiveAt ? (now - new Date(u.lastActiveAt).getTime()) < fiveMinutes : false,
      trustLevel: trustMap.get(u.id)?.level || 0,
    }));
    res.json(safeUsers);
  });

  // Track user activity for online status
  app.post("/api/forum/heartbeat", requireAuth, async (req, res) => {
    await storage.updateProfile(req.user!.id, { lastActiveAt: new Date() } as any);
    res.json({ ok: true });
  });

  // Categories (public read, admin write)
  app.get("/api/forum/categories", async (req, res) => {
    const categories = await storage.getForumCategories();
    res.json(categories);
  });

  app.get("/api/forum/categories/:id", async (req, res) => {
    const category = await storage.getForumCategory(parseInt(req.params.id));
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  });

  app.post("/api/forum/categories", requireAdmin, async (req, res) => {
    const result = insertForumCategorySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });
    const category = await storage.createForumCategory(result.data);
    res.status(201).json(category);
  });

  app.patch("/api/forum/categories/:id", requireAdmin, async (req, res) => {
    const category = await storage.updateForumCategory(parseInt(req.params.id), req.body);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  });

  app.delete("/api/forum/categories/:id", requireAdmin, async (req, res) => {
    await storage.deleteForumCategory(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Search discussions (title/content/category/author display name)
  app.get("/api/forum/search", async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim() || "";
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    if (!q) {
      return res.json({ posts: [], total: 0, categories: [] });
    }

    const normalizedQ = q.toLowerCase();
    const [{ posts: allPosts }, categories, users] = await Promise.all([
      storage.getForumPosts(undefined, 500, 0),
      storage.getForumCategories(),
      storage.getAllUsers(),
    ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const scored = allPosts
      .map((post) => {
        const category = categoryMap.get(post.categoryId);
        const author = userMap.get(post.authorId);
        const authorName = (author?.forumDisplayName || author?.fullName || author?.username || "").toLowerCase();
        const title = (post.title || "").toLowerCase();
        const content = (post.content || "").toLowerCase();
        const categoryName = (category?.name || "").toLowerCase();

        let score = 0;
        if (title.includes(normalizedQ)) score += 6;
        if (categoryName.includes(normalizedQ)) score += 4;
        if (authorName.includes(normalizedQ)) score += 3;
        if (content.includes(normalizedQ)) score += 2;

        return { post, score, category };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.post.isPinned) - Number(a.post.isPinned) || new Date(b.post.lastActivityAt).getTime() - new Date(a.post.lastActivityAt).getTime());

    const total = scored.length;
    const paged = scored.slice(offset, offset + limit);
    const matchedCategories = scored.reduce<any[]>((acc, x) => {
      if (!x.category) return acc;
      if (!acc.some((c) => c.id === x.category!.id)) acc.push(x.category);
      return acc;
    }, []);

    res.json({
      posts: paged.map((x) => x.post),
      total,
      categories: matchedCategories,
    });
  });

  // Posts
  app.get("/api/forum/posts", async (req, res) => {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const authorId = req.query.authorId ? parseInt(req.query.authorId as string) : undefined;
    const { posts, total } = await storage.getForumPosts(categoryId, limit, offset, authorId);
    res.json({ posts, total });
  });

  app.get("/api/forum/posts/:id", async (req, res) => {
    const post = await storage.getForumPost(parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    // Increment view count
    await storage.incrementPostViewCount(post.id);
    res.json(post);
  });

  // Forum attachment upload
  app.post("/api/forum/upload", requireAuth, uploadForumAttachment.array("files", 10), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const attachments = await Promise.all(files.map(async (file) => {
      const key = `forum/${req.user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const upload = await uploadToR2({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      return {
        url: upload.url,
        name: file.originalname,
        type: file.mimetype,
      };
    }));
    res.json({ attachments });
  });

  app.post("/api/forum/posts", requireAuth, async (req, res) => {
    const result = insertForumPostSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.message });
    const post = await storage.createForumPost({ ...result.data, authorId: req.user!.id });
    res.status(201).json(post);
  });

  app.patch("/api/forum/posts/:id", requireAuth, async (req, res) => {
    const post = await storage.getForumPost(parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    // Only author or admin can edit
    if (post.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const updated = await storage.updateForumPost(post.id, req.body);
    res.json(updated);
  });

  app.delete("/api/forum/posts/:id", requireAuth, async (req, res) => {
    const post = await storage.getForumPost(parseInt(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    // Only author or admin can delete
    if (post.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await storage.deleteForumPost(post.id);
    res.sendStatus(200);
  });

  // Post moderation (admin only)
  app.post("/api/forum/posts/:id/pin", requireAdmin, async (req, res) => {
    const post = await storage.updateForumPost(parseInt(req.params.id), { isPinned: true });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/forum/posts/:id/unpin", requireAdmin, async (req, res) => {
    const post = await storage.updateForumPost(parseInt(req.params.id), { isPinned: false });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/forum/posts/:id/lock", requireAdmin, async (req, res) => {
    const post = await storage.updateForumPost(parseInt(req.params.id), { isLocked: true });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/forum/posts/:id/unlock", requireAdmin, async (req, res) => {
    const post = await storage.updateForumPost(parseInt(req.params.id), { isLocked: false });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  app.post("/api/forum/posts/:id/move", requireAdmin, async (req, res) => {
    const { categoryId } = req.body;
    if (!categoryId) return res.status(400).json({ error: "categoryId required" });
    const post = await storage.updateForumPost(parseInt(req.params.id), { categoryId });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  });

  // Replies
  app.get("/api/forum/posts/:postId/replies", async (req, res) => {
    const replies = await storage.getForumReplies(parseInt(req.params.postId));
    res.json(replies);
  });

  app.post("/api/forum/posts/:postId/replies", requireAuth, async (req, res) => {
    const post = await storage.getForumPost(parseInt(req.params.postId));
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.isLocked && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Post is locked" });
    }
    const result = insertForumReplySchema.safeParse({ ...req.body, postId: post.id });
    if (!result.success) return res.status(400).json({ error: result.error.message });
    const reply = await storage.createForumReply({ ...result.data, authorId: req.user!.id });
    res.status(201).json(reply);
  });

  app.patch("/api/forum/replies/:id", requireAuth, async (req, res) => {
    const reply = await storage.getForumReply(parseInt(req.params.id));
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    if (reply.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const updated = await storage.updateForumReply(reply.id, req.body);
    res.json(updated);
  });

  app.delete("/api/forum/replies/:id", requireAuth, async (req, res) => {
    const reply = await storage.getForumReply(parseInt(req.params.id));
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    if (reply.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await storage.deleteForumReply(reply.id);
    res.sendStatus(200);
  });

  app.post("/api/forum/replies/:id/accept", requireAuth, async (req, res) => {
    const reply = await storage.getForumReply(parseInt(req.params.id));
    if (!reply) return res.status(404).json({ error: "Reply not found" });
    const post = await storage.getForumPost(reply.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    // Only post author or admin can mark as accepted
    if (post.authorId !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const updated = await storage.updateForumReply(reply.id, { isAcceptedAnswer: true });
    res.json(updated);
  });

  // Get replies by user
  app.get("/api/forum/replies/user/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId);
    const replies = await storage.getForumRepliesByUser(userId);
    res.json(replies);
  });

  // Reactions
  app.get("/api/forum/posts/:id/reactions", async (req, res) => {
    const reactions = await storage.getForumReactions(parseInt(req.params.id), undefined);
    res.json(reactions);
  });

  app.get("/api/forum/replies/:id/reactions", async (req, res) => {
    const reactions = await storage.getForumReactions(undefined, parseInt(req.params.id));
    res.json(reactions);
  });

  app.post("/api/forum/posts/:id/react", requireAuth, async (req, res) => {
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: "type required" });
    const added = await storage.toggleForumReaction(req.user!.id, parseInt(req.params.id), null, type);
    res.json({ added });
  });

  app.post("/api/forum/replies/:id/react", requireAuth, async (req, res) => {
    const { type } = req.body;
    if (!type) return res.status(400).json({ error: "type required" });
    const added = await storage.toggleForumReaction(req.user!.id, null, parseInt(req.params.id), type);
    res.json({ added });
  });

  // Bookmarks
  app.get("/api/forum/bookmarks", requireAuth, async (req, res) => {
    const bookmarks = await storage.getForumBookmarks(req.user!.id);
    res.json(bookmarks);
  });

  app.post("/api/forum/posts/:id/bookmark", requireAuth, async (req, res) => {
    const added = await storage.toggleForumBookmark(req.user!.id, parseInt(req.params.id));
    res.json({ added });
  });

  // User trust levels
  app.get("/api/forum/users/:id/trust-level", async (req, res) => {
    const trustLevel = await storage.getUserTrustLevel(parseInt(req.params.id));
    res.json(trustLevel || { level: 0, postCount: 0, replyCount: 0, likesReceived: 0 });
  });

  // User moderation (admin only)
  app.post("/api/forum/users/:id/ban", requireAdmin, async (req, res) => {
    const { reason } = req.body;
    const updated = await storage.updateUserTrustLevel(parseInt(req.params.id), { isBanned: true, banReason: reason || null });
    res.json(updated);
  });

  app.post("/api/forum/users/:id/unban", requireAdmin, async (req, res) => {
    const updated = await storage.updateUserTrustLevel(parseInt(req.params.id), { isBanned: false, banReason: null });
    res.json(updated);
  });

  app.post("/api/forum/users/:id/make-moderator", requireAdmin, async (req, res) => {
    const updated = await storage.updateUserTrustLevel(parseInt(req.params.id), { isModerator: true });
    res.json(updated);
  });

  app.post("/api/forum/users/:id/remove-moderator", requireAdmin, async (req, res) => {
    const updated = await storage.updateUserTrustLevel(parseInt(req.params.id), { isModerator: false });
    res.json(updated);
  });

  // --- Admin Routes ---
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    // Remove passwords from response
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
  });

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });
    await storage.setSetting(key, value);
    res.sendStatus(200);
  });

  app.delete("/api/admin/settings/:key", requireAdmin, async (req, res) => {
    const { key } = req.params;
    await storage.deleteSetting(key);
    res.sendStatus(200);
  });

  // Admin user management routes
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { username, password, fullName, email, phone, isAdmin } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPwd = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPwd,
        isAdmin: isAdmin || false,
        fullName: fullName || null,
        email: email || null,
        phone: phone || null,
      } as any);

      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { username, fullName, email, phone, address, unitNumber, rentalAgency, 
              propertyManagerName, propertyManagerPhone, propertyManagerEmail, isAdmin } = req.body;
      
      // Check username collision if changing username
      if (username !== undefined) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      
      const updates: any = {};
      if (username !== undefined) updates.username = username;
      if (fullName !== undefined) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (unitNumber !== undefined) updates.unitNumber = unitNumber;
      if (rentalAgency !== undefined) updates.rentalAgency = rentalAgency;
      if (propertyManagerName !== undefined) updates.propertyManagerName = propertyManagerName;
      if (propertyManagerPhone !== undefined) updates.propertyManagerPhone = propertyManagerPhone;
      if (propertyManagerEmail !== undefined) updates.propertyManagerEmail = propertyManagerEmail;
      if (isAdmin !== undefined) updates.isAdmin = isAdmin;

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as User;
      
      // Prevent deleting yourself
      if (currentUser.id === id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await storage.deleteUserWithAllData(id);
      res.sendStatus(200);
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const user = await storage.updateUserStatus(id, status);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.patch("/api/admin/users/:id/password", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { password } = req.body;
      
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const hashedPwd = await hashPassword(password);
      const user = await storage.updateUserPassword(id, hashedPwd);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ message: "Password updated" });
    } catch (err) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/admin/users/:id/stats", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const stats = await storage.getUserStats(id);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to get user stats" });
    }
  });

  app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const validDays = [7, 30, 90].includes(days) ? days : 30;
      const [analytics, pdfExports, litigationReviews, strongCases] = await Promise.all([
        storage.getAnalytics(validDays),
        storage.getPdfExportCount(),
        storage.getLitigationReviewCount(),
        storage.getStrongCaseCount(),
      ]);
      res.json({
        analytics,
        litigationStats: { pdfExports, litigationReviews, strongCases },
      });
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).json({ error: "Failed to get dashboard data" });
    }
  });

  // Admin analytics endpoint
  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const validDays = [7, 30, 90].includes(days) ? days : 30;
      const analytics = await storage.getAnalytics(validDays);
      res.json(analytics);
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // Bulk update user status
  app.post("/api/admin/users/bulk-status", requireAdmin, async (req, res) => {
    try {
      const { userIds, status } = req.body;
      if (!Array.isArray(userIds) || !status) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      // Validate status is one of allowed values
      if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value. Must be 'active' or 'suspended'" });
      }
      
      // Filter out the current admin user to prevent self-modification
      const currentUserId = (req.user as User)?.id;
      const safeUserIds = userIds.filter(id => id !== currentUserId);
      
      for (const id of safeUserIds) {
        await storage.updateUserStatus(id, status);
      }
      
      res.json({ success: true, updated: safeUserIds.length });
    } catch (err) {
      console.error("Bulk status update error:", err);
      res.status(500).json({ error: "Failed to update user statuses" });
    }
  });

  // Bulk delete users
  app.post("/api/admin/users/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds)) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      // Filter out the current admin user to prevent self-deletion
      const currentUserId = (req.user as User)?.id;
      const safeUserIds = userIds.filter(id => id !== currentUserId);
      
      for (const id of safeUserIds) {
        await storage.deleteUserWithAllData(id);
      }
      
      res.json({ success: true, deleted: safeUserIds.length });
    } catch (err) {
      console.error("Bulk delete error:", err);
      res.status(500).json({ error: "Failed to delete users" });
    }
  });

  return httpServer;
}

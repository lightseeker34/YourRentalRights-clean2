import type { Express } from "express";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { storage } from "../storage";
import { assembleContextTwoPasses, formatStructuredTimelineForPrompt, formatEvidenceTimeline, formatPhotoList, formatTimelineForPrompt, formatPhotoListForPrompt, buildUserContext, buildIncidentContext, computeTimelineHash } from "../ai-context";
import { requireAdmin } from "../middleware/auth";
import { uploadDir } from "../uploads";

export function registerAiRoutes(app: Express) {
  // --- AI Agent Endpoint ---
  app.post("/api/chat", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { message, incidentId, attachedImages } = req.body;
    const user = req.user!;
    
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    
    await storage.addLog({
      incidentId,
      type: "chat",
      content: message,
      isAi: false,
      metadata: attachedImages ? { attachedImages } : undefined,
    });

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

    const systemPrompt = await storage.getSetting("ai_system_prompt");
    const grokApiKey = await storage.getSetting("grok_api_key");
    const openaiApiKey = await storage.getSetting("openai_api_key");

    const userContext = buildUserContext(user);
    const incidentContext = buildIncidentContext(incident);

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

      if (grokApiKey) {
        const xai = new OpenAI({ apiKey: grokApiKey, baseURL: "https://api.x.ai/v1" });
        const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: message }];

        if (attachedImages && Array.isArray(attachedImages)) {
          for (const imageUrl of attachedImages) {
            try {
              if (imageUrl.startsWith('/api/evidence/') || imageUrl.startsWith('/api/uploads/')) {
                const filename = imageUrl.split('/').pop();
                const filePath = path.join(uploadDir, filename || '');
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  if (stats.size > 5 * 1024 * 1024) continue;
                  const fileBuffer = fs.readFileSync(filePath);
                  const base64 = fileBuffer.toString('base64');
                  const ext = path.extname(filePath).toLowerCase();
                  const mimeType = imageMimeTypes[ext];
                  if (!mimeType) continue;
                  messageContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
                }
              } else if (imageUrl.startsWith('http') && isImageUrl(imageUrl)) {
                messageContent.push({ type: "image_url", image_url: { url: imageUrl } });
              }
            } catch (imgErr) {
              console.error("Error processing image for AI:", imgErr);
            }
          }
        }

        const chatHistory = allLogs.filter((l: any) => l.type === 'chat').slice(-10).map((l: any) => ({ role: l.isAi ? "assistant" as const : "user" as const, content: l.content }));

        const completion = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [{ role: "system", content: fullSystemPromptPass1 }, ...chatHistory, { role: "user", content: messageContent }],
          max_tokens: 4096,
        });

        aiResponse = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response. Please try again.";

        const backfillDecision = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [
            { role: "system", content: "Return ONLY valid JSON with this schema: {\"needs_backfill\": boolean, \"reason\": string}. Set needs_backfill=true only if older routine logs are required to answer reliably." },
            { role: "user", content: `Question: ${message}\n\nDraft answer: ${aiResponse}` }
          ],
          max_tokens: 120,
        });

        const needsBackfill = parseBackfillDecision(backfillDecision.choices[0]?.message?.content || "");
        if (needsBackfill) {
          const completionPass2 = await xai.chat.completions.create({
            model: "grok-4-1-fast-reasoning",
            messages: [{ role: "system", content: fullSystemPromptPass2 }, ...chatHistory, { role: "user", content: messageContent }],
            max_tokens: 4096,
          });
          aiResponse = completionPass2.choices[0]?.message?.content || aiResponse;
        }
      } else if (openaiApiKey) {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const messageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: message }];

        if (attachedImages && Array.isArray(attachedImages)) {
          for (const imageUrl of attachedImages) {
            try {
              if (imageUrl.startsWith('/api/evidence/') || imageUrl.startsWith('/api/uploads/')) {
                const filename = imageUrl.split('/').pop();
                const filePath = path.join(uploadDir, filename || '');
                if (fs.existsSync(filePath)) {
                  const stats = fs.statSync(filePath);
                  if (stats.size > 5 * 1024 * 1024) continue;
                  const fileBuffer = fs.readFileSync(filePath);
                  const base64 = fileBuffer.toString('base64');
                  const ext = path.extname(filePath).toLowerCase();
                  const mimeType = imageMimeTypes[ext];
                  if (!mimeType) continue;
                  messageContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
                }
              } else if (imageUrl.startsWith('http') && isImageUrl(imageUrl)) {
                messageContent.push({ type: "image_url", image_url: { url: imageUrl } });
              }
            } catch (imgErr) {
              console.error("Error processing image for AI:", imgErr);
            }
          }
        }

        const chatHistory = allLogs.filter((l: any) => l.type === 'chat').slice(-10).map((l: any) => ({ role: l.isAi ? "assistant" as const : "user" as const, content: l.content }));

        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          messages: [{ role: "system", content: fullSystemPromptPass1 }, ...chatHistory, { role: "user", content: messageContent }],
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
                properties: { needs_backfill: { type: "boolean" }, reason: { type: "string" } },
                required: ["needs_backfill", "reason"]
              }
            }
          },
          messages: [
            { role: "system", content: "Decide if older routine logs are required for a reliable answer." },
            { role: "user", content: `Question: ${message}\n\nDraft answer: ${aiResponse}` }
          ],
          max_tokens: 120,
        });

        const needsBackfill = parseBackfillDecision(backfillDecision.choices[0]?.message?.content || "");
        if (needsBackfill) {
          const completionPass2 = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [{ role: "system", content: fullSystemPromptPass2 }, ...chatHistory, { role: "user", content: messageContent }],
            max_tokens: 4096,
          });
          aiResponse = completionPass2.choices[0]?.message?.content || aiResponse;
        }
      } else {
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

    const aiLog = await storage.addLog({ incidentId, type: "chat", content: aiResponse, isAi: true });
    res.json(aiLog);
  });

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

  app.post("/api/incidents/:id/litigation-review", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const incidentId = parseInt(req.params.id);
    const user = req.user!;
    const { triggeredBy } = req.body;
    const incident = await storage.getIncident(incidentId);
    if (!incident) return res.sendStatus(404);
    if (incident.userId !== user.id && !user.isAdmin) return res.sendStatus(403);
    const incidentOwner = await storage.getUser(incident.userId);
    if (!incidentOwner) return res.sendStatus(404);
    const allLogs = await storage.getLogsByIncident(incidentId);

    const timelineHash = computeTimelineHash(allLogs);
    const cacheKey = `litigation_cache_${incidentId}`;
    const cachedRaw = await storage.getSetting(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.hash === timelineHash && cached.review) return res.json({ ...cached.review, cached: true });
      } catch {}
    }

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

    const evidenceTimeline = formatEvidenceTimeline(allLogs);
    const photos = formatPhotoList(allLogs);
    const caseDurationDays = Math.floor((Date.now() - new Date(allLogs.length > 0 ? allLogs[0].createdAt : incident.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const grokApiKey = await storage.getSetting("grok_api_key");
    const openaiApiKey = await storage.getSetting("openai_api_key");

    if (!grokApiKey && !openaiApiKey) {
      return res.status(400).json({ error: "No AI API key configured. Please add your Grok or OpenAI API key in the admin panel." });
    }

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
2. **Code Violations**: Based on the property location, identify specific housing code violations that may apply.
3. **Evidence Strength**: Assess the quality and completeness of documentation.
4. **Landlord Response Pattern**: Evaluate acknowledgment, promised repairs, retaliation, and responsiveness.
5. **Litigation Recommendation**: STRONG / MODERATE / WEAK.

## REQUIRED OUTPUT FORMAT
Provide your response in this exact JSON format:
{
  "summary": "2-3 sentence executive summary of the case",
  "evidenceScore": <number 1-10>,
  "recommendation": "strong" | "moderate" | "weak",
  "violations": [{ "code": "Specific code or law citation", "description": "What the violation is", "severity": "high" | "medium" | "low" }],
  "timelineAnalysis": "Analysis of the timeline and landlord response patterns",
  "nextSteps": ["Specific actionable step 1", "Specific actionable step 2", "Specific actionable step 3"],
  "strengthFactors": ["List of factors strengthening the case"],
  "weaknessFactors": ["List of factors weakening the case"]
}`;

    const recentPhotos = photos.slice(0, 5);
    const messageContent: any[] = [{ type: "text", text: litigationPrompt }];

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
              const mimeTypes: Record<string, string> = { '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
              const mimeType = mimeTypes[ext] || 'image/jpeg';
              messageContent.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } });
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
        const xai = new OpenAI({ apiKey: grokApiKey, baseURL: "https://api.x.ai/v1" });
        const completion = await xai.chat.completions.create({
          model: "grok-4-1-fast-reasoning",
          messages: [
            { role: "system", content: "You are a legal analyst. Always respond with valid JSON matching the requested format." },
            { role: "user", content: messageContent }
          ],
          max_tokens: 4096,
        });
        const responseText = completion.choices[0]?.message?.content || "";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0]);
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
        if (jsonMatch) analysisResult = JSON.parse(jsonMatch[0]);
      }

      if (!analysisResult) throw new Error("Failed to parse AI response");

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
}

# AI Route Extraction Planning Pass

## Goal

Continue the behavior-preserving backend cleanup by extracting the remaining AI/litigation/export concerns out of `server/routes.ts` without changing API contracts, storage schema, or frontend expectations.

## Answer to the core question

This pass should **not require recreating the backend**.

The intent is:
- keep the same endpoints
- keep the same request/response shapes
- keep the same DB/storage calls
- keep the same auth/ownership rules
- keep the same settings keys / cache keys
- keep frontend behavior unchanged

So this is primarily a **cleanup + reorganization pass**.

Possible small internal extractions may happen if they reduce duplication safely, for example:
- AI provider helper(s)
- image attachment helper(s)
- shared incident ownership check helper(s)
- prompt-builder/helper utilities

But those are internal seams, not a backend rebuild.

## Current AI-adjacent scope still inside `server/routes.ts`

### Incident/user-facing
- `POST /api/chat`
- `POST /api/incidents/:id/pdf-export`
- `GET /api/incidents/:id/pdf-exports`
- `POST /api/incidents/:id/litigation-review`
- `GET /api/incidents/:id/litigation-reviews`

### Admin-facing
- `GET /api/admin/pdf-exports`
- `GET /api/admin/litigation-stats`

## What is mixed together right now

The current file combines several concerns in one place:
- route registration
- auth/ownership checks
- prompt construction
- chat-history assembly
- image file loading/base64 conversion
- provider selection (Grok vs OpenAI)
- response parsing
- litigation cache handling
- storage persistence

That makes it a good extraction target, but also means the safest move is to separate concerns in thin layers rather than rewrite logic.

## Recommended extraction shape

### Option A (preferred): one route module + small helpers

Add:
- `server/routes/ai.ts`
- optionally `server/lib/ai-provider.ts`
- optionally `server/lib/ai-images.ts`
- optionally `server/lib/incident-access.ts`

Responsibilities:
- `routes/ai.ts`
  - registers the existing endpoints
  - preserves route paths exactly
  - keeps responses exactly as they are now
- helper libs
  - isolate duplicated provider calls / image conversion / ownership checks
  - no behavior changes

This is the least disruptive next step.

### Option B: split by feature slice

Add:
- `server/routes/chat.ts`
- `server/routes/litigation.ts`
- `server/routes/pdf-exports.ts`

This is cleaner long-term, but a bit more movement for the next pass. Better after Option A if we want further decomposition.

## Safest execution plan

1. **Extract route registration only first**
   - move the existing AI/litigation/export route bodies into `server/routes/ai.ts`
   - keep most internal logic verbatim initially
   - wire `registerAiRoutes(app)` from `server/routes.ts`

2. **Run validation**
   - `npm run check`
   - `npm run build`

3. **Only after green build, consider internal dedupe**
   - shared image attachment helper
   - shared provider-call wrapper
   - shared incident ownership loader/check

4. **Re-validate**
   - `npm run check`
   - `npm run build`

## Specific duplication worth isolating later

### Shared image handling
Duplicated in chat and litigation review:
- local upload path resolution
- file size guard
- MIME detection
- base64 conversion
- image message payload construction

### Shared provider selection
Duplicated in chat and litigation review:
- load Grok/OpenAI keys
- prefer Grok when configured
- fallback to OpenAI
- normalize missing-key behavior

### Shared incident access guard
Repeated pattern:
- load incident by id
- 404 if missing
- 403 if not owner/admin

## Non-goals for this pass

Do **not** change unless strictly necessary:
- database schema
- storage interface shape
- endpoint URLs
- auth behavior
- AI prompts/content logic
- response JSON structure
- admin UI expectations
- frontend API calls

## Risk notes

The high-risk areas are:
- multimodal image payload formatting
- subtle differences between Grok/OpenAI request formats
- litigation JSON parsing / caching
- exact chat response persistence behavior

So the extraction should be mostly move-first, clean-second.

## Recommended next implementation step

Create `server/routes/ai.ts` and move these endpoints into it:
- chat
- pdf export tracking
- litigation review
- related admin stats endpoints

Then register it from `server/routes.ts` and validate.

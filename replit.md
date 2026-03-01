# replit.md

## Overview

YourRentalRights.com is a tenant advocacy platform that helps renters document issues with landlords, identify legal violations, and generate formal demand letters. The application enables users to create incident reports, log evidence (photos, communications, notes), and potentially leverage AI to analyze their situation against housing laws. It's designed to give individual renters the same legal leverage as large property management companies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state, with custom auth context for user session
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom slate-based color palette for professional look
- **Animation**: Framer Motion for page transitions and micro-interactions

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Pattern**: RESTful JSON API with `/api/*` endpoints
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Security**: scrypt hashing with timing-safe comparison
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL (via Neon serverless or standard pg)
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Design**:
  - `users` - User accounts with profile info (name, phone, address, rental agency)
  - `incidents` - User-reported issues with title, description, status
  - `incidentLogs` - Evidence entries per incident (chat, photos, documents) with AI flag
  - `appSettings` - Key-value store for app configuration (API keys, etc.)

### Build System
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: esbuild bundles server to CommonJS, Vite builds client to `dist/public`
- **TypeScript**: Strict mode with path aliases (`@/` for client, `@shared/` for shared code)

### Key Design Decisions
1. **Shared Schema**: Database types defined once in `shared/schema.ts`, used by both client and server via Zod schemas
2. **Protected Routes**: Client-side route guards redirect unauthenticated users to `/auth`
3. **Admin Panel**: Separate admin interface for managing users and API keys (stored in appSettings table)
4. **Glass Morphism UI**: Custom CSS variables for translucent card backgrounds matching design specs
5. **First User Admin**: The first user to register automatically becomes an admin
6. **Editable Content**: Admin users can edit text content on the site by hovering over editable areas and clicking the pencil icon. Content is stored in `appSettings` with `content_` prefix.
7. **Incident Management**: Edit button between status toggle and delete to modify title/description. Four log types (Call, Text, Email, Service Request) with notes and optional photo attachment. Photos categorized by interaction type (call_photo, text_photo, email_photo, service_photo) in metadata.
8. **Dashboard Timeline**: Horizontal scrolling layout with vertical sub-entry stacks per incident. Master bubble shows Open/Closed status.
9. **PDF Export**: jsPDF-based hierarchical export with embedded images, evidence timeline, and AI chat history. Available from incident view sidebar.
10. **Case Templates**: Pre-built templates for common tenant issues (heating, mold, security, pests, lease violations, noise) available on resources page with login requirement.
11. **Admin Analytics**: Dashboard showing platform overview, forum activity, and 30-day trends for users/cases.
12. **User Activity Monitoring**: Online status indicators (green dot if active within 5 minutes), relative time formatting, avatar display in admin user table.
13. **Bulk User Management**: Checkbox selection with bulk actions (activate, suspend, delete) and confirmation dialogs for destructive operations.
14. **Database Indexing**: Performance indexes on incidents, incident_logs, and forum tables for improved query speed.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Neon Serverless**: Optional serverless PostgreSQL driver (`@neondatabase/serverless`)

### Authentication
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **passport / passport-local**: Authentication strategies

### AI/LLM Integration
- **xAI Grok**: Primary AI using grok-4-1-fast-reasoning model via OpenAI SDK compatibility (baseURL: https://api.x.ai/v1)
- **OpenAI**: Fallback to GPT-4o if no Grok API key configured
- **Multimodal Vision**: Supports sending images as base64-encoded data URLs for AI analysis (local files converted to base64, external URLs passed directly)
- **RAG Context Pipeline**: Each chat includes user profile, incident details, and all evidence logs. Shared `server/ai-context.ts` module provides deterministic formatting (ISO dates, stable sort by timestamp+id, structured labels) used by both chat and litigation endpoints.
- **Litigation Cache**: Litigation review results are cached in appSettings with a SHA-256 hash of the timeline data; cache auto-invalidates when evidence changes.
- **Chat Attachments**: Users can attach photos to chat messages (upload new or pick from evidence)
- **Chat Edit**: User messages can be edited after sending
- API keys stored in `appSettings` table, managed via admin panel (grok_api_key, openai_api_key)

### Frontend Libraries
- **@tanstack/react-query**: Data fetching and caching
- **@radix-ui/***: Accessible UI primitives
- **framer-motion**: Animations
- **react-hook-form + zod**: Form handling with validation
- **date-fns**: Date formatting

### Build Tools
- **Vite**: Frontend bundler with React plugin
- **esbuild**: Server bundler for production
- **drizzle-kit**: Database migrations (`db:push` script)

### Severity / Criticality Tagging
- **Severity Levels**: `critical`, `important`, `routine` — stored in `metadata.severity` JSONB field on incident_logs
- **Default Mapping**: Each log type has a default severity (e.g., calls → important, notes → routine). Users can override when creating entries.
- **Shared Types**: `SEVERITY_LEVELS`, `SeverityLevel`, `DEFAULT_SEVERITY_BY_TYPE`, `getLogSeverity()` defined in `shared/schema.ts`
- **UI**: Severity selector buttons in Call/Text/Email log dialogs; severity badges (Critical/Important) shown on timeline entries

### Two-Pass Context Assembly
- **Purpose**: Ensures AI never misses critical evidence while staying within token limits
- **Pass 1**: Always includes all `critical` and `important` entries + entries from the last 14 days
- **Pass 2**: Backfills up to 50 older `routine` entries for historical context
- **Structured Timeline**: `StructuredTimelineEntry` objects with `{id, date, type, severity, description, attachments, hasFile}` instead of plain text
- **Implementation**: `assembleContextTwoPasses()` in `server/ai-context.ts`
- **Cache Invalidation**: Timeline hash now includes severity in the hash payload, so changing an entry's severity invalidates the cache
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { appSettings, forumCategories, forumPosts, users } from "../shared/schema";

type Topic = {
  title: string;
  content: string;
  pinned?: boolean;
};

type CategorySeed = {
  name: string;
  legacyNames?: string[];
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  topics: Topic[];
};

export const starterCategories: CategorySeed[] = [
  {
    name: "Legal & Lease Defense",
    legacyNames: ["⚖️ Legal & Lease Defense"],
    description: "Lease clauses, deposits, eviction defenses, legal process, and tenant-rights counsel.",
    icon: "Scale",
    color: "#334155",
    sortOrder: 0,
    topics: [
      { title: "The \"Illegal Clause\" Megathread: Common lease terms that aren't actually enforceable in court", content: "Share lease clauses that looked scary but were invalid or unenforceable in your state. Include state, clause text, and outcome so others can learn fast." },
      { title: "Security Deposit Recovery: How to get your money back (step-by-step guides by state)", content: "Post deposit return timelines, demand letter templates, and what worked in your state or county. Include evidence that helped your case." },
      { title: "Small Claims 101: Filing procedures and local limits", content: "State-by-state filing basics, fee ranges, service rules, and practical court prep tips. Add your county limit if you know it." },
      { title: "Constructive Eviction: When a home becomes uninhabitable and what your legal exits are", content: "Discuss when conditions become legally unlivable, required notice language, and safe move-out strategy." },
      { title: "Attorney Recommendations: Tenant-rights lawyers and Legal Aid", content: "Crowdsourced recommendations for tenant-rights attorneys, legal clinics, and Legal Aid offices. Include location and case type." },
      { title: "Know Your Limits: A State-by-State Guide to Small Claims", content: `## Why this is pinned\nSmall claims is one of the fastest paths to enforce tenant rights, but limits and procedures vary by state and county. This thread is the quick-reference index for dollar limits, filing links, and court prep.\n\n## What to post (template)\n- **State / County:**\n- **Current claim limit:**\n- **Where to file (official link):**\n- **Filing fee range:**\n- **Service of process options:**\n- **Typical timeline to hearing:**\n- **Appeal window:**\n\n## Before you file\n1. Send a written demand letter with deadline.\n2. Organize evidence (photos, videos, receipts, communications).\n3. Build a date-by-date timeline.\n4. Calculate damages clearly (deposit, repairs, temporary housing, etc.).\n5. Verify your local limit and venue rules.\n\n## Reminder\nThis is community-shared guidance, not legal advice. Always verify with your local court website before filing.`, pinned: true },
    ],
  },
  {
    name: "Health, Air Quality & Safety",
    legacyNames: ["🌬️ Health, Air Quality & Safety"],
    description: "Mold, HVAC, VOCs, pests, hazardous materials, and home habitability concerns.",
    icon: "ShieldAlert",
    color: "#0f766e",
    sortOrder: 1,
    topics: [
      { title: "The Mold Protocol: Professional remediation vs. \"landlord specials\"", content: "Compare true remediation steps against cosmetic cover-ups like bleach + paint. Share lab reports, moisture readings, and follow-up outcomes." },
      { title: "Air Quality Testing: Recommended DIY kits vs. professional inspections for VOCs and spores", content: "Share the kits, labs, and inspectors you used plus what results were actionable for repairs, lease termination, or court." },
      { title: "HVAC Rights: Humidity tracking, temperature requirements, and when a system is legally \"failed\"", content: "Post temp/humidity logs, city code references, and repair timeline evidence that successfully forced action." },
      { title: "Lead, Radon & Asbestos: Disclosure laws for older builds and how to test safely", content: "Discuss legal disclosure requirements, safe testing methods, and remediation options by region." },
      { title: "Pest Control Accountability: Who pays for treatments and what constitutes a major infestation", content: "Share lease language, municipal rules, and evidence standards that clarified landlord vs. tenant responsibility." },
      { title: "How to Document a Habitability Issue (The 4-Step Process)", content: `## Why this is pinned\nStrong documentation is the difference between "my word vs theirs" and a case you can actually win. Use this 4-step process every time.\n\n## Step 1: Measure + Capture\n- Take clear photos/video (wide + close-up).\n- Capture objective readings when possible (humidity, temperature, air quality, moisture meter).\n- Include date/time and location in each file name.\n\n## Step 2: Written Notice\n- Send repair requests in writing (email + portal + certified mail when serious).\n- State the issue, impact on habitability, and requested action deadline.\n- Keep copies of every message and delivery receipt.\n\n## Step 3: Timeline Follow-Up\n- Keep a daily log of symptoms, outages, costs, and landlord responses.\n- Record each missed deadline and attempted access/repair visit.\n- Save receipts for filters, dehumidifiers, lodging, and damaged property.\n\n## Step 4: Escalation Path\n- If unresolved: code enforcement/health department, legal aid, or private counsel.\n- Prepare an evidence packet: timeline + notices + media + receipts + witness notes.\n\n## Quick checklist\n- [ ] Photos/videos organized\n- [ ] Written notice sent\n- [ ] Follow-up log maintained\n- [ ] Escalation contacts ready`, pinned: true },
    ],
  },
  {
    name: "The Evidence Locker (Documentation)",
    legacyNames: ["📸 The Evidence Locker (Documentation)"],
    description: "Paper trails, repair notices, photo/video evidence, and communication logs.",
    icon: "FolderArchive",
    color: "#7c3aed",
    sortOrder: 2,
    topics: [
      { title: "Certified Mail & The Paper Trail: Why you should stop using the phone and start using the post office", content: "Template wording and mailing workflows that create proof of notice. Include what receipts and scans to keep." },
      { title: "The Move-In/Move-Out Video Guide: Exactly what to film to prevent \"wear and tear\" scams", content: "Shot list, pacing, narration tips, and metadata practices that make video evidence usable in disputes." },
      { title: "Repair Request Templates: Form letters that start the legal \"repair clock\"", content: "Share request templates by issue type and jurisdiction, with examples that got fast responses." },
      { title: "Communication Logs: Apps and methods for documenting every interaction with management", content: "Tools and methods to keep accurate timelines for calls, emails, portal tickets, and in-person conversations." },
      { title: "Start Here: The Tenant's Rights First-Aid Kit", content: `## Why this is pinned\nIf you're here in crisis mode, start with this checklist first. The goal is to protect your health, your money, and your legal position in the next 24 hours.\n\n## First 24-hour checklist\n1. **Stabilize safety first**\n   - If immediate danger exists (gas leak, fire risk, no heat in severe weather), call emergency services.\n2. **Document everything**\n   - Photos/video, timestamps, readings, receipts, and a running incident log.\n3. **Notify landlord in writing**\n   - Use clear issue description + requested remedy + deadline.\n4. **Create your paper trail**\n   - Keep all emails, portal tickets, texts, and certified mail receipts.\n5. **Know your local rules**\n   - Check repair timelines, habitability standards, and deposit laws for your state/city.\n\n## What to include when asking the community for help\n- State/city\n- Issue type (mold, HVAC, water leak, pests, deposit, etc.)\n- Timeline of events\n- What notices you've already sent\n- What outcome you need\n\n## You are not alone\nThis forum is built to help renters move from panic to a plan. Ask questions, share updates, and we’ll help you map next steps.`, pinned: true },
    ],
  },
  {
    name: "The Wall of Shame & Reviews",
    legacyNames: ["🏢 The Wall of Shame & Reviews"],
    description: "Property management experiences, red flags, and lease-break outcomes.",
    icon: "Building2",
    color: "#b45309",
    sortOrder: 3,
    topics: [
      { title: "Property Management Reviews: Honest experiences with corporate landlords", content: "Share factual reviews of management groups and PM companies. Include timelines, evidence, and resolution details." },
      { title: "Red Flags During Tours: Hidden signs of water damage, ozone machines, and structural neglect", content: "Checklist of warning signs to spot before signing a lease." },
      { title: "Lease Break Success Stories: How users exited predatory contracts without a credit hit", content: "Document strategies that worked: legal notices, negotiated exits, replacement tenants, and evidence packages." },
    ],
  },
  {
    name: "Renter-Friendly Maintenance",
    legacyNames: ["🛠️ Renter-Friendly Maintenance"],
    description: "DIY mitigation, emergency steps, and move-out restoration tips.",
    icon: "Wrench",
    color: "#2563eb",
    sortOrder: 4,
    topics: [
      { title: "DIY Humidity Control: Using dehumidifiers and hygrometers to protect your belongings", content: "Recommended setups, target ranges, and low-cost monitoring methods for moisture-prone units." },
      { title: "Emergency Repairs: What to do at 2 AM when a pipe bursts and maintenance is MIA", content: "Safety-first triage checklist, emergency contacts, and evidence steps to protect yourself legally." },
      { title: "Corsi-Rosenthal Boxes: Building cheap, high-efficiency air purifiers for poor ventilation", content: "Build guides, parts lists, and practical use cases for renters dealing with poor indoor air quality." },
      { title: "Restoring Your Home: Reversing renter-friendly DIYs before moving out", content: "Move-out prep tips to avoid damage claims while restoring common renter modifications." },
    ],
  },
  {
    name: "Community & Advocacy",
    legacyNames: ["🤝 Community & Advocacy"],
    description: "Organizing, policy updates, local resources, and collective tenant support.",
    icon: "Users",
    color: "#059669",
    sortOrder: 5,
    topics: [
      { title: "Tenant Union Organizing: How to find or start an association in your building or city", content: "Practical organizing playbook: outreach, meeting cadence, bylaws, and legal guardrails." },
      { title: "Legislative Watch: Updates on new rental laws, rent caps, and just-cause eviction bills", content: "Track policy changes by state and city. Share sources and explain renter impact." },
      { title: "Local Resource Map: Rent assistance, food banks, and moving help", content: "Curate location-specific support programs and emergency resources with eligibility notes." },
    ],
  },
  {
    name: "Eviction & Court Response",
    legacyNames: ["⚠️ Eviction & Court Response"],
    description: "Notice triage, court deadlines, hearing prep, and post-judgment options.",
    icon: "Gavel",
    color: "#dc2626",
    sortOrder: 6,
    topics: [
      { title: "Notice Triage: Pay-or-quit, cure-or-quit, and unconditional notices", content: "Break down what each notice means, what deadlines matter, and immediate do/don't steps." },
      { title: "Answering an Eviction Filing: What to file and by when", content: "Share state-specific answer forms, filing links, fee waiver options, and timing pitfalls." },
      { title: "Hearing Prep Pack: Evidence checklist and courtroom strategy", content: "Witness prep, exhibit organization, timeline format, and practical day-of-hearing tips." },
      { title: "After Judgment: Stays, appeals, payment plans, and move-out planning", content: "What options may still exist after a judgment and how to minimize long-term damage." },
    ],
  },
  {
    name: "Money, Fees & Credit Impact",
    legacyNames: ["💰 Money, Fees & Credit Impact"],
    description: "Rent ledgers, late fees, collections disputes, and protecting your credit.",
    icon: "Wallet",
    color: "#16a34a",
    sortOrder: 7,
    topics: [
      { title: "Ledger Audits: Spotting bogus charges and double-billing", content: "How to review rent ledgers line-by-line and challenge unsupported or duplicate charges." },
      { title: "Late Fees, Utility Back-Billing, and Admin Charges", content: "When fees are likely enforceable vs. likely challengeable, with sample dispute language." },
      { title: "Collections Disputes: Validation letters and credit bureau disputes", content: "Step-by-step process to demand debt validation and dispute incorrect rental debt entries." },
      { title: "Move-Out Accounting: Itemized deductions and damage claim rebuttals", content: "How to respond when a landlord sends inflated invoices or vague deduction statements." },
    ],
  },
  {
    name: "AI, Letters & Case Building",
    legacyNames: ["🧠 AI, Letters & Case Building"],
    description: "Using the platform tools to draft notices, organize facts, and build stronger cases.",
    icon: "Bot",
    color: "#7c3aed",
    sortOrder: 8,
    topics: [
      { title: "Prompt Library: Best prompts for drafting landlord notices", content: "Community-tested prompts for repair demands, follow-ups, and escalation letters." },
      { title: "Incident Timeline Mastery: Turning chaos into a court-ready narrative", content: "How to structure events, evidence, and damages so your timeline is easy to follow." },
      { title: "Evidence-to-PDF Workflows: Building a judge-friendly packet", content: "Formatting and ordering tips for exports that are readable, persuasive, and complete." },
      { title: "Privacy & Redaction: Sharing docs safely in community threads", content: "What to redact before posting screenshots, leases, notices, and correspondence." },
    ],
  },
];

async function getSeedAuthorId(): Promise<number> {
  const admin = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
  if (admin[0]) return admin[0].id;
  const fallback = await db.select().from(users).limit(1);
  if (!fallback[0]) throw new Error("No users found for forum seed");
  return fallback[0].id;
}

export async function seedCommunityTopicsIfEmpty(): Promise<{ seeded: boolean; categories: number; posts: number }> {
  const existingCategories = await db.select().from(forumCategories).limit(1);
  if (existingCategories.length > 0) return { seeded: false, categories: 0, posts: 0 };

  const authorId = await getSeedAuthorId();
  let categoryCount = 0;
  let postCount = 0;

  for (const seedCategory of starterCategories) {
    const [category] = await db.insert(forumCategories).values({
      name: seedCategory.name,
      description: seedCategory.description,
      icon: seedCategory.icon,
      color: seedCategory.color,
      sortOrder: seedCategory.sortOrder,
    }).returning();
    categoryCount += 1;

    for (const topic of seedCategory.topics) {
      await db.insert(forumPosts).values({
        categoryId: category.id,
        authorId,
        title: topic.title,
        content: topic.content,
        isPinned: !!topic.pinned,
      });
      postCount += 1;
    }
  }

  return { seeded: true, categories: categoryCount, posts: postCount };
}

export async function upsertCommunityTopics(): Promise<{ categories: number; created: number; updated: number }> {
  const authorId = await getSeedAuthorId();
  let created = 0;
  let updated = 0;
  let categories = 0;

  for (const seedCategory of starterCategories) {
    let categoryId: number;

    let existingCategory = await db
      .select()
      .from(forumCategories)
      .where(eq(forumCategories.name, seedCategory.name))
      .limit(1);

    if (!existingCategory[0] && seedCategory.legacyNames?.length) {
      for (const legacyName of seedCategory.legacyNames) {
        const legacyMatch = await db
          .select()
          .from(forumCategories)
          .where(eq(forumCategories.name, legacyName))
          .limit(1);
        if (legacyMatch[0]) {
          existingCategory = legacyMatch;
          break;
        }
      }
    }

    if (existingCategory[0]) {
      categoryId = existingCategory[0].id;
      await db.update(forumCategories).set({
        name: seedCategory.name,
        description: seedCategory.description,
        icon: seedCategory.icon,
        color: seedCategory.color,
        sortOrder: seedCategory.sortOrder,
      }).where(eq(forumCategories.id, categoryId));
    } else {
      const [createdCategory] = await db.insert(forumCategories).values({
        name: seedCategory.name,
        description: seedCategory.description,
        icon: seedCategory.icon,
        color: seedCategory.color,
        sortOrder: seedCategory.sortOrder,
      }).returning();
      categoryId = createdCategory.id;
    }

    categories += 1;

    for (const topic of seedCategory.topics) {
      const existingPost = await db
        .select()
        .from(forumPosts)
        .where(and(eq(forumPosts.categoryId, categoryId), eq(forumPosts.title, topic.title)))
        .limit(1);

      if (existingPost[0]) {
        await db.update(forumPosts).set({
          content: topic.content,
          isPinned: !!topic.pinned,
          updatedAt: new Date(),
        }).where(eq(forumPosts.id, existingPost[0].id));
        updated += 1;
      } else {
        await db.insert(forumPosts).values({
          categoryId,
          authorId,
          title: topic.title,
          content: topic.content,
          isPinned: !!topic.pinned,
        });
        created += 1;
      }
    }
  }

  return { categories, created, updated };
}

const COMMUNITY_SEED_VERSION_KEY = "community_seed_version";
const COMMUNITY_SEED_VERSION = "2026-03-08-categories-v4-no-emoji";

export async function syncCommunityTopicsVersioned(): Promise<{ ran: boolean; version: string; created: number; updated: number; categories: number }> {
  const existing = await db.select().from(appSettings).where(eq(appSettings.key, COMMUNITY_SEED_VERSION_KEY)).limit(1);
  const currentVersion = existing[0]?.value;

  if (currentVersion === COMMUNITY_SEED_VERSION) {
    return { ran: false, version: COMMUNITY_SEED_VERSION, created: 0, updated: 0, categories: 0 };
  }

  const result = await upsertCommunityTopics();

  if (existing[0]) {
    await db.update(appSettings).set({ value: COMMUNITY_SEED_VERSION }).where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values({ key: COMMUNITY_SEED_VERSION_KEY, value: COMMUNITY_SEED_VERSION });
  }

  return { ran: true, version: COMMUNITY_SEED_VERSION, ...result };
}

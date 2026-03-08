import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { forumCategories, forumPosts, users } from "../shared/schema";

type Topic = {
  title: string;
  content: string;
  pinned?: boolean;
};

type CategorySeed = {
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  topics: Topic[];
};

export const starterCategories: CategorySeed[] = [
  {
    name: "⚖️ Legal & Lease Defense",
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
      { title: "Know Your Limits: A State-by-State Guide to Small Claims", content: "Pinned reference thread for small-claims limits and filing links by state. Help keep this updated.", pinned: true },
    ],
  },
  {
    name: "🌬️ Health, Air Quality & Safety",
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
      { title: "How to Document a Habitability Issue (The 4-Step Process)", content: "Pinned checklist: 1) measure/photograph, 2) written notice, 3) timeline follow-up, 4) escalation path.", pinned: true },
    ],
  },
  {
    name: "📸 The Evidence Locker (Documentation)",
    description: "Paper trails, repair notices, photo/video evidence, and communication logs.",
    icon: "FolderArchive",
    color: "#7c3aed",
    sortOrder: 2,
    topics: [
      { title: "Certified Mail & The Paper Trail: Why you should stop using the phone and start using the post office", content: "Template wording and mailing workflows that create proof of notice. Include what receipts and scans to keep." },
      { title: "The Move-In/Move-Out Video Guide: Exactly what to film to prevent \"wear and tear\" scams", content: "Shot list, pacing, narration tips, and metadata practices that make video evidence usable in disputes." },
      { title: "Repair Request Templates: Form letters that start the legal \"repair clock\"", content: "Share request templates by issue type and jurisdiction, with examples that got fast responses." },
      { title: "Communication Logs: Apps and methods for documenting every interaction with management", content: "Tools and methods to keep accurate timelines for calls, emails, portal tickets, and in-person conversations." },
      { title: "Start Here: The Tenant's Rights First-Aid Kit", content: "Pinned onboarding thread for new members: immediate do-this-now checklist if you're in crisis mode.", pinned: true },
    ],
  },
  {
    name: "🏢 The Wall of Shame & Reviews",
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
    name: "🛠️ Renter-Friendly Maintenance",
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
    name: "🤝 Community & Advocacy",
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
    const existingCategory = await db.select().from(forumCategories).where(eq(forumCategories.name, seedCategory.name)).limit(1);
    if (existingCategory[0]) {
      categoryId = existingCategory[0].id;
      await db.update(forumCategories).set({
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

/**
 * Case study data shared between the /work overview page and the
 * individual case study pages at /work/<slug>.
 *
 * Keeping the canonical data in one file prevents drift between the
 * compact teaser cards on the overview and the full case study content
 * on the dedicated pages. When a new case study is added (e.g., a
 * future client engagement or another project), append a new entry
 * here and create a corresponding page at src/pages/work/<slug>.astro
 * that imports this data via getCaseStudy().
 *
 * Availability field controls how the case study's CTA renders:
 *   "open-source"          → "View on GitHub" button linking to repoUrl
 *   "commercial-preserved" → "Inquire about licensing" button to mailto
 *                            (used for projects preserved for commercial
 *                            deployment, not published as open source)
 */

export type CaseStudyAvailability = "open-source" | "commercial-preserved";

/**
 * A single feature bullet in the "What it does" section. Kept as a flat
 * string array so each entry renders as one scannable line. Authors are
 * expected to write each bullet as a single sentence with the capability
 * verb up front (e.g., "Real-time GPS tracking with...").
 */
export type FeatureBullet = string;

/**
 * A single technology decision with explicit rationale. This is the
 * "senior thinking" signal: it shows the reader that the architect
 * chose tools on purpose, not by defaulting to whatever was familiar.
 *
 * `choice` is the short label that goes in the heading position
 * ("PostGIS for geofencing"). `rationale` is one to three sentences
 * explaining the tradeoff that drove the choice.
 */
export interface TechDecision {
  choice: string;
  rationale: string;
}

/**
 * The architect/developer's role on the project and the timeframe over
 * which it was built. Kept as a small structured object rather than a
 * blob of prose so the rendering can lay out the timeframe distinctly
 * (e.g., as a small caption beneath a paragraph).
 */
export interface RoleInfo {
  description: string;
  timeframe: string;
}

/**
 * A downloadable asset attached to the case study (e.g., a technical
 * specification PDF or a marketing one-pager).
 *
 *   label       — Display name in the UI (e.g., "Technical Specification")
 *   filename    — Underlying file name (e.g., "FieldForce_Tool_Tracker_Technical_Spec.pdf")
 *   description — Optional short context line beneath the label
 *   fileSize    — Optional human-readable size for the UI
 *   url         — Path the browser fetches; usually a /downloads/... path
 *                 served from public/, but can be an absolute URL if the
 *                 asset is hosted elsewhere
 */
export interface DownloadInfo {
  label: string;
  filename: string;
  description?: string;
  fileSize?: string;
  url: string;
}

/**
 * A single screenshot for the case study screenshot gallery. Each entry
 * is one image with an alt-text description and an optional caption.
 * Caption renders beneath the image as small body-style text.
 *
 *   src     — Path the browser fetches; e.g., "/images/work/<slug>/foo.png"
 *   alt     — Required alt-text for accessibility
 *   caption — Optional caption shown beneath the image
 */
export interface ScreenshotInfo {
  src: string;
  alt: string;
  caption?: string;
}

export interface CaseStudyData {
  slug: string;
  title: string;
  tagline: string;
  briefDescription: string;
  problem: string;
  approach: string;
  status: string;
  techStack: string[];
  repoUrl?: string;
  availability: CaseStudyAvailability;
  navOrder: number;

  /*
   * Extended sections for full case studies (per the Notion case study
   * spec). All fields below are optional so smaller case studies can
   * use the basic three-section format (problem/approach/status) and
   * larger flagship case studies can fill in the additional structure.
   */

  /**
   * Bulleted feature overview ("What it does"). Each entry renders as
   * one bullet beneath a "What it does" subheading.
   */
  features?: FeatureBullet[];

  /**
   * Technology decisions with rationale. Each entry renders as a
   * "chose X because Y" entry under a "Tech decisions" subheading.
   * This is the section that demonstrates senior judgment.
   */
  techDecisions?: TechDecision[];

  /**
   * The architect/developer's role on the project plus timeframe.
   * Renders as a short paragraph followed by a small caption.
   */
  role?: RoleInfo;

  /**
   * URL of the architecture diagram image. Rendered as a full-width
   * image with subtle glass border between the approach and tech
   * decisions sections. Use `architectureDiagramAlt` to set the
   * alt-text. Both fields must be set for the diagram to render.
   */
  architectureDiagramUrl?: string;
  architectureDiagramAlt?: string;

  /**
   * Screenshot gallery. Renders as a responsive grid of images with
   * optional captions. Each entry is a {src, alt, caption?} object.
   */
  screenshots?: ScreenshotInfo[];

  /**
   * Downloadable assets. Renders as a list of file links with size and
   * optional descriptive context.
   */
  downloads?: DownloadInfo[];
}

export const caseStudies: CaseStudyData[] = [
  {
    slug: "aiorchbuilder",
    title: "AIOrchBuilder",
    tagline:
      "Multi-agent orchestration framework that builds applications by routing specialist tasks to the language model best suited for each kind of work.",
    briefDescription:
      "Seven specialist agents with defined contracts coordinated by an orchestrator that dynamically routes each task to the right model. Includes Ollama support for self-hosted local models, RBAC wired in from Day 1, and an auditable retrospective path for every agent action.",
    problem: `Modern application development with large language models is constrained two ways at once. Single-model approaches force one general-purpose model to handle architecture, UI, business logic, data, security, and testing equally well, which no model does well. Naive multi-model approaches lose context and consistency at the boundaries between calls. Most LLM development tooling picks one failure mode without acknowledging the other exists.

The cost dimension matters too. Running everything through Claude Sonnet or GPT-4 for a build that includes hundreds of routine boilerplate generations burns dollars and minutes that should be going to the parts of the build that actually need that level of reasoning capability.`,
    approach: `AIOrchBuilder treats LLM application building as an orchestration problem, not a prompting problem. Seven specialist agents with defined input and output contracts handle distinct phases of the build: UI, logic, data, API, auth, test, and review. An orchestrator coordinates handoffs between agents, enforces the contracts, and logs every action to an auditable Retrospective Audit Path so failures can be traced and replayed.

A separate LLM router evaluates per-agent task complexity and dynamically picks the model. Architectural reasoning routes to high-context reasoning models. Routine boilerplate routes to fast cheap ones. Data schema design routes to models with strong structured-output capability. The provider abstraction layer supports Ollama for self-hosted local models, which matters for cost control at scale and for any deployment where data residency or privacy rules out commercial API providers.

Security is wired in from Day 1, not bolted on. Every operation is associated with a user and a role. Every database table includes RBAC fields. Every API endpoint requires authentication. Supabase row-level security policies enforce access control at the database layer, so a compromise of the application layer does not automatically expose the data.`,
    status: `Active prototype, not a one-command demo. It has been used to scaffold real applications and the methodology has been validated end-to-end on production-grade workloads. Deployment requires a Supabase project, an LLM provider configuration (cloud or Ollama), and the resources outlined in the deployment guide.

The orchestration patterns informed the codebase structure of FieldForce Tool Tracker, a real-time GPS asset management platform for utility operations, which proved the methodology works at production scale across a monorepo of three apps with enterprise auth and time-series data tracking.`,
    techStack: [
      "Next.js",
      "TypeScript",
      "React",
      "Python",
      "Supabase",
      "PostgreSQL + RLS",
      "Docker Compose",
      "Ollama",
      "Notion",
      "OpenAI-compatible APIs",
    ],
    repoUrl: "https://github.com/princemanjee/AIOrchBuilder",
    availability: "open-source",
    navOrder: 1,
  },
  {
    slug: "claudemcp",
    title: "ClaudeMCP",
    tagline:
      "Local multi-backend LLM gateway. One process speaks four backends through three API protocols, so existing client code works unchanged.",
    briefDescription:
      "Single local gateway process serving Claude, Gemini, LM Studio, and Ollama through Anthropic, Gemini, and OpenAI API protocols. CLI auth reuse eliminates double billing for Claude Max and Gemini subscribers. Multi-instance support for local backends.",
    problem: `AI engineering workflows hit three friction points that compound. First, you pay for Claude Max or a Gemini subscription, and your agentic tooling wants to charge you again to use the same models via API, doubling the bill for using your own subscription. Second, you have local models running in Ollama or LM Studio but they are not addressable through the same client code that already talks to cloud APIs, so workflows fragment by where the model lives. Third, you want to mix and match: send the easy stuff to a local model for free, send the hard reasoning to Claude, send vision work to Gemini, but every client SDK assumes a single provider.

The result for most teams is either pay twice, fork the codebase per backend, or pick one backend and live with its weaknesses.`,
    approach: `ClaudeMCP is a single local gateway process serving four backends through three API protocols simultaneously. Existing first-party SDKs (Anthropic, OpenAI, Google) work unchanged when pointed at the gateway. Underneath are two normalized internal types: a backend-agnostic NormalizedRequest shape modeled on the Anthropic Messages API so content blocks pass through translation without renaming, and a NormalizedEvent streaming union that backends emit as async iterables.

The Claude and Gemini backends invoke the CLI tools rather than the cloud APIs, which reuses the subscription auth already on disk and eliminates double billing for users with a Max or paid subscription. LM Studio and Ollama backends each support multiple named instances, so a local fast instance and a remote workstation instance with larger models can both be addressed naturally: ollama:local/llama-3.1-8b versus ollama:remote-workstation/llama-3.1-70b. The router probes local backends on an interval to keep the model registry current as models are loaded and unloaded.

A compatibility test suite exercises the real first-party SDKs against the running server with mock backends. If a wire envelope drifts during translation, the SDK's own parser throws. That keeps the protocol shims honest without requiring a real installation of every cloud provider to test against.`,
    status: `Working tool with API key authentication, response cache (in-memory plus disk-backed), SQLite-backed archive with zstd compression for debugging and downstream analysis, file store with TTL eviction, and a localhost-bound admin UI. The compat suite runs in CI.

Scope is personal use or trusted small-team local deployments. It will sit behind a reverse proxy on a LAN for trusted teams, but it does not aim to be a multi-tenant SaaS gateway and does not implement rate limiting, quotas, or per-user accounting. The original use case (Claude Code CLI usage with no extra API cost on top of a Claude Max subscription) still works, and the architecture generalizes cleanly to additional backends and protocols as needed.`,
    techStack: [
      "Node.js 20+",
      "TypeScript",
      "Express",
      "Zod",
      "Vitest",
      "SQLite",
      "Busboy",
      "zstd",
      "async iterables",
      "OpenAI-compatible HTTP",
    ],
    repoUrl: "https://github.com/princemanjee/ClaudeMCP",
    availability: "open-source",
    navOrder: 2,
  },
  {
    slug: "fieldforce",
    title: "FieldForce Tool Tracker",
    tagline:
      "Real-time asset intelligence platform for utility and construction operations.",
    briefDescription:
      "Unified asset management platform combining sub-second GPS tracking, PostGIS geofencing, QR/barcode custody management, fleet health, and bi-directional ERP integration. Three apps in a pnpm + turborepo monorepo: NestJS API, React 18 web dashboard, Expo mobile app with SQLite offline. Code preserved for commercial deployment.",
    problem: `Utility operations and large-scale construction businesses manage thousands of mobile assets across hundreds of work sites: vehicles, tools, instruments, specialized equipment that gets handed off between crews shift by shift. Asset losses cost organizations millions of dollars per year, and the systems that are supposed to prevent that loss are usually built on the wrong substrate. Paper check-out logs are unreliable. Spreadsheet-driven custody tracking has no real-time signal. Existing telematics products cover the vehicles but not the tools inside them. Existing tool-tracking products cover the tools but not the vehicles carrying them or the crews using them.

ERP integration compounds the problem. Utilities running SAP or ServiceNow as their system of record need bi-directional sync with the field asset platform, but most off-the-shelf tracking products either do not integrate at all or require custom middleware that the utility's IT team has to build and maintain. That middleware becomes its own ongoing project, and most utilities cannot afford to staff it.`,
    approach: `FieldForce Tool Tracker is a single platform that unifies real-time GPS tracking, PostGIS-powered geofencing, QR and barcode-driven custody management, fleet health and maintenance compliance, and bi-directional ERP integration. The architecture is a pnpm monorepo orchestrated by turborepo, shipping three apps from a shared TypeScript codebase: a NestJS REST and WebSocket API, a React 18 + Vite + MUI v6 operations dashboard with TanStack Query for server state, and an Expo React Native mobile app for field workers with SQLite offline storage so crews can continue working when connectivity drops.

The data layer is PostgreSQL 16 with PostGIS for spatial queries (polygonal and circular geofences with sub-second violation alerts) and TimescaleDB for time-series partitioning of high-frequency location data, so query performance does not degrade as years of tracking history accumulate. NATS JetStream handles event distribution between services; Redis caches hot location state. Authentication is OIDC-compliant via Keycloak with granular RBAC enforced at the API layer. The Tile Pro BLE network is supported for short-range asset location indoors and inside vehicles. Bi-directional integration with SAP and ServiceNow ships out of the box rather than requiring the customer's IT team to build it.

The architecture itself was guided by the AIOrchBuilder multi-agent orchestration framework, with each subsystem treated as a specialist agent task with its own contract. That validated the AIOrchBuilder methodology end-to-end on a real production-grade codebase, not a toy example.`,
    status: `Advanced functioning prototype, approximately 97 percent complete. Final integration work on GPS receiver wiring and BLE device pairing is in progress. Marketing materials including the FieldForce Asset Intelligence positioning are complete. Code is preserved for commercial deployment and is not published as open source.

Available for licensing, deployment engagements, and contract integration work with utility operations, fleet management teams, and construction technology organizations. Reach out directly to discuss deployment context, integration requirements, RBAC and ERP configuration, and licensing terms.`,
    techStack: [
      "Node.js 20",
      "NestJS",
      "TypeORM",
      "React 18",
      "Vite",
      "MUI v6",
      "TanStack Query",
      "React Native (Expo)",
      "SQLite",
      "PostgreSQL 16",
      "PostGIS",
      "TimescaleDB",
      "NATS JetStream",
      "Redis",
      "Keycloak (OIDC)",
      "Docker",
      "pnpm + turborepo",
      "SAP & ServiceNow integration",
    ],
    availability: "commercial-preserved",
    navOrder: 3,

    /*
     * Extended case study content per Notion spec. Order in the source
     * file matches the visual order in the rendered page.
     */

    features: [
      "Real-time GPS tracking with sub-second location updates and historical playback across the full asset fleet.",
      "PostGIS-powered geofencing with polygonal and circular boundaries and sub-second violation alerts.",
      "QR and barcode custody management for tools, instruments, and specialized equipment across crew handoffs.",
      "Fleet health monitoring with maintenance compliance tracking and service interval enforcement.",
      "Bi-directional integration with SAP and ServiceNow shipping out of the box, not as a customer-built bolt-on.",
      "Operations dashboard for dispatchers and supervisors plus offline-capable field worker mobile app on iOS and Android.",
      "Tile Pro BLE network support for short-range indoor and in-vehicle asset location.",
    ],

    techDecisions: [
      {
        choice: "PostGIS for geofencing",
        rationale:
          "Spatial queries run server-side at the database layer, so polygon containment checks complete in single-digit milliseconds without shipping point geometry to clients. Off-the-shelf tracking products that compute geofences client-side cannot deliver sub-second violation alerts at fleet scale.",
      },
      {
        choice: "TimescaleDB for time-series GPS history",
        rationale:
          "Automatic time partitioning keeps query performance flat as years of location history accumulate. Plain PostgreSQL on a single large table degrades within months once high-frequency GPS pings number in the hundreds of millions per year.",
      },
      {
        choice: "NATS JetStream over RabbitMQ or Kafka for event distribution",
        rationale:
          "Operationally simpler than Kafka with a meaningfully smaller resource footprint, and offers native at-least-once delivery and replay. Right-sized for field operations event volumes without the cluster ops overhead Kafka demands at production grade.",
      },
      {
        choice: "Keycloak for authentication and RBAC",
        rationale:
          "Enterprise utility IT environments standardize on OIDC and SAML for SSO. Keycloak ships granular RBAC, MFA, and federation out of the box, so the platform plugs into existing identity infrastructure rather than requiring custom auth work that the utility's security team would then have to audit.",
      },
      {
        choice: "pnpm plus turborepo monorepo with shared TypeScript packages",
        rationale:
          "API contracts are defined once in shared packages and consumed by the NestJS API, the React dashboard, and the Expo mobile app. Contract drift between server and clients is eliminated structurally rather than through documentation discipline that always erodes under deadline pressure.",
      },
      {
        choice: "Expo with SQLite for the mobile offline path",
        rationale:
          "Field crews routinely work in low-connectivity environments. Local SQLite gives the mobile app full functionality offline with deferred sync to PostgreSQL on reconnect, so a dropped cellular signal does not stop a custody handoff or a tool check-in. Expo delivers cross-platform reach with EAS Build and OTA updates from a single codebase.",
      },
    ],

    role: {
      description:
        "Sole architect, sole developer. Designed the system end to end, built the monorepo from scratch, shipped the NestJS API, the React 18 operations dashboard, and the Expo React Native mobile app. The architecture itself was guided by the AIOrchBuilder multi-agent orchestration methodology developed in parallel, validating that methodology end to end on a real production-grade codebase rather than a toy example.",
      timeframe: "Solo build, March 2026 to present.",
    },

    /*
     * Architecture diagram generated by Gemini per the prompt at
     * MarketingAssets/FieldForce_Architecture_Diagram_Gemini_Prompt.md.
     * Original Gemini output filename is preserved in MarketingAssets/
     * for archival; the live diagram has been renamed to
     * architecture.png for cleanliness.
     */
    architectureDiagramUrl: "/images/work/fieldforce/architecture.png",
    architectureDiagramAlt:
      "FieldForce Tool Tracker architecture diagram. Four-tier system: client applications (Operations Dashboard, Field Worker Mobile App), API and authentication (NestJS, Keycloak), messaging and cache (NATS JetStream, Redis), and data layer (PostgreSQL 16 with PostGIS and TimescaleDB). Edge devices (GPS receivers, Tile Pro BLE network) feed into the API. SAP and ServiceNow integrate bi-directionally. pnpm and turborepo monorepo with shared TypeScript types across all three apps.",

    /*
     * Screenshot files captured from the running mobile emulator and
     * preserved in C:\Code\Github\ToolManager\. Files must be copied
     * into public/images/work/fieldforce/ for the case study page to
     * render them (see deployment notes in PRESERVATION_PLAN.md).
     */
    screenshots: [
      {
        src: "/images/work/fieldforce/emulator_current.png",
        alt: "FieldForce mobile app showing the current asset view for a field worker.",
        caption: "Mobile app: current assigned assets for a field worker.",
      },
      {
        src: "/images/work/fieldforce/emulator_screen.png",
        alt: "FieldForce mobile app primary screen with navigation and asset summary.",
        caption: "Mobile app: primary navigation and at-a-glance asset summary.",
      },
      {
        src: "/images/work/fieldforce/emulator_vehicles.png",
        alt: "FieldForce mobile app showing vehicle assignments and status.",
        caption: "Mobile app: vehicle assignment view with live status.",
      },
    ],

    /*
     * Downloadable marketing and technical assets. The Technical Spec
     * PDF is on hold until generated from the existing .docx and
     * .html source files in C:\Code\Github\ToolManager\. The Asset
     * Intelligence PDF exists and is preserved in MarketingAssets/.
     */
    downloads: [
      {
        label: "FieldForce Asset Intelligence",
        filename: "FieldForce_Asset_Intelligence.pdf",
        description:
          "Strategic positioning and capability overview. Shareable with prospective licensing partners and deployment customers.",
        url: "/downloads/FieldForce_Asset_Intelligence.pdf",
      },
    ],
  },
];

/**
 * Sorted by navOrder for display in the Work nav dropdown and on the
 * overview page.
 */
export const caseStudiesByOrder = [...caseStudies].sort(
  (a, b) => a.navOrder - b.navOrder
);

/**
 * Find a case study by slug. Used by individual case study pages
 * (e.g., src/pages/work/aiorchbuilder.astro) to look up their data.
 */
export function getCaseStudy(slug: string): CaseStudyData | undefined {
  return caseStudies.find((cs) => cs.slug === slug);
}

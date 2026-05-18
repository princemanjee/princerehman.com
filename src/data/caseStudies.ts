/**
 * Case study data shared between the /work overview page and the
 * individual case study pages at /work/<slug>.
 *
 * Keeping the canonical data in one file prevents drift between the
 * compact teaser cards on the overview and the full case study content
 * on the dedicated pages. When a new case study is added (FieldForce
 * once the positioning decision lands, or any other project), append
 * a new entry here and create a corresponding page at
 * src/pages/work/<slug>.astro that imports this data.
 */

export interface CaseStudyData {
  slug: string;
  title: string;
  tagline: string;
  briefDescription: string;
  problem: string;
  approach: string;
  status: string;
  techStack: string[];
  repoUrl: string;
  navOrder: number;
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

The orchestration patterns informed the codebase structure of a real-time GPS asset management platform built on top of this framework, which proved the methodology works at production scale across a monorepo of three apps with enterprise auth and time-series data tracking.`,
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
    navOrder: 2,
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

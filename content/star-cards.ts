/**
 * What the hero cloud's hover cards say (HERO-STARS-PLAN.md): a name and up to three words about the
 * item. Yellow dots are the public sources the clone can cite, keyed by their resume anchor; white
 * dots are personal. Site only: none of this goes into the knowledge base, the terminal or MCP.
 */

export type Words = readonly [string, string, string]

export interface WorkCard {
  /** Replaces the source's title on the card, where that's long. */
  name?: string
  words: Words
}

/** One card per public source with a place on the page (stars.test.ts checks they match). */
export const WORK_CARDS: Record<string, WorkCard> = {
  'r-summary': { words: ['agents', 'MCP', 'evals'] },
  'r-exp-eddy': { words: ['leak detection', 'IoT', 'web apps'] },
  'r-exp-eddy-rag': { words: ['RAG', 'ISO docs', 'Inspect evals'] },
  'r-exp-eddy-tracker': { words: ['work tracker', 'Next.js', 'PostgreSQL'] },
  'r-exp-eddy-mcp': { words: ['MCP server', 'agent', 'chat history'] },
  'r-exp-eddy-services': { words: ['C#/.NET', 'LoRaWAN', 'telemetry'] },
  'r-exp-eddy-claude-code': { words: ['Claude Code', 'Codex', 'AGENTS.md'] },
  'r-exp-create-club': { words: ['studio', 'web apps', 'AI tooling'] },
  'r-exp-create-club-beverage-agents': { words: ['LangChain', 'agents', 'weekly reports'] },
  'r-exp-create-club-imap-mcp': { words: ['MCP', 'IMAP mail', 'caching'] },
  'r-exp-create-club-client-apps': { words: ['client apps', 'Stripe', 'payments'] },
  'r-exp-pinhous-team': { words: ['team lead', 'React', 'sprints'] },
  'r-exp-pinhous-kafka': { words: ['Kafka', 'event-driven', 'property data'] },
  'r-exp-pinhous-cicd': { words: ['CI/CD', 'AWS ECS', 'CDK'] },
  'r-exp-pinhous-recs-poc': { words: ['LangChain', 'recommendations', 'PoC'] },
  'r-exp-aro': { words: ['app development', 'team lead', 'promotion'] },
  'r-exp-aro-automation': { words: ['Python', 'extraction', 'tagging'] },
  'r-exp-aro-etl': { words: ['ETL', 'CRM', 'integrations'] },
  'r-exp-aro-docs': { words: ['documentation', 'on-call', 'incidents'] },
  'r-exp-duit-signals': { words: ['fintech', 'GCP', 'market signals'] },
  'r-exp-duit-pipelines': { words: ['Cloud Functions', 'IAM', 'dashboards'] },
  'r-build-regdocs-corpus': { name: 'Nuclear RegDocs assistant', words: ['RAG', 'CNSC documents', 'citations'] },
  'r-build-regdocs-pipeline': { name: 'Nuclear RegDocs assistant', words: ['chunking', 'embeddings', 'pgvector'] },
  'r-build-regdocs-evals': { name: 'Nuclear RegDocs assistant', words: ['golden set', 'LLM judge', 'faithfulness'] },
  'r-build-regdocs-guardrails': { name: 'Nuclear RegDocs assistant', words: ['guardrails', 'rate limits', 'jailbreaks'] },
  'r-build-regdocs-licensing': { name: 'Nuclear RegDocs assistant', words: ['licensing', 'NRC guides', 'fetcher'] },
  'r-build-pulse-app': { name: 'The Pulse', words: ['analytics', 'pricing', 'Cloudflare'] },
  'r-build-jobsearch-vectors': { name: 'Job search', words: ['Qdrant', 'named vectors', 'job postings'] },
  'r-build-jobsearch-pipeline': { name: 'Job search', words: ['LLM intent', 'negations', 'filtered search'] },
  'r-build-jobsearch-refinement': { name: 'Job search', words: ['follow-ups', 'intent merging', 'conversation'] },
  'r-build-earned-coach': { name: 'Earned', words: ['habits', 'AI coach', 'routines'] },
  'r-community-open-invite': { words: ['community', 'Toronto', 'events'] },
  'r-community-open-invite-events': { words: ['Cake Picnic', 'crafts', 'hosting'] },
  'r-community-open-invite-platform': { words: ['Next.js', 'D1', 'Stripe'] },
  'r-community-open-invite-ops': { words: ['ops dashboard', 'invoices', 'LLM'] },
  'r-skills': { words: ['GenAI', 'cloud', 'full stack'] },
  'r-education': { words: ['nuclear engineering', 'AI', 'product'] },
  'r-contact': { words: ['Toronto', 'email', 'GitHub'] },
}

export interface PersonalDot {
  id: string
  name: string
  /** Most personal dots are just a name. */
  words?: Words
  /** Where a click goes. Personal dots are hover only unless they have one. */
  href?: string
}

export const PERSONAL_DOTS: PersonalDot[] = [
  { id: 'humans-first', name: 'Humans first' },
  { id: 'peace', name: 'Peace' },
  { id: 'fair-play', name: 'Fair play' },
  { id: 'board-games', name: 'Board games' },
  { id: 'second-chances', name: 'Second chances', words: ['change', 'good and bad', 'growth'] },
  { id: 'habits', name: 'Habits', words: ['routines', 'streaks', 'consistency'] },
  { id: 'health', name: 'Health', words: ['skin care', 'fitness', 'more active'] },
  { id: 'agnostic', name: 'Agnostic' },
  { id: 'badminton', name: 'Badminton' },
  { id: 'cricket', name: 'Cricket' },
  { id: 'f1', name: 'F1' },
  { id: 'outdoors', name: 'Outdoors', words: ['hiking', 'nature', 'trails'] },
  { id: 'beaches', name: 'Beaches' },
  { id: 'plants', name: 'Plants' },
  { id: 'cooking', name: 'Cooking' },
  { id: 'cleaning', name: 'Cleaning' },
  { id: 'guitar', name: 'Guitar' },
  // The Mac's Music app shows Raj's top Spotify genres.
  { id: 'music', name: 'Music', words: ['Spotify', 'top genres', 'playlists'], href: '/mac?open=music' },
  { id: 'ios-and-android', name: 'iOS and Android' },
]

/**
 * What the hero cloud's hover cards say (HERO-STARS-PLAN.md): a name and up to three words about the
 * item. Yellow dots are the companies, builds and community work the clone can cite, plus Education,
 * keyed by the anchor of their block on the page; white dots are personal. Site only: none of this
 * goes into the knowledge base, the terminal or MCP.
 */

export type Words = readonly [string, string, string]

export interface WorkCard {
  /** Replaces the resume's name on the card, where that's long. */
  name?: string
  words: Words
}

/** One card per role, build and community entry, plus Education (stars.test.ts checks they match). */
export const WORK_CARDS: Record<string, WorkCard> = {
  'r-exp-eddy': { words: ['leak detection', 'RAG', 'MCP'] },
  'r-exp-create-club': { words: ['AI agents', 'MCP', 'client apps'] },
  'r-exp-pinhous': { words: ['Kafka', 'AWS', 'team lead'] },
  'r-exp-aro': { words: ['Python', 'ETL', 'on-call'] },
  'r-exp-duit': { words: ['fintech', 'GCP', 'market signals'] },
  'r-build-regdocs': { name: 'Nuclear RegDocs assistant', words: ['RAG', 'evals', 'guardrails'] },
  'r-build-pulse': { name: 'The Pulse', words: ['analytics', 'pricing', 'Cloudflare'] },
  'r-build-jobsearch': { name: 'Job search', words: ['Qdrant', 'named vectors', 'LLM intent'] },
  'r-build-earned': { name: 'Earned', words: ['habits', 'AI coach', 'routines'] },
  'r-community-open-invite': { words: ['community', 'events', 'Next.js'] },
  'r-education': { words: ['nuclear engineering', 'AI', 'product'] },
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

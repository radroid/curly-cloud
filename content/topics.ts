/**
 * Topic ids shared by the public resume, the interview stacks, retrieval (topic filters,
 * `list_topics`) and the studio coverage view.
 */

export interface TopicDef {
  id: string
  label: string
  /** Where the topic's knowledge comes from. */
  origin: 'resume' | 'interview'
  /** One line an agent or visitor can use to decide whether to ask about it. */
  blurb: string
}

export const TOPICS: TopicDef[] = [
  { id: 'summary', label: 'Summary', origin: 'resume', blurb: 'Who Raj is and what he builds.' },
  { id: 'experience', label: 'Experience', origin: 'resume', blurb: 'Roles from 2020 to now, with outcomes.' },
  { id: 'builds', label: 'Independent builds', origin: 'resume', blurb: 'Projects shipped end to end on his own.' },
  { id: 'skills', label: 'Skills', origin: 'resume', blurb: 'Languages, platforms, GenAI tooling.' },
  { id: 'community', label: 'Community', origin: 'resume', blurb: 'Open Invite: hosting small community events in Toronto.' },
  { id: 'education', label: 'Education', origin: 'resume', blurb: 'Degrees and certificates.' },
  { id: 'profile', label: 'Profile', origin: 'resume', blurb: 'Location, links and how to reach him.' },

  { id: 'origins', label: 'Origins & motivation', origin: 'interview', blurb: 'How he got here and what drives him.' },
  { id: 'principles', label: 'Principles & values', origin: 'interview', blurb: 'What he will and won’t compromise on.' },
  { id: 'decisions', label: 'How he decides', origin: 'interview', blurb: 'Trade-offs, risk, speed versus certainty.' },
  { id: 'engineering', label: 'Engineering taste', origin: 'interview', blurb: 'Opinions on code, architecture and tools.' },
  { id: 'ai', label: 'AI engineering', origin: 'interview', blurb: 'How he builds with LLMs: RAG, evals, agents, MCP.' },
  { id: 'leadership', label: 'Leading & collaborating', origin: 'interview', blurb: 'Teams, mentoring, ownership.' },
  { id: 'conflict', label: 'Conflict & feedback', origin: 'interview', blurb: 'Disagreement, giving and taking feedback.' },
  { id: 'failure', label: 'Failure & learning', origin: 'interview', blurb: 'Mistakes, what changed afterwards.' },
  { id: 'work-style', label: 'Work style & environment', origin: 'interview', blurb: 'Pace, remote versus office, meetings, autonomy.' },
  { id: 'career', label: 'What he wants next', origin: 'interview', blurb: 'Roles, companies, dealbreakers.' },
  { id: 'stories', label: 'Stories from the work', origin: 'interview', blurb: 'Specific situations, told in detail.' },
  { id: 'life', label: 'Life outside work', origin: 'interview', blurb: 'Interests, travel, music, the physical world.' },
  { id: 'lightning', label: 'Lightning round', origin: 'interview', blurb: 'Quick preferences and gut calls.' },
  { id: 'notes', label: 'Notes', origin: 'interview', blurb: 'Things Raj added in his own words.' },
]

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.id, t.label]))

export function topicLabel(id: string | null | undefined): string {
  if (!id) return 'General'
  return TOPIC_LABELS[id] ?? id
}

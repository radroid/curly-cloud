import type { Question } from './types'

export const STORIES: Question[] = [
  {
    id: 'stories-001',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      'The Eddy work tracker replaced a shared Excel sheet where items were routinely lost, and it had to work for Service, Product, Tech, field technicians and outside vendors. Tell me how you got each of those groups to actually move off the sheet.',
    hint: 'Situation · who was hardest to move and why · what you built or changed for them · what happened · what you would do differently.',
    followUps: [
      'What was the moment you knew the Excel sheet was really dead?',
      'What did field technicians need that the office teams did not?',
      'Which feature request did you turn down, and how did you say no?',
    ],
    why: 'How he drives adoption of an internal tool across very different users, not just how he builds it.',
  },
  {
    id: 'stories-002',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      "Tell me the story of designing auth for the Eddy MCP server, where every tool call resolves to a real person and is checked against the tracker's own role and visibility rules. Where did you start, and what pushed you to this design?",
    hint: 'Situation · the simpler option you considered · where it would have gone wrong · what you built · what you would change.',
    followUps: [
      'Did anyone argue for a single shared API key, and what was your answer?',
      'How are personal access tokens issued, rotated and revoked?',
      'What does the maintainer bot do unattended over stdio, and how is its access scoped?',
    ],
    why: 'The real design history behind his MCP auth model, including the trade-offs he rejected.',
  },
  {
    id: 'stories-003',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      "Tell me about the RAG system you're building at Eddy over sensor engineering docs and ISO whitepapers, gated by an Inspect AI eval suite. What are engineers actually asking it, and how does the gate decide a change can ship?",
    hint: 'Situation · what engineers need from it · how the eval gate works · what it has caught so far · what you would do differently.',
    followUps: [
      'Has the gate ever blocked a change you wanted to ship? What happened?',
      'How did you decide the pass threshold?',
      'Who writes new eval cases when the docs change?',
    ],
    why: 'How he designs RAG around real user intents and wires evaluation into the release process.',
  },
  {
    id: 'stories-004',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'Your Eddy tools turn telemetry from 150,000+ LoRaWAN devices, arriving through Azure Storage Queues, into insights for customers and field teams. Tell me about a time the data surprised you: a backlog, part of the fleet going quiet, or numbers that looked wrong.',
    hint: 'Situation · how you noticed · what was really going on · what you changed · what you would monitor now.',
    followUps: [
      'How do you tell a dead device from a quiet one?',
      'What do the Python commissioning scripts do, and what happens when one fails in the field?',
      'Who notices first when something breaks: you, a customer or a field tech?',
    ],
    why: 'How he operates a high-volume IoT data path and debugs data problems that start in the physical world.',
  },
  {
    id: 'stories-005',
    topic: 'stories',
    type: 'story',
    depth: 1,
    prompt:
      'At Eddy you rolled out AGENTS.md instructions and pull request review guidelines across several repositories for agent-driven development with Codex and Claude. Tell me the story: where it started and how it went from your own setup to something the team relies on.',
    hint: 'Situation · the problem it solved · what went into AGENTS.md and the review guidelines · the first time it paid off · what you would change.',
    followUps: [
      'What did you leave out of AGENTS.md on purpose, to avoid stuffing the context?',
      'What does a pull request review guideline catch that CI does not?',
      'How much of the rollout itself did the agents write?',
    ],
    why: 'How he builds momentum in a new role and sets a team up to work well with coding agents.',
  },
  {
    id: 'stories-006',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      'Your agents for the global beverage company replaced 80+ manual weekly processes and cut manual work by about 60%. Tell me about the worst week those agents had: what failed, who noticed, and how you fixed it.',
    hint: 'Situation · what failed (a report format, a model, a load step) · how it surfaced · what you did · what you would build differently.',
    followUps: [
      'What made up the manual work that remained after the 60% cut?',
      'How did the weekly report formats change under you, and how did the agents cope?',
      'What did working through a consultancy make easier or harder?',
    ],
    why: 'What production agent failures really look like to him, and how he builds for recovery.',
  },
  {
    id: 'stories-007',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      "You prototyped an MCP server over a client's self-hosted IMAP mail, measured the tool latency, showed it needed a local index and a response cache, costed it and recommended stopping. Tell me about the conversation where you told the client.",
    hint: 'Situation · what the numbers were · how you framed stopping · how they reacted · what you would do differently.',
    followUps: [
      'What latency did you measure, and what would acceptable have looked like?',
      'Was there any pull to keep going, given that stopping meant less work for the studio?',
      'What did the client do instead?',
    ],
    why: 'How he delivers a data-backed stop recommendation, even when it costs him work.',
  },
  {
    id: 'stories-008',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'Across the 4+ production apps you shipped at Create Club, tell me about the hardest engagement. What made it hard, and how did it end?',
    hint: 'Situation · what made it hard (scope, trust, money, people) · what you did · how it ended · what you would do differently. No names needed.',
    followUps: [
      'What would you now put in the contract or the kickoff to prevent it?',
      'Was there a moment you considered walking away?',
      'How did being a co-founder change the way you handled it?',
    ],
    why: 'How he manages a difficult client relationship as a founder with skin in the game.',
  },
  {
    id: 'stories-009',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'At Pinhous you built the AWS deploy pipeline (GitHub Actions, Docker images to ECS, CloudFormation via CDK) that cut deploys from 15 minutes to 2, with health checks and automatic rollbacks. Tell me where the 13 minutes went and how you found them.',
    hint: 'Situation · what the old deploy looked like · what you measured · what you changed first · what you would do differently.',
    followUps: [
      'Did an automated rollback ever fire for real? What happened?',
      "How did the team's habits change once a deploy took 2 minutes?",
      'Would you pick CDK again?',
    ],
    why: 'How he diagnoses a delivery bottleneck and what fast, safe deploys changed for his team.',
  },
  {
    id: 'stories-010',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'You introduced Kafka at Pinhous for event-driven data flow between services. Tell me how it went from your idea to running in production: did anyone need convincing, and what was the best argument against it?',
    hint: 'Situation · the problem Kafka solved · the pushback · how you won the argument or compromised · what you would do differently.',
    followUps: [
      'Looking back, was Kafka the right size of tool for Pinhous?',
      'What broke first once it was in production?',
      'Who ended up owning it day to day?',
    ],
    why: 'How he introduces significant infrastructure and earns buy-in from a team.',
  },
  {
    id: 'stories-011',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      'Your LangChain proof of concept for home recommendations at Pinhous worked, and you still recommended against shipping it because per-user inference cost did not justify it. Tell me about delivering that recommendation: who wanted it shipped, and how did they take it?',
    hint: 'Situation · what the POC showed · the cost math · how you made the call · how it landed · what you documented for later.',
    followUps: [
      'What were the actual numbers: cost per user and expected traffic?',
      'Was it hard to argue against your own working prototype?',
      'Has the trade-off flipped since, given how far model prices have fallen?',
    ],
    why: 'How he makes and communicates a cost-driven no on work he built himself.',
  },
  {
    id: 'stories-012',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'At ARO you owned on-call incident response, and your preventive measures cut recurring incidents by 20%. Tell me about the incident that taught you the most.',
    hint: 'Situation · what broke and when · how you found the cause · the preventive fix · what you would do differently.',
    followUps: [
      'What made an incident "recurring" in your tracking, and how did you count the 20%?',
      'Which preventive measure had the biggest effect?',
      'What did being on call change about the code you write now?',
    ],
    why: 'How he responds to incidents and turns them into lasting prevention.',
  },
  {
    id: 'stories-013',
    topic: 'stories',
    type: 'open',
    depth: 2,
    prompt:
      'At ARO you built Python document-processing automations for extraction and tagging, shaped around how the documents were used downstream. If you rebuilt them today, what would you keep, what would you hand to an LLM, and what would you still refuse to?',
    hint: 'Start with what the pipeline did and who did that work by hand before it existed.',
    followUps: [
      'How did you know the extraction was right without checking every page?',
      'Which document type was hardest to tag, and why?',
      'How did the people who used to produce those reports by hand feel about it?',
    ],
    why: 'How his pre-LLM automation work shapes where he would and would not use LLMs today.',
  },
  {
    id: 'stories-014',
    topic: 'stories',
    type: 'story',
    depth: 1,
    prompt:
      'At Duit you cut buy/sell signal latency over NSE market data from 15 seconds to 5. What was actually slow, and what did you change?',
    hint: 'Situation · where the 15 seconds went · the change that mattered most · what you would try today.',
    followUps: [
      'Why did 5 seconds matter to the people using the signals?',
      'Did anything you tried make it slower first?',
      'What would you reach for now that you did not know about then?',
    ],
    why: 'His earliest performance work and how he finds bottlenecks.',
  },
  {
    id: 'stories-015',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'Early in your career at Duit, working remotely from Mumbai, you deployed the Cloud Functions and IAM roles behind the backends and data pipelines for real-time dashboards. Tell me about a week when things were not going well: what was wrong, and what did you do about it?',
    hint: 'Situation · what was going wrong · what you tried · what worked · what you would do differently with what you know now.',
    followUps: [
      'How did you work remotely in 2020 and 2021 without the habits and tools you rely on now?',
      'Who did you go to when you were stuck, and how?',
      'What did you get wrong then that you still watch for?',
    ],
    why: 'How he worked and learned early in his career, remotely.',
  },
  {
    id: 'stories-016',
    topic: 'stories',
    type: 'story',
    depth: 3,
    prompt:
      'When the regdocs corpus grew, your evals caught hit@8 dropping from 96.7% to 91.3%, with 15 queries worse and none better. You recovered half the loss and still held the production release pending a generation eval. Tell me about the moment you decided to hold.',
    hint: 'Situation · what you saw first · how you root-caused it · the case for shipping anyway · why you held · what you would do differently.',
    followUps: [
      'Nobody was forcing you to hold a solo project. Why did it matter?',
      'What does the generation eval have to show before you release?',
      'How did you find the boilerplate collision: from the data, the failing queries or a hunch?',
    ],
    why: 'His release discipline when metrics regress, and how he root-causes a retrieval failure.',
  },
  {
    id: 'stories-017',
    topic: 'stories',
    type: 'story',
    depth: 2,
    prompt:
      'To grow the regdocs corpus you built a licence-manifest fetcher: 15 US NRC guides validated but held from ingestion, and 16 IAEA standards catalogued as reference-only. Tell me how you ended up spending time on licensing instead of just ingesting everything.',
    hint: 'Situation · what you discovered about the licences · the call for each source · what it cost you · what you would do differently.',
    followUps: [
      'Why hold the NRC guides until citations are source-aware? What would go wrong otherwise?',
      'How did you work out what the IAEA licence allowed?',
      'Would you apply the same rigor at a startup moving fast?',
    ],
    why: 'How he handles licensing, provenance and trust in data, even when nobody is checking.',
  },
  {
    id: 'stories-018',
    topic: 'stories',
    type: 'story',
    depth: 1,
    prompt:
      "In jobsearch you parsed queries into structured intent with an LLM, negations included, and applied a negation penalty after fusion. What did a query like 'remote data jobs, not in finance' return before you handled negation?",
    hint: 'Situation · the query that broke it · why embeddings struggle with "not" · what you built · what you would do differently.',
    followUps: [
      'Why a penalty rather than a hard filter?',
      'How did conversational refinement handle a follow-up like "actually, finance is fine"?',
      'How did you test that negation handling worked?',
    ],
    why: 'How he debugs a classic embedding weakness and designs around it pragmatically.',
  },
]

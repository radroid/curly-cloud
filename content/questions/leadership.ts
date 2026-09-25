import type { Question } from './types'

export const LEADERSHIP: Question[] = [
  {
    id: 'leadership-001',
    topic: 'leadership',
    type: 'open',
    depth: 1,
    prompt: "Think of the best lead you've ever worked under. What's the one habit of theirs you stole?",
    hint: 'Name the habit concretely: a ritual, a phrase, a way of reviewing or running a meeting.',
    followUps: [
      "What's a habit from a weaker lead that you've caught yourself repeating?",
      'Would that person recognise the habit in how you lead now?',
    ],
    why: 'Where his leadership style comes from and which behaviours he consciously models.',
  },
  {
    id: 'leadership-002',
    topic: 'leadership',
    type: 'scale',
    depth: 1,
    prompt: "Once you've handed a piece of work to someone, how tightly do you hold on?",
    scale: { min: 1, max: 5, minLabel: 'Close to every detail', maxLabel: 'Goal only, see you at the demo' },
    hint: 'Think of the last thing you delegated, not the ideal.',
    followUps: [
      'What kind of work do you find hardest to hand over?',
      'Tell me about a time you took something back. What made you do it?',
    ],
    why: 'His default delegation style and where he struggles to let go.',
  },
  {
    id: 'leadership-003',
    topic: 'leadership',
    type: 'open',
    depth: 1,
    prompt: "What's the one question you ask in almost every 1:1?",
    hint: 'The actual words you use, not the idea behind them.',
    followUps: [
      "What do you do when someone answers 'all good' every single week?",
      'Whose agenda is the 1:1, yours or theirs?',
      'What do you do differently in a 1:1 with someone who is struggling?',
    ],
    why: 'How he runs 1:1s and what he pays attention to in the people he leads.',
  },
  {
    id: 'leadership-004',
    topic: 'leadership',
    type: 'story',
    depth: 2,
    prompt:
      'At Duit you were an Associate Software Engineer, early in your career, and already leading a remote team of 3. Tell me about a week when keeping that team moving was genuinely hard.',
    hint: 'Situation · what you did · what happened · what you would do differently now.',
    followUps: [
      'With no shared office, what held the team together day to day: standups, docs, chat, something else?',
      'What did you have to figure out about leading that nobody had taught you yet?',
      'How much did your title matter to how the team treated your decisions?',
    ],
    why: 'How he led before he had seniority, and which early lessons stuck.',
  },
  {
    id: 'leadership-005',
    topic: 'leadership',
    type: 'open',
    depth: 2,
    prompt:
      "You were promoted from Application Developer to Lead at ARO in January 2023. What's one thing you had to stop doing once you were the lead?",
    hint: 'Think about how your calendar, your time in the code and your conversations changed.',
    followUps: [
      'What do you think actually earned you the promotion?',
      'Did any working relationship on the team have to change after it? How?',
      'What did you keep doing that, looking back, you should have dropped?',
    ],
    why: 'How he understands the shift from individual contributor to lead.',
  },
  {
    id: 'leadership-006',
    topic: 'leadership',
    type: 'scenario',
    depth: 2,
    prompt:
      "Sprint planning at Pinhous scale: 12 developers, a two-week sprint, and three stakeholders who each insist their item is the top priority. Together those three items are about twice the team's capacity. How do you run the next hour?",
    hint: 'Minute by minute: who is in the room, what is on the screen, and how it ends.',
    followUps: [
      'Who gets told no, and who delivers that message?',
      'How much of the sprint do you leave unplanned for bugs and interruptions?',
      'How much of this negotiation does the team see, and what do you keep off their plate?',
    ],
    why: 'How he prioritizes under competing demands and protects a team while wearing both product and engineering hats.',
  },
  {
    id: 'leadership-007',
    topic: 'leadership',
    type: 'this-or-that',
    depth: 2,
    prompt: 'Code review with 12 developers shipping at Pinhous. Which was closer to how you ran it?',
    options: ['Every PR went through me', 'Peers reviewed, I spot-checked'],
    hint: 'Think about a typical PR, from opened to merged.',
    followUps: [
      "What's a review comment you left so often it became a team standard?",
      'What did you do when two engineers kept blocking each other in review?',
      'How long did a PR usually wait for a review, and did that bother you?',
    ],
    why: 'How he balances control and trust, and whether he uses review to teach or to gatekeep.',
  },
  {
    id: 'leadership-008',
    topic: 'leadership',
    type: 'story',
    depth: 2,
    prompt:
      'Tell me about one engineer you mentored on design patterns or coding standards at Pinhous, and what actually changed in their work.',
    hint: 'Situation · what you did · what happened · what you would do differently.',
    followUps: [
      'What did you try first that did not work?',
      'How did you know it had landed: a PR, a question they stopped asking, something else?',
      'What would they say was your most annoying mentoring habit?',
    ],
    why: 'How he grows engineers and what effective mentoring looks like to him in practice.',
  },
  {
    id: 'leadership-009',
    topic: 'leadership',
    type: 'this-or-that',
    depth: 2,
    prompt: 'At Pinhous you were Product Lead and also owned the architecture. When the two hats disagreed, which one usually won?',
    options: ['The product hat', 'The engineering hat'],
    hint: 'Think of one specific call where they pulled in different directions.',
    followUps: [
      'Name one decision where the losing hat should have won.',
      'Would you take a role that combines both again, or would you rather split them?',
    ],
    why: 'Which instinct dominates when product and engineering priorities pull apart.',
  },
  {
    id: 'leadership-010',
    topic: 'leadership',
    type: 'open',
    depth: 2,
    prompt:
      'At Create Club the clients paying you could overrule you on anything. How do you lead a project when the final say belongs to someone else?',
    hint: 'Pick one client engagement and describe what you did in the first two weeks.',
    followUps: [
      'What did you insist on in every engagement, even when the client did not ask for it?',
      'Tell me about a time a client overruled you and turned out to be right.',
      'How is leading work through a consultancy, as with the beverage-company agents, different from leading with a direct client?',
    ],
    why: 'How he leads through influence when he holds neither the budget nor the final word.',
  },
  {
    id: 'leadership-011',
    topic: 'leadership',
    type: 'scenario',
    depth: 2,
    prompt:
      "Imagine it's three weeks after the Eddy work tracker replaced the shared Excel sheet. A group of field technicians still send updates by text and email, their manager doesn't report to you, and items are starting to get lost again. What do you do?",
    hint: 'Your first move, and who you talk to first.',
    followUps: [
      'What would you change in the product, and what in the process?',
      'When is it right to switch off the old way entirely?',
      'How do you change the habits of a third-party vendor when you have no contract leverage?',
    ],
    why: 'How he drives adoption and leads without authority across teams, field staff and vendors.',
  },
  {
    id: 'leadership-012',
    topic: 'leadership',
    type: 'story',
    depth: 3,
    prompt:
      'Tell me about rolling out Claude Code and GitHub Copilot to the engineering team at Eddy, focusing on whoever took longest to come around (no names needed).',
    hint: 'Situation · what you did · what happened · what you would do differently.',
    followUps: [
      'What was their objection in their own words, and was any of it right?',
      'What norms did you set so AI-written code did not lower the bar in review?',
      'How do you tell real adoption apart from people just having a licence?',
    ],
    why: 'How he drives change and earns buy-in for new tools rather than mandating them.',
  },
  {
    id: 'leadership-013',
    topic: 'leadership',
    type: 'scenario',
    depth: 3,
    prompt:
      'You lead a team of 6. One engineer, well liked and solid last quarter, has missed three sprint commitments in a row, and two teammates have quietly started picking up the slack. What do you do this week?',
    hint: 'Describe the first conversation: where it happens and what you say in the first minute.',
    followUps: [
      'What changes if they tell you something personal is going on?',
      'At what point do your manager or HR get involved, and how does the engineer find out?',
      'What do you say to the two teammates who have been covering?',
    ],
    why: 'How he handles underperformance: directness, empathy and fairness to the rest of the team.',
  },
  {
    id: 'leadership-014',
    topic: 'leadership',
    type: 'open',
    depth: 3,
    prompt:
      'How would you know, concretely, whether the most junior engineer on your team would tell you straight away that they broke production?',
    hint: 'The signals you would look for, and what you have actually done to earn that trust.',
    followUps: [
      'What do you do in the first five minutes after someone admits a mistake?',
      'Have you ever made a team feel less safe without meaning to? What happened?',
    ],
    why: 'How he builds psychological safety in practice, beyond saying the words.',
  },
]

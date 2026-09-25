import type { Question } from './types'

export const ORIGINS: Question[] = [
  {
    id: 'origins-001',
    topic: 'origins',
    type: 'open',
    depth: 1,
    prompt: 'Before any of the engineering, what was the kid version of you always taking apart, building or obsessing over?',
    hint: 'Pick one object, game or project you can still picture clearly.',
    followUps: [
      'Who encouraged it, and who tried to get you to stop?',
      'What does that kid have in common with the person building MCP servers today?',
    ],
    why: 'The earliest root of his curiosity, and whether he is a builder, a tinkerer or an explainer by default.',
  },
  {
    id: 'origins-002',
    topic: 'origins',
    type: 'rapid',
    depth: 1,
    prompt: 'Where does the name curlycloud come from?',
    hint: 'The short version is fine. The real version is better.',
    followUps: [
      'Why go by curlycloud for the site and the X handle instead of just your name?',
      'Has anyone ever guessed the origin correctly?',
    ],
    why: 'The personal story behind his public identity, told the way he would tell it.',
  },
  {
    id: 'origins-003',
    topic: 'origins',
    type: 'open',
    depth: 2,
    prompt:
      'You did the IB in Mumbai and then chose mechanical engineering with a nuclear specialism in Manchester. Why nuclear, of all things?',
    hint: 'Was it the physics, the stakes, a person, a documentary, or a bet on where the world was heading?',
    followUps: [
      'When you started at Manchester, what did you picture your career looking like by now?',
      'Which part of nuclear engineering thinking do you still use every week?',
      'Why the UK rather than staying in India or going to the US?',
    ],
    why: 'What drew him to high-stakes, safety-critical engineering, and what of that mindset survives in his software work.',
  },
  {
    id: 'origins-004',
    topic: 'origins',
    type: 'this-or-that',
    depth: 1,
    prompt:
      'When you left Mumbai for university in the UK, were you mostly running toward something specific or away from the obvious path?',
    options: ['Toward something specific', 'Away from the obvious path'],
    hint: 'Think about what the realistic alternatives were that year.',
    followUps: ['Who did you have to convince, if anyone?', 'What did Manchester give you that staying would not have?'],
    why: 'Whether his big moves are pulled by a clear goal or pushed by restlessness.',
  },
  {
    id: 'origins-005',
    topic: 'origins',
    type: 'story',
    depth: 3,
    prompt:
      'In 2019 you were back in Mumbai preparing for GATE, and then the pandemic changed the plan entirely. Take me through the months when the engineering path closed and software opened up.',
    hint: "Situation · what you did · what happened · what you'd do differently.",
    followUps: [
      'Was the pivot a decision you made, or something you noticed you had already made?',
      'Who did you tell first, and how did they take it?',
      'How did you go from teaching yourself Python to leading a team of three at Duit within a year?',
    ],
    why: 'How he responds when a plan collapses, and whether he frames setbacks as openings.',
  },
  {
    id: 'origins-006',
    topic: 'origins',
    type: 'story',
    depth: 2,
    prompt:
      'You started programming with Python for data science and algorithmic trading. Tell me about the first program you wrote that made you genuinely proud.',
    hint: "Situation · what you built · what happened when it ran · what you'd do differently now.",
    followUps: ['Did it ever touch real money or real users?', 'Looking at that code today, what would make you wince?'],
    why: 'What "proud" means to him in code, and the kind of problem that first hooked him.',
  },
  {
    id: 'origins-007',
    topic: 'origins',
    type: 'open',
    depth: 3,
    prompt:
      'When did AI actually click for you, not as a buzzword but as something you wanted to spend your career building with? Describe the moment.',
    hint: 'A specific model, demo, paper, class or problem you were stuck on.',
    followUps: [
      'Was that before or after Durham College, and did the course sharpen it or slow it down?',
      'What did you believe about AI back then that turned out to be wrong?',
      'When did you first feel it change how you personally work, not just what you build?',
    ],
    why: 'The origin of his AI conviction and how grounded, rather than hype-driven, it is.',
  },
  {
    id: 'origins-008',
    topic: 'origins',
    type: 'this-or-that',
    depth: 2,
    prompt:
      'In 2021, after a year of shipping real code at Duit, you moved to Canada for a graduate certificate in AI at Durham College. Which was the bigger pull?',
    options: ['The AI course itself', 'A life in Canada'],
    hint: 'Be honest about which one came first in your head.',
    followUps: [
      'Why go back to a classroom when you were already learning on the job?',
      'What was your first month in Canada like?',
      'When you arrived, did you expect to stay long term?',
    ],
    why: 'The real reason behind his move to Canada, and how he values formal learning against learning on the job.',
  },
  {
    id: 'origins-009',
    topic: 'origins',
    type: 'open',
    depth: 2,
    prompt: 'Which person, a teacher, boss or peer, most changed the way you work?',
    hint: 'Name one habit you have today because of them.',
    followUps: [
      'What exactly did they do that stuck?',
      'Did they know at the time that they were shaping you?',
      'Who are you doing that for now?',
    ],
    why: 'Who shaped his standards, and whether he pays it forward.',
  },
  {
    id: 'origins-010',
    topic: 'origins',
    type: 'scale',
    depth: 2,
    prompt: 'Looking back, how much of the path from nuclear engineering to AI engineering was planned versus stumbled into?',
    scale: { min: 1, max: 5, minLabel: 'Carefully planned', maxLabel: 'Entirely stumbled into' },
    hint: 'Put a number on it, then defend it with one move from your history.',
    followUps: ['Which single move was the most deliberate?', 'Which lucky break would you not want anyone to try to copy?'],
    why: 'How he narrates his own agency versus luck, which shapes how the clone tells his story.',
  },
  {
    id: 'origins-011',
    topic: 'origins',
    type: 'scenario',
    depth: 3,
    prompt:
      'Imagine the pandemic never happens. You sit GATE, do well, and land a solid engineering job in the nuclear sector. Where is that version of you today, and is he happier than you?',
    hint: 'Be honest about what that path would have given you that software has not.',
    followUps: [
      'What would he envy about your life?',
      'In 2026 you built regdocs over Canadian nuclear safety documents. Was that a coincidence, or a way back to him?',
      'Would you work in the nuclear industry again if the job was AI work?',
    ],
    why: 'What he gave up in the pivot, and whether nuclear is a closed chapter or a thread he keeps pulling.',
  },
  {
    id: 'origins-012',
    topic: 'origins',
    type: 'scenario',
    depth: 2,
    prompt:
      "A student in Mumbai finishing the IB messages you. They're about to commit to mechanical engineering abroad, but they're secretly more excited by AI, and they have to confirm their university choice this week. What do you tell them?",
    hint: 'Answer as if they were you in 2016, then check whether the advice changes.',
    followUps: [
      'Would you tell them to skip the engineering degree?',
      'What is the one thing you wish someone had told you at that point?',
    ],
    why: 'What he would tell his younger self, revealing which parts of his path he values and which he would skip.',
  },
  {
    id: 'origins-013',
    topic: 'origins',
    type: 'open',
    depth: 3,
    prompt:
      "What's the feeling you're chasing when you build something? Describe the exact moment in a project that makes all of it worth it.",
    hint: 'Think of a specific project, such as the day a team at Eddy first used your work tracker instead of the Excel sheet.',
    followUps: [
      'Has that feeling changed since your Duit days?',
      'What kills that feeling fastest?',
      'Is it the same feeling when the thing you built is only for yourself?',
    ],
    why: 'His core intrinsic motivation, the thing the clone should sound genuinely excited about.',
  },
  {
    id: 'origins-014',
    topic: 'origins',
    type: 'this-or-that',
    depth: 3,
    prompt:
      'You turned your site into a 1984 Mac desktop and are now building an AI clone of yourself that anyone can talk to. Is building in public mostly for you, or mostly for the people watching?',
    options: ['Mostly for me', 'Mostly for the people watching'],
    hint: 'Think about what you would still build if nobody ever saw it.',
    followUps: [
      "What's something you built that you deliberately never showed anyone?",
      'What does a stranger get wrong about you from your public work?',
      'How do you feel about a clone of you answering questions while you sleep?',
    ],
    why: 'Why he builds in public, and how he balances audience against craft.',
  },
]

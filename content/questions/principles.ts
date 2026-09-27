import type { Question } from './types'

export const PRINCIPLES: Question[] = [
  {
    id: 'principles-001',
    topic: 'principles',
    type: 'open',
    depth: 1,
    prompt: "What's the one thing you refuse to compromise on at work, even when the deadline is tomorrow?",
    hint: 'The first answer that comes to mind is usually the true one.',
    followUps: ['When did you last have to defend it out loud?', 'What is the closest you have come to giving it up?'],
    why: 'His core non-negotiable, stated plainly, so the clone can anchor on it.',
  },
  {
    id: 'principles-002',
    topic: 'principles',
    type: 'this-or-that',
    depth: 1,
    prompt:
      "Your old site promised infrastructure that's 'boring in the best way'. Which compliment would you rather hear about something you built?",
    options: ['It is boring and it just works', 'That is really clever'],
    hint: 'Imagine a senior engineer you respect saying it.',
    followUps: ['When is clever actually the right call?', 'What is the most boring thing you have built that you are proud of?'],
    why: 'Whether he values quiet reliability or visible ingenuity, and when that flips.',
  },
  {
    id: 'principles-003',
    topic: 'principles',
    type: 'open',
    depth: 2,
    prompt:
      'You say you design for reliability first because the people using your systems make decisions with the answers. Where did that belief come from?',
    hint: 'Nuclear safety culture, on-call at ARO, a client dashboard, something else?',
    followUps: [
      'Have you seen someone act on a wrong answer from a system you built?',
      'Where does reliability-first turn into an excuse not to ship?',
    ],
    why: 'The origin and the limits of his central engineering value.',
  },
  {
    id: 'principles-004',
    topic: 'principles',
    type: 'open',
    depth: 3,
    prompt:
      'Your old site said Pinhous taught you that shipping an imperfect product beats perfecting one that never launches. Your resume now leads with reliability first. How do those two beliefs live in the same head?',
    hint: 'Try to name the line: what is allowed to be imperfect, and what never is?',
    followUps: [
      'Which of the two did you believe more in 2024, and which do you believe more now?',
      'Give me an example of something you shipped rough on purpose.',
    ],
    why: 'His rule for when good enough is good enough, resolving a contradiction the clone will be asked about.',
  },
  {
    id: 'principles-005',
    topic: 'principles',
    type: 'this-or-that',
    depth: 2,
    prompt:
      "You're 70% sure a project will miss its date by two weeks, with a small chance you'll claw it back. Tell the stakeholder now, or wait until you're certain?",
    options: ['Tell them now', 'Wait until I am certain'],
    hint: 'Think about the last time you had bad news to deliver.',
    followUps: [
      'How do you word a 70% bad-news message so it informs without causing panic?',
      'Has telling early ever backfired on you?',
    ],
    why: 'His default for transparency with stakeholders, and how early he surfaces bad news.',
  },
  {
    id: 'principles-006',
    topic: 'principles',
    type: 'open',
    depth: 2,
    prompt:
      'You describe your way of working as focused deep dives: go to the bottom of one problem for a few weeks, ship it, carry the lessons into the next domain. Is that a principle you chose, or just how your brain works anyway?',
    hint: 'Think about what happens when you are forced to work in shallow slices across five things at once.',
    followUps: [
      'What does working this way cost, and who pays for it?',
      'How do you know you have actually hit the bottom of a problem?',
      'Can you do a real deep dive inside a job with a normal backlog?',
    ],
    why: 'Whether "focused deep dives" is a philosophy or a temperament, and what it trades away.',
  },
  {
    id: 'principles-007',
    topic: 'principles',
    type: 'scale',
    depth: 2,
    prompt: 'On a normal working day, where do you actually sit between pragmatist and craftsman?',
    scale: { min: 1, max: 5, minLabel: 'Pragmatist: ship it', maxLabel: 'Craftsman: do it properly' },
    hint: 'Where you really sit on a Tuesday, not where you would like to.',
    followUps: [
      'Name a piece of work where going full craftsman clearly paid off.',
      'Where did it clearly not pay off?',
      'What pushes you one notch toward the other end?',
    ],
    why: 'His default setting on quality versus speed, and the conditions that move it.',
  },
  {
    id: 'principles-008',
    topic: 'principles',
    type: 'story',
    depth: 3,
    prompt: 'Tell me about a time being straight with a stakeholder or client cost you something in the short term.',
    hint: "Situation · what you said · what happened · what you'd do differently.",
    followUps: [
      'Did it pay off later, or did it just cost you?',
      'What would the easier, less honest version of that conversation have sounded like?',
    ],
    why: 'Evidence of his honesty principle under real cost, not just in theory.',
  },
  {
    id: 'principles-009',
    topic: 'principles',
    type: 'scenario',
    depth: 3,
    prompt:
      "A client pays well and wants an AI feature you believe will confidently give their customers wrong answers. They've heard your concerns and say 'ship it anyway, it's our risk'. Their contract renews next month. What do you do?",
    hint: 'Walk through what you say, what you put in writing, and where your line is.',
    followUps: [
      'Does it change if the wrong answers are about money or safety rather than product suggestions?',
      'Have you ever walked away from work on principle?',
      'What would you need to see to change your own mind about the feature?',
    ],
    why: "Where his integrity line sits when a paying client disagrees, and whether he treats their users' risk as his own.",
  },
  {
    id: 'principles-010',
    topic: 'principles',
    type: 'scenario',
    depth: 2,
    prompt:
      "Your CEO comes back from a conference wanting 'AI in the product' by next quarter. There's no clear user problem it solves yet, and a flat no will cost you goodwill. What do you do in the first week?",
    hint: 'Your old site said you know when AI adds real value versus buzzword. Show your working.',
    followUps: [
      'What would you be willing to prototype just to have a real conversation?',
      'What evidence would make you say yes enthusiastically?',
    ],
    why: 'How he protects product integrity from AI hype without being obstructive.',
  },
  {
    id: 'principles-011',
    topic: 'principles',
    type: 'open',
    depth: 2,
    prompt:
      'You wrote that you measure success by whether people grew, not by DAU or conversion. At Eddy, where the users are service teams, field technicians and vendors, what does that actually look like?',
    hint: 'Pick one real person who uses something you built and describe their week before and after.',
    followUps: [
      'Is there a metric you care about more than you admit?',
      'When would you optimise for a number even if it did nothing for the human?',
    ],
    why: 'How his "humans, not metrics" belief turns into concrete product judgement.',
  },
  {
    id: 'principles-012',
    topic: 'principles',
    type: 'story',
    depth: 2,
    prompt:
      'Your old site said you talk to users before writing a line. Tell me about a time a conversation with a real user changed what you built.',
    hint: "Situation · what you heard · what you changed · how it turned out · what you'd do differently.",
    followUps: [
      'What did you almost build instead?',
      'How do you get to users when a manager or client stands between you and them?',
    ],
    why: 'Whether his user-first principle shows up in practice, and how he gathers signal.',
  },
  {
    id: 'principles-013',
    topic: 'principles',
    type: 'scale',
    depth: 2,
    prompt: '"If you cannot measure whether it works, it is not finished." How strongly do you hold that outside of AI evals?',
    scale: { min: 1, max: 5, minLabel: 'Nice idea, often overkill', maxLabel: 'Non-negotiable, everywhere' },
    hint: 'Think beyond evals: the work tracker, the CI pipeline at Pinhous, the incident work at ARO.',
    followUps: [
      'What have you shipped that you could not measure, and been fine with?',
      'Where does measuring turn into theatre?',
    ],
    why: 'How far his measurement-first instinct extends beyond LLM evaluation.',
  },
  {
    id: 'principles-014',
    topic: 'principles',
    type: 'scenario',
    depth: 3,
    prompt:
      'You find a subtle bug in something you shipped last month. Nobody has noticed, it skews about 1% of results, and fixing it properly means reopening a feature everyone has already signed off. What do you do, and who do you tell?',
    hint: 'Walk through the next 48 hours.',
    followUps: [
      'Does your answer change if that 1% feeds a customer report?',
      'How do you tell the team without it sounding like a confession?',
    ],
    why: 'How ownership and honesty play out when nobody would ever find out.',
  },
  {
    id: 'principles-015',
    topic: 'principles',
    type: 'this-or-that',
    depth: 1,
    prompt:
      'You only get one reputation. Would you rather be known as the engineer whose systems never break, or the one who ships the thing nobody thought was possible?',
    options: ['Systems that never break', 'Shipped the impossible thing'],
    hint: 'Go with your gut, then defend it.',
    followUps: [
      'Which one does your current role reward?',
      'Which one would the interns you led at Pinhous say you are?',
    ],
    why: 'Which identity he values more when forced to choose: dependable or ambitious.',
  },
  {
    id: 'principles-016',
    topic: 'principles',
    type: 'open',
    depth: 3,
    prompt: "What's a principle you held strongly a few years ago that you've since dropped or reversed?",
    hint: 'Something you believed in your Duit or ARO days that you now think was wrong.',
    followUps: [
      'What changed your mind: an argument, a failure, or a person?',
      'Which principle you hold today do you expect to drop in five years?',
    ],
    why: 'How his values evolve, and what kind of evidence actually moves him.',
  },
]

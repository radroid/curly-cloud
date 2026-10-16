/**
 * The prompt on /prompt-course: a visitor pastes it into a coding agent, which reads their own prompt
 * history and builds them a private prompting course. Public text; nothing personal goes in here.
 */
export const PROMPT_COURSE_FILE = 'build-my-course.md'

export const PROMPT_COURSE = `# Build my personalized prompt-engineering course

## What I want

Study how I actually prompt AI systems, find the habits that cost me the most, and turn that into a short course built around my own prompts. The reference framework is "The Prompt Report: A Systematic Survey of Prompt Engineering Techniques" (Schulhoff et al., arXiv 2406.06608, https://arxiv.org/abs/2406.06608). I want to work through the course over about four weeks, in sessions of 20 to 30 minutes.

## Who I am

Work this out rather than asking me. Use what you already know about me (memory, CLAUDE.md or AGENTS.md files) and what my prompts show: my role, the work I prompt for most, and whether I run unattended agents or loops. Put two or three lines at the top of the course under "What I assumed about you" so I can correct them. Treat prompts that another model reads with no chance to ask me questions (agent briefs, loop prompts, skills, system prompts) as seriously as my chat messages.

If I have added a line after this prompt saying what I want to get better at, weight the course toward it.

## Step 1: Collect the evidence

Gather prompts I wrote, from every source you can reach:

- My conversation history with you, and with any other assistant you can search or that I have exported.
- Coding-agent session transcripts on this machine (for Claude Code, look under ~/.claude/projects; for Codex, ~/.codex; check any desktop apps that wrap them).
- Standing prompts in my repos and config: CLAUDE.md, AGENTS.md and SKILL.md files, system prompts, scheduled-task prompts, and prompt templates inside code. Separate what I wrote from third-party skills I installed.

Analyze only text I wrote. Use the model's replies for one thing: judging whether a prompt got what it was after (did I have to re-ask, correct, or clarify?). Leave out machine-generated prompts (title generators, commit-message generators, automated reviews) and prompts written by a model for a subagent.

Before analyzing, tell me which sources you reached, roughly how many prompts each holds, the date range, and what you could not access. If you find fewer than about 50 prompts, say so and treat your conclusions as tentative.

For a large history, sample instead of reading everything: cover every source, favor the last six months, and include both my shortest and my longest prompts.

## Step 2: Score each prompt against the framework

Sort prompts by task type: coding, agent or system prompt, writing, research, analysis, quick question. Quick questions rarely need technique, so don't mark them down. For the rest, record:

1. Components. Is there a clear directive? Are role, examples, output format, style, and the additional information the model needs present where they would help? What did I assume the model knew that it could not have known?
2. Examples. When I had examples available, did I include them? How many, how varied, how balanced across cases, how consistently formatted?
3. Reasoning. On tasks that need reasoning, did I ask for a plan or for reasoning before the answer, or split the task into sub-problems (least-to-most, plan-and-solve, a prompt chain)?
4. Checking. Did I build in verification (self-critique, chain-of-verification, tests, a second pass), or accept the first output?
5. Answer engineering. Did I specify the shape of the answer precisely enough that I or my code could use it without rework?
6. Ambiguity. Could the request be read two ways? Did I invite clarifying questions?
7. Leading the witness. Did I state my own opinion or the answer I hoped for in a way that invites agreement (the report's sycophancy finding)?
8. Iteration. When a first prompt failed, did I diagnose and revise it, or re-roll and pile on corrections? Count the follow-up turns a better first prompt would have saved.
9. Agent and system prompts only. Are the tools, the stopping conditions, what "done" looks like, and what to do when blocked all specified? Is untrusted content (web pages, files, tool output) kept separate from instructions, as the report's prompt-injection section recommends?
10. Evaluation. For prompts I reuse, do I have any test cases, or do I judge by feel?

## Step 3: Find my patterns

Report the five to seven habits with the largest cost, ranked by how often they occur multiplied by how much rework they caused. For each, quote two or three of my actual prompts exactly, with source and date. Check every quote verbatim against the source before using it.

Also list what I already do well, briefly, so the course does not re-teach it.

I want an accurate diagnosis, not encouragement. If my prompting is mostly fine, say that and make the course shorter.

## Step 4: Build the course

One module per habit, starting with the one that costs me most. Each module has:

- The pattern, shown in my own prompts.
- Why it costs me, tied to the relevant part of the report. Mark which claims come from the report and which are your own judgment. The report's experiments used 2023 and 2024 models, so flag any finding that may not hold for the models I use today.
- The technique to use instead, and when it is not worth the effort.
- A before and after: rewrite one of my real prompts and explain each change in one line.
- Two drills based on work I am doing now, with the model answer hidden until I have tried.
- A one-line rule I can keep.

Then add:

- A baseline scorecard: 0 to 3 on each of the ten dimensions above, with the evidence, in a form I can re-run in a month.
- A small library of reusable templates for my five most common tasks, written the improved way.
- A four-week schedule.
- A closing section on testing prompts: how to set up a small evaluation set for the prompts I reuse. The report's main lesson is that a technique's effect is unpredictable and has to be measured, so I want the habit of measuring.

## Rules

- Read-only. Do not modify, delete, or send anything anywhere. Keep all of this on this machine.
- Redact secrets, keys, and tokens if they appear in a prompt you quote. Skip conversations about health, finances, or other private personal matters entirely; they are not needed for this.
- If something blocks you, or a source needs my permission, finish what you can and list what is outstanding at the end instead of stopping.

## What to give me back

One self-contained HTML file named prompt-course.html, saved outside any git repository. Open it with a half-page summary: what you assumed about me, the sources you covered, my baseline scores, and my top three habits. Everything else follows from that. Track my progress (completed sections, drill attempts, re-run scores) in localStorage, with export and import buttons so I can move my progress between devices.`

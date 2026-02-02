import { Timeline } from 'app/components/timeline'

const timelineData = [
  {
    year: '2025 – Present',
    title: 'Building & Shipping',
    description: 'Co-founded ARK Experiences — built the full-stack event platform from scratch (React, Next.js, Node.js, PostgreSQL). Scaled to 20+ participants. Running Create Club simultaneously — shipping production apps for startups across Toronto and Silicon Valley. Launched Stella 56 Diamonds as an e-commerce platform. Three ventures, three different problem spaces, all running on code I wrote.',
    emoji: '🚀',
  },
  {
    year: 'Early 2025',
    title: 'Learning from Failure',
    description: 'Pinhous didn\'t work out. A real estate startup where I led 12 developers, built the AWS/Docker pipeline, and learned that shipping an imperfect product beats perfecting one that never launches. The company didn\'t survive, but the lessons did: move faster, validate harder, and never let perfect be the enemy of deployed.',
    emoji: '💪',
  },
  {
    year: '2024',
    title: 'First Startup & Consulting',
    description: 'Co-founded Pinhous — my first real startup. Led product and engineering simultaneously. Also started Create Club to help other founders ship their products. Earned a Technical Product Management certificate from BrainStation, formalizing the product thinking I\'d been doing all along.',
    emoji: '🏗️',
  },
  {
    year: '2022 – 2023',
    title: 'Going Deep in Enterprise',
    description: 'Joined ARO Inc. as an Application Developer. Within 8 months, promoted to Lead Application Developer. Built full-stack automation solutions (Python + web frontends), deployed ML models for document processing, and led the migration from a legacy jBase database to modern SQL. Learned what operational excellence looks like at scale — on-call rotations, incident response, and reducing recurring issues by 20%.',
    emoji: '💼',
  },
  {
    year: '2021 – 2022',
    title: 'Graduate Certificates in AI & Data',
    description: 'Durham College, Canada. Two back-to-back programs: Data Analytics for Business Decision Making, and AI Design, Implementation & Architecture. This is where Python and machine learning stopped being hobbies and became career tools.',
    emoji: '📊',
  },
  {
    year: '2020 – 2021',
    title: 'The Pivot Pays Off — First Software Role',
    description: 'Joined DUIT.io as an Associate Software Engineer. Built a fintech analytics platform on Google Cloud, led a team of three, and cut decision-making latency by 67%. Simultaneously completed Udacity\'s Machine Learning Nanodegree. Proved to myself that the pivot was the right call.',
    emoji: '🤖',
  },
  {
    year: 'March 2020',
    title: 'The Pivot',
    description: 'COVID shut down the world. I shut down my GATE exam prep and pivoted to software development. Started with Python for data science and algorithmic trading. Never looked back.',
    emoji: '🔄',
  },
  {
    year: 'October 2019 – March 2020',
    title: 'GATE Preparation',
    description: 'After graduating, prepared for the Graduate Aptitude Test in Engineering — the path to a PSU engineering role in India. Then a global pandemic changed the plan entirely.',
    emoji: '📝',
  },
  {
    year: '2016 – 2019',
    title: 'University of Manchester, UK',
    description: 'Mechanical Engineering with Nuclear Engineering. Three years of complex systems, precision thinking, and safety-first design. The engineering mindset stuck. The nuclear part didn\'t.',
    emoji: '🎓',
  },
  {
    year: '2014 – 2016',
    title: 'International Baccalaureate',
    description: 'Foundation years. Rigorous academics and the beginning of a global perspective that would eventually take me from Mumbai to Manchester to Toronto.',
    emoji: '📚',
  },
]

export default function HistoryPage() {
  return (
    <section className="w-full">
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tighter mb-4">
          History
        </h1>
        <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
          From nuclear engineering to shipping software — through pivots, failures, and a lot of building.
        </p>
      </div>

      <Timeline items={timelineData} />
    </section>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject, getAllProjects } from '@/app/lib/projects'
import { baseUrl } from '@/app/sitemap'

export async function generateStaticParams() {
    const projects = getAllProjects()
    return projects.map((project) => ({
        slug: project.id,
    }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const project = getProject(slug)

    if (!project) {
        return {}
    }

    return {
        title: project.title,
        description: project.shortDescription,
        alternates: {
            canonical: `${baseUrl}/projects/${project.id}`,
        },
        openGraph: {
            title: project.title,
            description: project.shortDescription,
            type: 'website',
            url: `${baseUrl}/projects/${project.id}`,
        },
    }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const project = getProject(slug)

    if (!project) {
        notFound()
    }

    return (
        <section className="w-full">
            <div className="mb-6">
                <Link
                    href="/"
                    className="text-sm hover:opacity-70 transition-opacity"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                    ← Back to portfolio
                </Link>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tighter mb-2" style={{ textWrap: 'balance' }}>
                    {project.title}
                </h1>
                <p className="text-sm mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    {project.role}
                </p>
                {project.video && (
                    <div className="w-full aspect-video rounded-lg overflow-hidden mb-6">
                        <video
                            src={project.video}
                            className="w-full h-full object-contain"
                            controls
                            autoPlay
                            playsInline
                            loop
                            muted
                        />
                    </div>
                )}
            </div>

            <div className="space-y-6 mb-8">
                {project.problem && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Problem</h2>
                        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{project.problem}</p>
                    </div>
                )}

                <div>
                    <h2 className="text-lg font-semibold mb-2">My role</h2>
                    <p style={{ color: 'rgb(var(--muted-foreground))' }}>{project.description}</p>
                </div>

                {project.aiComponent && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">AI/ML component</h2>
                        <p style={{ color: 'rgb(var(--muted-foreground))' }}>{project.aiComponent}</p>
                    </div>
                )}

                {project.productDecisions && project.productDecisions.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Product decisions</h2>
                        <ul className="space-y-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                            {project.productDecisions.map((decision, index) => (
                                <li key={index}>• {decision}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {project.impact && project.impact.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold mb-2">Impact / validation</h2>
                        <ul className="space-y-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                            {project.impact.map((item, index) => (
                                <li key={index}>• {item}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Technologies</h2>
                <div className="flex flex-wrap gap-2">
                    {project.technologies.map((tech) => (
                        <span
                            key={tech}
                            className="px-3 py-1 rounded-full text-sm"
                            style={{
                                backgroundColor: 'rgb(var(--card))',
                                color: 'rgb(var(--foreground))',
                            }}
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </div>

            {project.url && (
                <div className="pt-6 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'rgb(var(--foreground))' }}
                    >
                        Visit project →
                    </a>
                </div>
            )}
        </section>
    )
}


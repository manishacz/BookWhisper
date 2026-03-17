import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus } from 'lucide-react'

const steps = [
    {
        number: 1,
        title: 'Upload PDF',
        description: 'Add your book file',
    },
    {
        number: 2,
        title: 'AI Processing',
        description: 'We analyze the content',
    },
    {
        number: 3,
        title: 'Voice Chat',
        description: 'Discuss with AI',
    },
]

const HeroSection = () => {
    return (
        <section className="library-hero-card wrapper pt-28 mb-10 lg:mb-16">
            <div className="library-hero-content">

                {/* LEFT — Text + CTA */}
                <div className="library-hero-text">
                    <h1 className="library-hero-title">Your Library</h1>
                    <p className="library-hero-description">
                        Convert your books into interactive AI conversations.<br />
                        Listen, learn, and discuss your favorite reads.
                    </p>

                    {/* Mobile illustration */}
                    <div className="library-hero-illustration">
                        <Image
                            src="/assets/hero-illustration.png"
                            alt="Vintage books and globe illustration"
                            width={260}
                            height={200}
                            className="object-contain drop-shadow-md"
                            priority
                        />
                    </div>

                    <Link href="/books/new" className="library-cta-primary">
                        <Plus className="w-5 h-5" strokeWidth={2.5} />
                        Add new book
                    </Link>
                </div>

                {/* CENTER — Illustration (desktop only) */}
                <div className="library-hero-illustration-desktop">
                    <Image
                        src="/assets/hero-illustration.png"
                        alt="Vintage books and globe illustration"
                        width={340}
                        height={260}
                        className="object-contain drop-shadow-md"
                        priority
                    />
                </div>

                {/* RIGHT — Steps card */}
                <div className="library-steps-card flex-shrink-0 w-full lg:w-[220px] space-y-4">
                    {steps.map((step, idx) => (
                        <div key={step.number} className="library-step-item">
                            <span className="library-step-number">{step.number}</span>
                            <div className="flex flex-col">
                                <span className="library-step-title">{step.title}</span>
                                <span className="library-step-description">{step.description}</span>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}

export default HeroSection

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getBookBySlug } from '@/lib/actions/book.actions';

interface BookPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookPage({ params }: BookPageProps) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { slug } = await params;
  const result = await getBookBySlug(slug);

  if (!result.success || !result.data) redirect('/');

  const book = result.data as {
    title: string;
    author: string;
    coverURL?: string;
    persona?: string;
  };

  const voiceLabel = book.persona
    ? book.persona.charAt(0).toUpperCase() + book.persona.slice(1)
    : 'Rachel';

  const hasCover = typeof book.coverURL === 'string' && book.coverURL.startsWith('http');

  return (
    <div className="book-page-container">
      {/* ── Floating back button ── */}
      <Link href="/" className="back-btn-floating" aria-label="Back to library">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-[var(--text-primary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* ── Centered content column ── */}
      <div className="max-w-4xl mx-auto flex flex-col gap-4">

        {/* ── 1. Header card ── */}
        <div className="vapi-header-card">
          {/* Cover + mic button */}
          <div className="vapi-cover-wrapper">
            {hasCover ? (
              <Image
                src={book.coverURL as string}
                alt={book.title}
                width={120}
                height={180}
                className="vapi-cover-image"
                unoptimized
              />
            ) : (
              /* Placeholder cover when no image */
              <div
                className="vapi-cover-image flex items-center justify-center bg-[#e8e0d5]"
                style={{ width: 120, height: 180 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-10 h-10 text-[#8a7560]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            )}

            {/* Mic button overlapping bottom-right of cover */}
            <div className="vapi-mic-wrapper">
              <button
                type="button"
                className="vapi-mic-btn vapi-mic-btn-inactive"
                aria-label="Start voice session"
              >
                {/* Mic-off icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 text-[#555]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18.89 13.23A7.12 7.12 0 0019 12m-7 7a7 7 0 01-7-7m7 7v3m0 0H9m3 0h3M12 3a3 3 0 013 3v4"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.13 9.13A3 3 0 009 12a3 3 0 006 0v-.13"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Book meta */}
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            <h1
              className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight font-serif"
            >
              {book.title}
            </h1>
            <p className="text-base text-[var(--text-secondary)]">by {book.author}</p>

            {/* Pill badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {/* Status */}
              <span className="vapi-status-indicator">
                <span className="vapi-status-dot vapi-status-dot-ready" />
                <span className="vapi-status-text">Ready</span>
              </span>

              {/* Voice */}
              <span className="vapi-status-indicator">
                <span className="vapi-status-text">Voice:&nbsp;<strong>{voiceLabel}</strong></span>
              </span>

              {/* Timer */}
              <span className="vapi-status-indicator">
                <span className="vapi-status-text">0:00&nbsp;/&nbsp;15:00</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Transcript area ── */}
        <div className="transcript-container" style={{ minHeight: 400 }}>
          <div className="transcript-empty">
            {/* Large mic icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12 text-[var(--text-secondary)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-14 0M12 19v4M8 23h8"
              />
            </svg>
            <p className="transcript-empty-text">No conversation yet</p>
            <p className="transcript-empty-hint">Click the mic button above to start talking</p>
          </div>
        </div>

      </div>
    </div>
  );
}

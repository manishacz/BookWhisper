import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getBookBySlug } from '@/lib/actions/book.actions';
import VapiControls from "@/components/VapiControls";
import { IBook } from '@/types';
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

  const book = result.data as IBook;

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
      <VapiControls book={book} />
    </div>
  );
}

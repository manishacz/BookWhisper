import React from 'react'
import { auth } from '@clerk/nextjs/server'
import HeroSection from '@/components/ui/HeroSection'
import { BookCard } from '@/components/ui/BookCard'
import { getAllBooks } from '@/lib/actions/book.actions'

// Run dynamically so every request fetches the current user's own library
export const dynamic = 'force-dynamic';

const Page = async () => {
  const { userId } = await auth();
  const result = await getAllBooks(undefined, userId ?? undefined);
  const books: Array<{ _id: string; title: string; author: string; coverURL: string; slug: string }> =
    result.success && Array.isArray(result.data) ? result.data : [];

  return (
    <main className="wrapper container">
      <HeroSection />

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-16 h-16 text-[var(--text-secondary)] opacity-40"
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
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Your library is empty</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            Upload your first book using the &ldquo;Add New&rdquo; button to start your interactive literary journey.
          </p>
        </div>
      ) : (
        <div className="library-books-grid">
          {books.map((book) => (
            <BookCard
              key={book._id}
              title={book.title}
              author={book.author}
              coverURL={book.coverURL}
              slug={book.slug}
            />
          ))}
        </div>
      )}
    </main>
  )
}

export default Page
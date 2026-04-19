import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { BookCardProps } from '@/types'

// Fallback placeholder shown when a book has no cover image
const PLACEHOLDER_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="133" height="200" viewBox="0 0 133 200">
  <rect width="133" height="200" fill="#e8e0d5"/>
  <text x="50%" y="50%" font-family="serif" font-size="13" fill="#8a7560"
        text-anchor="middle" dominant-baseline="middle">No Cover</text>
</svg>`)}`;

export const BookCard = ({ title, author, coverURL, slug }: BookCardProps) => {
  const src = coverURL && coverURL.startsWith('http') ? coverURL : PLACEHOLDER_COVER;

  return (
    <Link href={`/books/${slug}`}>
      <article className="book-card">
        <figure className="book-card-figure">
          <div className="book-card-cover-wrapper">
            <Image
              src={src}
              alt={title}
              width={133}
              height={200}
              className="book-card-cover"
              // Skip Next.js server-side image proxy – browser fetches directly from Vercel Blob.
              // This prevents "upstream image response timed out" errors in dev and prod.
              unoptimized
            />
          </div>
          <figcaption className="book-card-meta">
            <h3 className="book-card-title">{title}</h3>
            <p className="book-card-author">{author}</p>
          </figcaption>
        </figure>
      </article>
    </Link>
  )
}

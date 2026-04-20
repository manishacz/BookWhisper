'use server';

import {CreateBook, TextSegment} from "@/types";
import {connectToDatabase} from "@/database/mongoose";
import {escapeRegex, generateSlug, serializeData} from "@/lib/utils";
import Book from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";
import mongoose from "mongoose";
import {getUserPlan} from "@/lib/subscription.server";

export const getAllBooks = async (search?: string, clerkId?: string) => {
    try {
        await connectToDatabase();

        // Scope to the authenticated user when a clerkId is provided
        const baseFilter: Record<string, unknown> = clerkId ? { clerkId } : {};

        const { auth } = await import("@clerk/nextjs/server");
        const { userId } = await auth();
        if (!userId) return { success: false, error: "Unauthorized" };

        const query: Record<string, unknown> = { clerkId: userId };
        if (search) {
            const escapedSearch = escapeRegex(search);
            const regex = new RegExp(escapedSearch, 'i');
             query.$or = [
                { title: { $regex: regex } },
                { author: { $regex: regex } },
            ];
            // Merge user scope with search so both filters apply
            // const searchFilter = {
            //     $or: [
            //         { title: { $regex: regex } },
            //         { author: { $regex: regex } },
            //     ],
            // };
            // query = clerkId ? { $and: [baseFilter, searchFilter] } : searchFilter;
        }

        const books = await Book.find(query).sort({ createdAt: -1 }).lean();

        return {
            success: true,
            data: serializeData(books)
        }
    } catch (e) {
        console.error('Error connecting to database', e);
        return {
            success: false, error: e instanceof Error ? e.message : String(e)
        }
    }
}

export const checkBookExists = async (title: string) => {
    try {
        await connectToDatabase();

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                exists: true,
                book: serializeData(existingBook)
            }
        }

        return {
            exists: false,
        }
    } catch (e) {
        console.error('Error checking book exists', e);
        return {
            exists: false, error: e instanceof Error ? e.message : String(e)
        }
    }
}

export const createBook = async (data: CreateBook) => {
    // Auth must be verified before any DB work
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();

    if (!userId || userId !== data.clerkId) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await connectToDatabase();

        const { getUserPlan } = await import("@/lib/subscription.server");
        const { PLAN_LIMITS } = await import("@/lib/subscription-constants");

        const slug = generateSlug(data.title);

        // Slug uniqueness is scoped per-user, not globally
        const existingBook = await Book.findOne({ slug, clerkId: userId }).lean();

        if (existingBook) {
            return {
                success: true,
                data: serializeData(existingBook),
                alreadyExists: true,
            };
        }

        const plan = await getUserPlan();
        const limits = PLAN_LIMITS[plan];

        const bookCount = await Book.countDocuments({ clerkId: userId });

        if (bookCount >= limits.maxBooks) {
            return {
                success: false,
                error: `You have reached the maximum number of books allowed for your ${plan} plan (${limits.maxBooks}). Please upgrade to add more books.`,
                isBillingError: true,
            };
        }

        const book = await Book.create({ ...data, clerkId: userId, slug, totalSegments: 0 });

        // Invalidate home page cache so the new book shows up immediately
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/');

        return {
            success: true,
            data: serializeData(book),
        };
    } catch (e: unknown) {
        // Handle MongoDB duplicate-key error (E11000) gracefully
        if (
            typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            (e as { code: number }).code === 11000
        ) {
            const dup = await Book.findOne({ slug: generateSlug(data.title), clerkId: userId }).lean();
            return {
                success: true,
                data: dup ? serializeData(dup) : null,
                alreadyExists: true,
            };
        }

        console.error('Error creating a book', e);
        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

export const getBookBySlug = async (slug: string) => {
    try {
        await connectToDatabase();
        const { auth } = await import("@clerk/nextjs/server");
        const { userId } = await auth();
        if (!userId) return { success: false, error: 'Unauthorized' };
        const book = await Book.findOne({ slug, clerkId: userId }).lean();

        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: serializeData(book)
        }
    } catch (e) {
        console.error('Error fetching book by slug', e);
        return {
            success: false, error: e instanceof Error ? e.message : String(e)
        }
    }
}

export const saveBookSegments = async (bookId: string, clerkId: string, segments: TextSegment[]) => {
    const session = await mongoose.startSession();
    try {
        await connectToDatabase();

        console.log('Saving book segments...');

        const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            clerkId, bookId, content: text, segmentIndex, pageNumber, wordCount
        }));

        let insertedCount = 0;

        await session.withTransaction(async () => {
            const result = await BookSegment.insertMany(segmentsToInsert, {
                session,
                ordered: false,
                rawResult: true,
            });
            insertedCount = result.insertedCount ?? segmentsToInsert.length;

            await Book.findByIdAndUpdate(
                bookId,
                { $inc: { totalSegments: insertedCount } },
                { session }
            );
        });

        console.log(`Book segments saved successfully. Inserted: ${insertedCount}`);

        return {
            success: true,
            data: { segmentsCreated: insertedCount },
        };
    } catch (e) {
        console.error('Error saving book segments', e);

        return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
        };
    } finally {
        session.endSession();
    }
}

// Searches book segments using MongoDB text search with regex fallback
export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
    try {
        await connectToDatabase();

        console.log(`Searching for: "${query}" in book ${bookId}`);

        const bookObjectId = new mongoose.Types.ObjectId(bookId);

        // Try MongoDB text search first (requires text index)
        let segments: Record<string, unknown>[] = [];
        try {
            segments = await BookSegment.find({
                bookId: bookObjectId,
                $text: { $search: query },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ score: { $meta: 'textScore' } })
                .limit(limit)
                .lean();
        } catch (e) {
            console.warn('Text search failed, falling back to regex:', e);
            segments = [];
        }

        // Fallback: regex search matching ANY keyword
        if (segments.length === 0) {
            const keywords = query.split(/\s+/).filter((k) => k.length > 2);
            const pattern = keywords.map(escapeRegex).join('|');

            segments = await BookSegment.find({
                bookId: bookObjectId,
                content: { $regex: pattern, $options: 'i' },
            })
                .select('_id bookId content segmentIndex pageNumber wordCount')
                .sort({ segmentIndex: 1 })
                .limit(limit)
                .lean();
        }

        console.log(`Search complete. Found ${segments.length} results`);

        return {
            success: true,
            data: serializeData(segments),
        };
    } catch (error) {
        console.error('Error searching segments:', error);
        return {
            success: false,
            error: (error as Error).message,
            data: [],
        };
    }
};

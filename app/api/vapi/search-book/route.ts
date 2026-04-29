import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { searchBookSegments } from '@/lib/actions/book.actions';
import { connectToDatabase } from '@/database/mongoose';
import Book from '@/database/models/book.model';

// Helper function to process book search logic
async function processBookSearch(bookId: unknown, query: unknown) {
    // Validate inputs before conversion to prevent null/undefined becoming "null"/"undefined" strings
    if (bookId == null || query == null || query === '') {
        return { result: 'Missing bookId or query' };
    }

    // Convert bookId to string
    const bookIdStr = String(bookId);
    const queryStr = String(query).trim();

    // Additional validation after conversion
    if (!bookIdStr || bookIdStr === 'null' || bookIdStr === 'undefined' || !queryStr) {
        return { result: 'Missing bookId or query' };
    }

    // Guard against too-short queries that fail regex fallback
    const hasValidToken = queryStr.split(/\s+/).some((token) => token.length > 2);
    if (!hasValidToken) {
        return { result: 'Query too short' };
    }

    // Execute search
    const searchResult = await searchBookSegments(bookIdStr, queryStr, 3);

    // Return results
    if (!searchResult.success || !searchResult.data?.length) {
        return { result: 'No information found about this topic in the book.' };
    }

    const combinedText = searchResult.data
        .map((segment) => (segment as { content: string }).content)
        .join('\n\n');

    return { result: combinedText };
}

export async function GET() {
    return NextResponse.json({ status: 'ok' });
}

// Parse tool arguments that may arrive as a JSON string or an object
function parseArgs(args: unknown): Record<string, unknown> {
    if (!args) return {};
    
    let parsed = args;
    if (typeof args === 'string') {
        try {
            parsed = JSON.parse(args);
        } catch {
            return {};
        }
    }
    
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
    }
    
    return {};
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log('Vapi search-book request:', JSON.stringify(body, null, 2));

        // 1. Authenticate Request
        const { userId } = await auth();
        const vapiSecret = request.headers.get('x-vapi-secret');
        const authHeader = request.headers.get('authorization');
        const validApiKey = process.env.VAPI_WEBHOOK_SECRET && 
            (vapiSecret === process.env.VAPI_WEBHOOK_SECRET || authHeader === `Bearer ${process.env.VAPI_WEBHOOK_SECRET}`);

        if (!userId && !validApiKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Support multiple Vapi formats
        const functionCall = body?.message?.functionCall;
        const toolCallList = body?.message?.toolCallList || body?.message?.toolCalls;

        // 2. Authorize Book Access centrally
        const serverBoundBookId = body?.message?.call?.variableValues?.bookId;
        
        if (!serverBoundBookId) {
            if (!userId) {
                return NextResponse.json({ error: 'Forbidden - No user session' }, { status: 403 });
            }
            
            // Collect all unique bookIds requested in this payload
            const requestedBookIds = new Set<string>();
            if (functionCall) {
                const parsed = parseArgs(functionCall.parameters);
                if (parsed.bookId) requestedBookIds.add(String(parsed.bookId));
            }
            if (toolCallList) {
                for (const call of toolCallList) {
                    const args = parseArgs(call.function?.arguments);
                    if (args.bookId) requestedBookIds.add(String(args.bookId));
                }
            }

            if (requestedBookIds.size > 0) {
                await connectToDatabase();
                for (const id of requestedBookIds) {
                    const bookExists = await Book.exists({ _id: id, clerkId: userId });
                    if (!bookExists) {
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                    }
                }
            }
        }

        // Handle single functionCall format
        if (functionCall) {
            const { name, parameters } = functionCall;
            const parsed = parseArgs(parameters);
            const bookIdToUse = serverBoundBookId || parsed.bookId;

            if (name === 'searchBook') {
                const result = await processBookSearch(bookIdToUse, parsed.query);
                return NextResponse.json(result);
            }

            return NextResponse.json({ result: `Unknown function: ${name}` });
        }

        // Handle toolCallList format (array of calls)
        if (!toolCallList || toolCallList.length === 0) {
            return NextResponse.json({
                results: [{ result: 'No tool calls found' }],
            });
        }

        const results = [];

        for (const toolCall of toolCallList) {
            const { id, function: func } = toolCall;
            const name = func?.name;
            const args = parseArgs(func?.arguments);
            const bookIdToUse = serverBoundBookId || args.bookId;

            if (name === 'searchBook') {
                const searchResult = await processBookSearch(bookIdToUse, args.query);
                results.push({ toolCallId: id, ...searchResult });
            } else {
                results.push({ toolCallId: id, result: `Unknown function: ${name}` });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Vapi search-book error:', error);
        return NextResponse.json({
            results: [{ result: 'Error processing request' }],
        });
    }
}

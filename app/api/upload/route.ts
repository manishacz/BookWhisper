import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateSlug } from "@/lib/utils";

export const runtime = "nodejs";

// Maximum serverless execution time (seconds) — does NOT control request body size
export const maxDuration = 60;

// 55 MB hard cap for incoming uploads
const MAX_UPLOAD_BYTES = 55 * 1024 * 1024;

export async function POST(req: NextRequest) {
    // Enforce upload size limit before reading the body
    const contentLength = req.headers.get("content-length");
    if (contentLength !== null && parseInt(contentLength, 10) > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
            { error: "Upload exceeds the 55 MB size limit" },
            { status: 413 }
        );
    }

    try {
        // Require authentication
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const pdfFile = formData.get("pdf") as File | null;
        const coverFile = formData.get("cover") as File | null;
        const title = formData.get("title") as string | null;

        if (!pdfFile) {
            return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
        }

        const slug = generateSlug(title ?? pdfFile.name);

        // ------ Upload PDF ------
        const pdfBlob = await put(
            `books/${userId}/${slug}.pdf`,
            pdfFile,
            {
                access: "public",
                contentType: "application/pdf",
                allowOverwrite: true,
            }
        );

        // ------ Upload Cover (optional) ------
        let coverUrl: string | null = null;
        let coverKey: string | null = null;

        if (coverFile && coverFile.size > 0) {
            const ext = coverFile.name.split(".").pop() ?? "jpg";
            const coverBlob = await put(
                `covers/${userId}/${slug}.${ext}`,
                coverFile,
                {
                    access: "public",
                    contentType: coverFile.type || "image/jpeg",
                    allowOverwrite: true,
                }
            );
            coverUrl = coverBlob.url;
            coverKey = coverBlob.pathname;
        }

        return NextResponse.json({
            pdfUrl: pdfBlob.url,
            pdfKey: pdfBlob.pathname,
            coverUrl,
            coverKey,
        });
    } catch (error) {
        console.error("[/api/upload] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 }
        );
    }
}

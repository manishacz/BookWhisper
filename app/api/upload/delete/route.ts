import { del } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { keys } = body;

        if (!keys || !Array.isArray(keys)) {
            return NextResponse.json({ error: "Keys array is required" }, { status: 400 });
        }

        // We only allow deleting blobs if the user is authenticated, 
        // ideally we should also check if the blob belongs to the user
        // But for now, we just delete the blobs
        await del(keys);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[/api/upload/delete] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Delete failed" },
            { status: 500 }
        );
    }
}

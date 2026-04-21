"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { MAX_FILE_SIZE, ACCEPTED_PDF_TYPES } from "@/lib/constants";
import { parsePDFFile } from "@/lib/utils";
import { createBook, saveBookSegments } from "@/lib/actions/book.actions";

const MALE_VOICES = [
    { id: "dave", name: "Dave", description: "Male voice, British. Essex, casual & conversational" },
    { id: "daniel", name: "Daniel", description: "Male voice, British, authoritative & warm" },
    { id: "chris", name: "Chris", description: "Male voice, easy-going" },
];

const FEMALE_VOICES = [
    { id: "rachel", name: "Rachel", description: "Young female, American, calm & clear" },
    { id: "sarah", name: "Sarah", description: "Young female, American, soft & approachable" },
];

export default function UploadForm() {
    const router = useRouter();
    const { user } = useUser();
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [selectedVoice, setSelectedVoice] = useState("rachel");
    const [errors, setErrors] = useState<{ pdf?: string; title?: string; author?: string }>({});
    const [submitted, setSubmitted] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    const validate = () => {
        const newErrors: { pdf?: string; title?: string; author?: string } = {};
        if (!pdfFile) newErrors.pdf = "Book PDF file is required";
        if (!title.trim()) newErrors.title = "Title is required";
        if (!author.trim()) newErrors.author = "Author name is required";
        return newErrors;
    };

    const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (file) {
            if (!ACCEPTED_PDF_TYPES.includes(file.type)) {
                setErrors((prev) => ({ ...prev, pdf: "Only PDF files are allowed" }));
                return;
            }
            if (file.size > MAX_FILE_SIZE) {
                setErrors((prev) => ({ ...prev, pdf: "File size must be under 50MB" }));
                return;
            }
        }
        setPdfFile(file);
        if (file && errors.pdf) {
            setErrors((prev) => ({ ...prev, pdf: undefined }));
        }
    };
    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setCoverFile(file);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        if (e.target.value.trim() && errors.title) {
            setErrors((prev) => ({ ...prev, title: undefined }));
        }
    };

    const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAuthor(e.target.value);
        if (e.target.value.trim() && errors.author) {
            setErrors((prev) => ({ ...prev, author: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setErrors({});
        setIsSynthesizing(true);
        try {
            if (!pdfFile) return;
            const clerkId = user?.id;
            if (!clerkId) throw new Error("You must be signed in to upload a book.");

            // 1. Upload PDF (+ optional cover) to Vercel Blob via API route
            const uploadForm = new FormData();
            uploadForm.append("pdf", pdfFile);
            uploadForm.append("title", title);
            if (coverFile) uploadForm.append("cover", coverFile);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: uploadForm,
            });
            if (!uploadRes.ok) {
                const { error } = await uploadRes.json();
                throw new Error(error ?? "File upload failed");
            }
            const { pdfUrl, pdfKey, coverUrl, coverKey } = await uploadRes.json();

            // 2. Parse PDF (extract text segments + auto-generate cover if none uploaded).
            // Run BEFORE committing to any more work; clean up blobs if parsing fails.
            let segments: Awaited<ReturnType<typeof parsePDFFile>>["content"];
            let autoCoverDataUrl: string | null = null;
            try {
                const parsed = await parsePDFFile(pdfFile);
                segments = parsed.content;
                autoCoverDataUrl = parsed.cover ?? null;
            } catch (parseErr) {
                // Best-effort: delete the blobs we already uploaded to avoid orphans
                await fetch("/api/upload/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keys: [pdfKey, coverKey].filter(Boolean) }),
                }).catch(() => {/* best-effort */});
                throw parseErr;
            }

            // 3. If no user-supplied cover was uploaded but the PDF parser generated a
            //    base64 cover, upload it to Vercel Blob so Book.coverURL is a real
            //    https:// URL (BookCard does not render data: URLs correctly).
            let finalCoverUrl: string | null = coverUrl ?? null;
            let finalCoverKey: string | null = coverKey ?? null;

            if (!finalCoverUrl && autoCoverDataUrl) {
                try {
                    const dataRes = await fetch(autoCoverDataUrl);
                    const blob = await dataRes.blob();
                    const autoFile = new File([blob], "auto-cover.jpg", { type: blob.type || "image/jpeg" });

                    const autoCoverForm = new FormData();
                    // The upload route requires a "pdf" field — send a minimal placeholder
                    autoCoverForm.append("pdf", new File(["%PDF"], "placeholder.pdf", { type: "application/pdf" }));
                    autoCoverForm.append("cover", autoFile);
                    autoCoverForm.append("title", title);

                    const autoCoverRes = await fetch("/api/upload", {
                        method: "POST",
                        body: autoCoverForm,
                    });
                    if (autoCoverRes.ok) {
                        const json = await autoCoverRes.json();
                        finalCoverUrl = json.coverUrl ?? null;
                        finalCoverKey = json.coverKey ?? null;
                    }
                } catch {
                    // Auto-cover upload is best-effort; proceed without a cover
                }
            }

            // 4. Create the Book record in MongoDB
            const bookRes = await createBook({
                clerkId,
                title,
                author,
                persona: selectedVoice,
                fileURL: pdfUrl,
                fileBlobKey: pdfKey,
                coverURL: finalCoverUrl ?? undefined,
                coverBlobKey: finalCoverKey ?? undefined,
                fileSize: pdfFile.size,
            });

            if (!bookRes.success || !bookRes.data) {
                throw new Error(
                    typeof bookRes.error === "string"
                        ? bookRes.error
                        : "Failed to create book record."
                );
            }

            const book = bookRes.data as { _id: string; slug: string };

            // 5. Save text segments — surface failures instead of silently redirecting
            const segRes = await saveBookSegments(book._id, clerkId, segments);
            if (!segRes.success) {
                throw new Error(
                    typeof segRes.error === "string"
                        ? segRes.error
                        : "Book was created but text segments could not be saved. Please try again."
                );
            }

            // 6. Redirect to the home page
            router.push(`/`);
        } catch (err) {
            console.error("[UploadForm] Submission error:", err);
            alert(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        } finally {
            setIsSynthesizing(false);
        }
    };

    return (
        <>
        <form
            onSubmit={handleSubmit}
            className="new-book-wrapper"
        >
            {/* 1. PDF File Upload */}
            <div className={errors.pdf ? "form-field-error" : ""}>
                <label className="form-label">Book PDF File</label>
                <div
                    className={`upload-dropzone border-2 border-dashed border-[var(--border-medium)] rounded-[10px] ${pdfFile ? "upload-dropzone-uploaded" : ""
                        }`}
                    onClick={() => pdfInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pdfInputRef.current?.click();
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label="Upload PDF file"
                >
                    <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePdfChange}
                    />
                    {pdfFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="upload-dropzone-icon"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <span className="upload-dropzone-text">{pdfFile.name}</span>
                            <button
                                type="button"
                                className="upload-dropzone-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPdfFile(null);
                                    if (pdfInputRef.current) pdfInputRef.current.value = "";
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Upload icon */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="upload-dropzone-icon"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                />
                            </svg>
                            <span className="upload-dropzone-text">Click to upload PDF</span>
                            <span className="upload-dropzone-hint">PDF file (max 50MB)</span>
                        </>
                    )}
                </div>
                {errors.pdf && <p className="form-field-error-message">{errors.pdf}</p>}
            </div>

            {/* 2. Cover Image Upload */}
            <div>
                <label className="form-label">Cover Image (Optional)</label>
                <div
                    className={`upload-dropzone border-2 border-dashed border-[var(--border-medium)] rounded-[10px] ${coverFile ? "upload-dropzone-uploaded" : ""
                        }`}
                    onClick={() => coverInputRef.current?.click()}
                >
                    <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverChange}
                    />
                    {coverFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="upload-dropzone-icon"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            <span className="upload-dropzone-text">{coverFile.name}</span>
                            <button
                                type="button"
                                className="upload-dropzone-remove"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCoverFile(null);
                                    if (coverInputRef.current) coverInputRef.current.value = "";
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-5 h-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Image icon */}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="upload-dropzone-icon"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            <span className="upload-dropzone-text">Click to upload cover image</span>
                            <span className="upload-dropzone-hint">Leave empty to auto-generate from PDF</span>
                        </>
                    )}
                </div>
            </div>

            {/* 3. Title Input */}
            <div className={errors.title ? "form-field-error" : ""}>
                <label className="form-label" htmlFor="book-title">
                    Title
                </label>
                <input
                    id="book-title"
                    type="text"
                    className="form-input border border-[var(--border-subtle)] outline-none focus:border-[var(--accent-warm)] transition-colors"
                    placeholder="ex: Rich Dad Poor Dad"
                    value={title}
                    onChange={handleTitleChange}
                />
                {errors.title && <p className="form-field-error-message">{errors.title}</p>}
            </div>

            {/* 4. Author Input */}
            <div className={errors.author ? "form-field-error" : ""}>
                <label className="form-label" htmlFor="book-author">
                    Author Name
                </label>
                <input
                    id="book-author"
                    type="text"
                    className="form-input border border-[var(--border-subtle)] outline-none focus:border-[var(--accent-warm)] transition-colors"
                    placeholder="ex: Robert Kiyosaki"
                    value={author}
                    onChange={handleAuthorChange}
                />
                {errors.author && <p className="form-field-error-message">{errors.author}</p>}
            </div>

            {/* 5. Voice Selector */}
            <div>
                <label className="form-label">Choose Assistant Voice</label>

                {/* Male Voices */}
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Male Voices</p>
                <div className="voice-selector-options flex-wrap mb-4">
                    {MALE_VOICES.map((voice) => (
                        <label
                            key={voice.id}
                            className={`voice-selector-option ${selectedVoice === voice.id
                                ? "voice-selector-option-selected"
                                : "voice-selector-option-default"
                                }`}
                        >
                            <input
                                type="radio"
                                name="voice"
                                value={voice.id}
                                checked={selectedVoice === voice.id}
                                onChange={() => setSelectedVoice(voice.id)}
                                className="hidden"
                            />
                            <div>
                                <p className="font-semibold text-sm text-[var(--text-primary)]">{voice.name}</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{voice.description}</p>
                            </div>
                        </label>
                    ))}
                </div>

                {/* Female Voices */}
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Female Voices</p>
                <div className="voice-selector-options flex-wrap">
                    {FEMALE_VOICES.map((voice) => (
                        <label
                            key={voice.id}
                            className={`voice-selector-option ${selectedVoice === voice.id
                                ? "voice-selector-option-selected"
                                : "voice-selector-option-default"
                                }`}
                        >
                            <input
                                type="radio"
                                name="voice"
                                value={voice.id}
                                checked={selectedVoice === voice.id}
                                onChange={() => setSelectedVoice(voice.id)}
                                className="hidden"
                            />
                            <div>
                                <p className="font-semibold text-sm text-[var(--text-primary)]">{voice.name}</p>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{voice.description}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* 6. Submit Button */}
            <button type="submit" className="form-btn" disabled={isSynthesizing}>
                Begin Synthesis
            </button>
        </form>

        {/* Synthesis Loading Modal */}
        {isSynthesizing && (
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.45)",
                    backdropFilter: "blur(4px)",
                    zIndex: 9999,
                }}
            >
                <div
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "16px",
                        padding: "48px 40px",
                        maxWidth: "420px",
                        width: "90%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                    }}
                >
                    {/* Spinner */}
                    <svg
                        style={{
                            width: "52px",
                            height: "52px",
                            animation: "spin 1s linear infinite",
                            color: "#7c5c3e",
                        }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeDasharray="31.4 62.8"
                            strokeLinecap="round"
                        />
                    </svg>
                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

                    <h2
                        style={{
                            fontSize: "1.375rem",
                            fontWeight: 700,
                            color: "#1a1a1a",
                            textAlign: "center",
                            margin: 0,
                        }}
                    >
                        Synthesizing Your Book
                    </h2>
                    <p
                        style={{
                            fontSize: "0.95rem",
                            color: "#6b7280",
                            textAlign: "center",
                            lineHeight: 1.6,
                            margin: 0,
                        }}
                    >
                        Please wait while we process your PDF and prepare your interactive literary experience.
                    </p>
                </div>
            </div>
        )}
        </>
    );
}

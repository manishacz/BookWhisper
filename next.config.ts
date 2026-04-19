import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        }
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    images: { remotePatterns: [
            { protocol: 'https', hostname: 'covers.openlibrary.org' },
            { protocol: 'http', hostname: 'localhost' },
            // Vercel Blob – actual domain is vercel-storage.com (hyphenated)
            // e.g. telqohbmzfimqw7t.public.blob.vercel-storage.com
            { protocol: 'https', hostname: '**.vercel-storage.com' },
            // Keep dot-variant in case Vercel changes domains
            { protocol: 'https', hostname: '**.vercel.storage.com' },
        ]}
};

export default nextConfig;

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.API_URL || 'http://localhost:8000';

// Disable body size limit and response timeout for long-running requests (e.g. agentic chat)
export const maxDuration = 300; // 5 minutes — Vercel/Next.js server limit

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const targetPath = path.join('/');
    const search = req.nextUrl.search ?? '';
    const targetUrl = `${BACKEND_URL}/${targetPath}${search}`;

    const headers = new Headers(req.headers);
    // Remove headers that cause issues when forwarding
    headers.delete('host');

    try {
        const upstream = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            // @ts-expect-error — Node.js fetch supports duplex for streaming bodies
            duplex: 'half',
            signal: AbortSignal.timeout(290_000), // 290s — just under maxDuration
        });

        const responseHeaders = new Headers(upstream.headers);
        // Allow streaming responses through
        responseHeaders.delete('content-encoding');

        return new NextResponse(upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
        });
    } catch (err) {
        console.error(`[proxy] Failed to reach backend at ${targetUrl}:`, err);
        return NextResponse.json(
            { detail: 'Backend unreachable or request timed out' },
            { status: 502 }
        );
    }
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;

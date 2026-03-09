import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/chat', '/settings', '/calendar', '/onboarding'];
const publicPaths = ['/login'];

export function proxy(request: NextRequest) {
    const token = request.cookies.get('arcis-token')?.value;
    const { pathname } = request.nextUrl;

    // Allow static files and API
    if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/favicon')) {
        return NextResponse.next();
    }

    const isProtected = protectedPaths.some(p => pathname.startsWith(p));
    const isPublic = publicPaths.some(p => pathname.startsWith(p));

    // Redirect unauthenticated users to login
    if (isProtected && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect authenticated users away from login
    if (isPublic && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Root redirect
    if (pathname === '/') {
        if (token) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

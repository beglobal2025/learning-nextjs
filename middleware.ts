import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the user is accessing admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // In a real app, you'd verify the JWT token here
    // For now, we'll just check if there's a token in the request
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/(.*)']
};
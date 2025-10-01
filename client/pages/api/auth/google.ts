import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { googleToken } = await request.json();

    if (!googleToken) {
      return NextResponse.json(
        { error: 'Google token is required' },
        { status: 400 }
      );
    }

    // Proxy the request to the server
    const serverUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';
    const response = await fetch(`${serverUrl}/api/auth/login/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ googleToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Authentication failed' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Google auth API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

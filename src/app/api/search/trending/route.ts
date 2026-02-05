import { NextRequest, NextResponse } from 'next/server';
import { getTrendingKeywords } from '@/lib/database-neon';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const trending = await getTrendingKeywords(limit);

    return NextResponse.json({
      keywords: trending,
    });
  } catch (error) {
    console.error('Trending keywords error:', error);
    return NextResponse.json(
      { error: 'Failed to get trending keywords' },
      { status: 500 }
    );
  }
}

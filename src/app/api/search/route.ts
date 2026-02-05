import { NextRequest, NextResponse } from 'next/server';
import { searchSubtitles, logSearch, getTrendingKeywords } from '@/lib/database-neon';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const category = searchParams.get('category') || undefined;
    const channelId = searchParams.get('channelId') || undefined;
    const subtitleType = searchParams.get('subtitleType') as 'manual' | 'auto' | 'community' | undefined;
    const personId = searchParams.get('personId') ? parseInt(searchParams.get('personId')!, 10) : undefined;

    // If no query, return trending keywords
    if (!query || query.trim() === '') {
      const trending = await getTrendingKeywords(10);
      return NextResponse.json({
        results: [],
        total: 0,
        query: '',
        trending,
      });
    }

    // Get session for logging
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Search subtitles
    const results = await searchSubtitles(query, {
      limit,
      offset,
      category,
      channelId,
      subtitleType,
      personId,
    });

    // Log the search
    await logSearch(
      query,
      results.length,
      userId,
      { category, channelId, subtitleType, personId },
    );

    // Get total count (simplified - in production, use a separate COUNT query)
    const total = results.length;

    return NextResponse.json({
      results,
      total,
      query,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: results.length === limit,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

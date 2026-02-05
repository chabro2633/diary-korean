import { NextRequest, NextResponse } from 'next/server';
import { getVideoWithSubtitles, getSubtitleContext } from '@/lib/database-neon';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const { searchParams } = new URL(request.url);
    const subtitleId = searchParams.get('subtitleId');
    const contextSize = parseInt(searchParams.get('contextSize') || '5', 10);

    // Get video with all subtitles
    const videoData = await getVideoWithSubtitles(videoId);

    if (!videoData) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // If subtitleId provided, also get context for that subtitle
    let context = null;
    if (subtitleId) {
      context = await getSubtitleContext(parseInt(subtitleId, 10), contextSize);
    }

    return NextResponse.json({
      ...videoData,
      context,
    });
  } catch (error) {
    console.error('Video fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to get video' },
      { status: 500 }
    );
  }
}

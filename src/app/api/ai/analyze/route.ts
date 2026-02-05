import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeExpression, generateContextHash } from '@/lib/gemini';
import { getSubtitleContext, getCachedAIAnalysis, cacheAIAnalysis, sql } from '@/lib/database-neon';

export async function POST(request: NextRequest) {
  try {
    // Check authentication (optional but recommended for rate limiting)
    const session = await getServerSession(authOptions);

    // Rate limiting for non-authenticated users
    if (!session) {
      // In production, implement proper rate limiting
      console.log('Anonymous AI analysis request');
    }

    const body = await request.json();
    const { subtitleId, contextSize = 5 } = body;

    if (!subtitleId) {
      return NextResponse.json(
        { error: 'subtitleId is required' },
        { status: 400 }
      );
    }

    // Get subtitle with context
    const subtitleContext = await getSubtitleContext(subtitleId, contextSize);

    if (!subtitleContext) {
      return NextResponse.json(
        { error: 'Subtitle not found' },
        { status: 404 }
      );
    }

    const { center, context } = subtitleContext as {
      center: { id: number; video_id: string; text: string; speaker?: string };
      context: Array<{ id: number; text: string; speaker?: string }>;
    };

    // Generate context hash for caching
    const contextIds = context.map((s) => s.id);
    const contextHash = generateContextHash(subtitleId, contextIds);

    // Check cache first
    const cached = await getCachedAIAnalysis(subtitleId, contextHash) as { analysis_json: string } | null;
    if (cached) {
      console.log('Returning cached analysis');
      return NextResponse.json({
        analysis: typeof cached.analysis_json === 'string' ? JSON.parse(cached.analysis_json) : cached.analysis_json,
        cached: true,
      });
    }

    // Get video info for context
    const videoResult = await sql`
      SELECT v.*, c.name as channel_name, c.category as channel_category
      FROM videos v
      JOIN channels c ON v.channel_id = c.id
      WHERE v.id = ${center.video_id}
    `;
    const video = videoResult[0] as {
      title: string;
      channel_category?: string;
    } | undefined;

    // Prepare context sentences
    const contextSentences = context.map((s) =>
      s.speaker ? `${s.speaker}: ${s.text}` : s.text
    );

    // Call Gemini for analysis
    const analysis = await analyzeExpression({
      expression: center.text,
      sentence: center.text,
      context: contextSentences,
      videoTitle: video?.title || 'Unknown',
      category: video?.channel_category,
      speaker: center.speaker || undefined,
    });

    // Cache the result
    await cacheAIAnalysis(
      subtitleId,
      contextHash,
      analysis,
      'gemini-1.5-flash',
      0 // Token count not available from current API
    );

    return NextResponse.json({
      analysis,
      cached: false,
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

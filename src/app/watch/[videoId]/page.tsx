'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { SubtitleTimeline } from '@/components/video/SubtitleTimeline';
import { AIInsightCard } from '@/components/ai/AIInsightCard';
import type { Subtitle, VideoDetail, AIAnalysisResponse } from '@/types';

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export default function WatchPage({ params }: PageProps) {
  const { videoId } = use(params);
  const searchParams = useSearchParams();
  const initialTime = parseInt(searchParams.get('t') || '0', 10);
  const highlightedSubtitleId = parseInt(searchParams.get('subtitle') || '0', 10);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch video data
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/videos/${videoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.video) {
          setVideo(data.video);
          setSubtitles(data.subtitles || []);

          // Set initial selected subtitle if provided
          if (highlightedSubtitleId) {
            const subtitle = data.subtitles?.find(
              (s: Subtitle) => s.id === highlightedSubtitleId
            );
            if (subtitle) {
              setSelectedSubtitle(subtitle);
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [videoId, highlightedSubtitleId]);

  // Handle subtitle click
  const handleSubtitleClick = useCallback((subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle);
    setAnalysis(null); // Clear previous analysis
  }, []);

  // Handle analyze button click
  const handleAnalyze = useCallback(async () => {
    if (!selectedSubtitle) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitleId: selectedSubtitle.id,
          contextSize: 5,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedSubtitle]);

  // Calculate clip end time (3 seconds after current subtitle)
  const getClipEndTime = () => {
    if (!selectedSubtitle) return undefined;
    return (selectedSubtitle.end_time_ms / 1000) + 3;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Video not found
          </h1>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🇰🇷</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              Context Korean
            </span>
          </Link>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-600 dark:text-gray-400 text-sm truncate">
            {video.title}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Video + Subtitles */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <VideoPlayer
              videoId={videoId}
              startTime={selectedSubtitle ? selectedSubtitle.start_time_ms / 1000 - 3 : initialTime}
              endTime={getClipEndTime()}
              onTimeUpdate={setCurrentTime}
            />

            {/* Video Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {video.title}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>{video.channel_name}</span>
                {video.channel_category && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {video.channel_category}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Subtitle Timeline (Mobile: below video) */}
            <div className="lg:hidden">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subtitles
              </h2>
              <SubtitleTimeline
                subtitles={subtitles}
                currentTime={currentTime}
                onSubtitleClick={handleSubtitleClick}
                highlightedId={highlightedSubtitleId || selectedSubtitle?.id}
              />
            </div>
          </div>

          {/* Right Column: AI Analysis + Subtitles (Desktop) */}
          <div className="space-y-6">
            {/* AI Insight Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  AI Analysis
                </h2>
                {selectedSubtitle && !analysis && !isAnalyzing && (
                  <button
                    onClick={handleAnalyze}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Analyze selected
                  </button>
                )}
              </div>
              <AIInsightCard
                analysis={analysis}
                isLoading={isAnalyzing}
                expression={selectedSubtitle?.text}
                onAnalyze={handleAnalyze}
              />
            </div>

            {/* Subtitle Timeline (Desktop: sidebar) */}
            <div className="hidden lg:block">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subtitles
              </h2>
              <SubtitleTimeline
                subtitles={subtitles}
                currentTime={currentTime}
                onSubtitleClick={handleSubtitleClick}
                highlightedId={highlightedSubtitleId || selectedSubtitle?.id}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

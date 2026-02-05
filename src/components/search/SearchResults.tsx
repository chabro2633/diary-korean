'use client';

import { SearchResult } from '@/types';
import Link from 'next/link';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading?: boolean;
}

export function SearchResults({ results, query, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-4"
          >
            <div className="flex gap-4">
              <div className="w-40 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full mt-4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!query) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          검색 결과가 없습니다
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          &ldquo;{query}&rdquo;에 대한 결과를 찾을 수 없습니다.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          다른 검색어를 시도해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        &ldquo;{query}&rdquo; 검색 결과 {results.length}개
      </p>
      {results.map((result) => (
        <SearchResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}

interface SearchResultCardProps {
  result: SearchResult;
}

function SearchResultCard({ result }: SearchResultCardProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Link
      href={`/watch/${result.video_id}?t=${Math.floor(result.start_time_ms / 1000)}&subtitle=${result.id}`}
      className="block bg-white dark:bg-gray-800 rounded-xl p-4 hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-700"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0">
          <div className="w-40 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {result.thumbnail_url ? (
              <img
                src={result.thumbnail_url}
                alt={result.video_title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
          </div>
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatTime(result.start_time_ms)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {result.video_title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {result.channel_name}
            {result.channel_category && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                {result.channel_category}
              </span>
            )}
          </p>

          {/* Subtitle text with highlight */}
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p
              className="text-gray-800 dark:text-gray-200"
              dangerouslySetInnerHTML={{
                __html: result.highlighted_text || result.text,
              }}
            />
            {result.speaker && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                — {result.speaker}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex gap-2 mt-2">
            {result.subtitle_type === 'manual' && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs">
                공식 자막
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

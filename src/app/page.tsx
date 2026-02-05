'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SearchBar, SearchResults, TrendingKeywords } from '@/components/search';
import { SearchResult } from '@/types';

interface TrendingKeyword {
  keyword: string;
  search_count: number;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trending, setTrending] = useState<TrendingKeyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch trending keywords on mount
  useEffect(() => {
    fetch('/api/search/trending')
      .then((res) => res.json())
      .then((data) => {
        setTrending(data.keywords || []);
      })
      .catch(console.error);
  }, []);

  // Search handler
  const handleSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle trending keyword click
  const handleKeywordClick = useCallback((keyword: string) => {
    setQuery(keyword);
    handleSearch(keyword);
  }, [handleSearch]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🇰🇷</span>
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              Context Korean
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            ) : session ? (
              <div className="flex items-center gap-3">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
                  {session.user?.name}
                </span>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!query && (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Learn Korean Through Real Context
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Search Korean expressions in K-Drama, variety shows, and K-Pop videos.
              Get AI-powered analysis with nuances, politeness levels, and cultural notes.
            </p>
          </div>
        )}

        {/* Search Bar */}
        <div className={`${query ? 'pt-4' : 'pt-8'}`}>
          <SearchBar
            onSearch={handleSearch}
            initialValue={query}
            isLoading={isLoading}
          />
        </div>

        {/* Trending Keywords (only when no query) */}
        {!query && (
          <TrendingKeywords
            keywords={trending}
            onKeywordClick={handleKeywordClick}
          />
        )}

        {/* Search Results */}
        <div className="mt-6">
          <SearchResults
            results={results}
            query={query}
            isLoading={isLoading}
          />
        </div>

        {/* Features Section (only when no query) */}
        {!query && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Contextual Search
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Find Korean expressions in real video contexts from dramas, variety shows, and K-Pop content.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                AI Context Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Get detailed explanations including nuances, politeness levels, and cultural background.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Video Learning
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Watch clips with synced subtitles and learn from authentic Korean media.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>YouTube Context Korean - Learn Korean Through Real Context</p>
      </footer>
    </div>
  );
}

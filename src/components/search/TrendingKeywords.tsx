'use client';

interface TrendingKeywordsProps {
  keywords: Array<{ keyword: string; search_count: number }>;
  onKeywordClick: (keyword: string) => void;
}

export function TrendingKeywords({ keywords, onKeywordClick }: TrendingKeywordsProps) {
  if (!keywords || keywords.length === 0) {
    return null;
  }

  return (
    <div className="py-6">
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
        인기 검색어
      </h2>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw, index) => (
          <button
            key={kw.keyword}
            onClick={() => onKeywordClick(kw.keyword)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <span className="text-gray-400 dark:text-gray-500 text-xs">
              {index + 1}
            </span>
            <span>{kw.keyword}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useRef, useEffect } from 'react';
import { Subtitle } from '@/types';

interface SubtitleTimelineProps {
  subtitles: Subtitle[];
  currentTime: number;
  onSubtitleClick: (subtitle: Subtitle) => void;
  highlightedId?: number;
}

export function SubtitleTimeline({
  subtitles,
  currentTime,
  onSubtitleClick,
  highlightedId,
}: SubtitleTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Find active subtitle based on current time
  const currentTimeMs = currentTime * 1000;
  const activeSubtitle = subtitles.find(
    (s) => currentTimeMs >= s.start_time_ms && currentTimeMs <= s.end_time_ms
  );

  // Auto-scroll to active subtitle
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      const isVisible =
        activeRect.top >= containerRect.top &&
        activeRect.bottom <= containerRect.bottom;

      if (!isVisible) {
        active.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSubtitle?.id]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="h-[400px] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="p-2 space-y-1">
        {subtitles.map((subtitle) => {
          const isActive = activeSubtitle?.id === subtitle.id;
          const isHighlighted = highlightedId === subtitle.id;

          return (
            <div
              key={subtitle.id}
              ref={isActive ? activeRef : null}
              onClick={() => onSubtitleClick(subtitle)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500'
                  : isHighlighted
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap pt-0.5">
                  {formatTime(subtitle.start_time_ms)}
                </span>
                <div className="flex-1">
                  <p
                    className={`text-sm ${
                      isActive
                        ? 'text-blue-900 dark:text-blue-100 font-medium'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {subtitle.text}
                  </p>
                  {subtitle.speaker && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      — {subtitle.speaker}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

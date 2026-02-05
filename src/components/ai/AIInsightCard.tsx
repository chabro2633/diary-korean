'use client';

import { useState } from 'react';
import type { AIAnalysisResponse } from '@/types';

interface AIInsightCardProps {
  analysis: AIAnalysisResponse | null;
  isLoading?: boolean;
  expression?: string;
  onAnalyze?: () => void;
}

export function AIInsightCard({
  analysis,
  isLoading = false,
  expression,
  onAnalyze,
}: AIInsightCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['definition', 'nuance', 'politeness'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (!analysis && !isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">🤖</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI Context Analysis
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Click a subtitle to analyze its meaning, nuance, and cultural context.
          </p>
          {expression && onAnalyze && (
            <button
              onClick={onAnalyze}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Analyze &ldquo;{expression}&rdquo;
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded w-full mt-4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Analyzing with AI...
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  const politenessColors: Record<string, string> = {
    formal: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    polite: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    casual: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    informal: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    intimate: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <h2 className="text-xl font-bold">{analysis.definition?.korean}</h2>
        <p className="text-blue-100 text-sm mt-1">
          {analysis.definition?.english}
        </p>
        {analysis.definition?.partOfSpeech && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-white/20 rounded text-xs">
            {analysis.definition.partOfSpeech}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Politeness Level */}
        {analysis.politenessLevel && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Politeness:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${politenessColors[analysis.politenessLevel.level] || 'bg-gray-100 text-gray-700'}`}>
              {analysis.politenessLevel.level}
            </span>
          </div>
        )}

        {/* Nuance Section */}
        <Section
          title="Nuance & Meaning"
          isExpanded={expandedSections.has('nuance')}
          onToggle={() => toggleSection('nuance')}
        >
          <p className="text-gray-700 dark:text-gray-300">
            {analysis.nuance?.explanation}
          </p>
          <div className="flex gap-2 mt-2">
            {analysis.nuance?.emotionalTone && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                Tone: {analysis.nuance.emotionalTone}
              </span>
            )}
            {analysis.nuance?.usageFrequency && (
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                Usage: {analysis.nuance.usageFrequency}
              </span>
            )}
          </div>
        </Section>

        {/* Situation */}
        {analysis.situation && (
          <Section
            title="When to Use"
            isExpanded={expandedSections.has('situation')}
            onToggle={() => toggleSection('situation')}
          >
            <div className="space-y-2">
              <div>
                <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Use when:</span>
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                  {analysis.situation.whenToUse}
                </p>
              </div>
              <div>
                <span className="text-red-600 dark:text-red-400 text-sm font-medium">✗ Avoid when:</span>
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                  {analysis.situation.whenNotToUse}
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Cultural Note */}
        {analysis.culturalNote?.note && (
          <Section
            title="Cultural Context"
            isExpanded={expandedSections.has('cultural')}
            onToggle={() => toggleSection('cultural')}
          >
            <div className="flex gap-2">
              <span className="text-2xl">🇰🇷</span>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {analysis.culturalNote.note}
              </p>
            </div>
            {analysis.culturalNote.relatedPhenomena && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2 italic">
                Related: {analysis.culturalNote.relatedPhenomena}
              </p>
            )}
          </Section>
        )}

        {/* Examples */}
        {analysis.exampleSentences && analysis.exampleSentences.length > 0 && (
          <Section
            title="Example Sentences"
            isExpanded={expandedSections.has('examples')}
            onToggle={() => toggleSection('examples')}
          >
            <div className="space-y-3">
              {analysis.exampleSentences.map((ex, i) => (
                <div key={i} className="border-l-2 border-blue-300 dark:border-blue-700 pl-3">
                  <p className="text-gray-900 dark:text-white font-medium">{ex.korean}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{ex.english}</p>
                  {ex.context && (
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                      ({ex.context})
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Related Expressions */}
        {analysis.relatedExpressions && analysis.relatedExpressions.length > 0 && (
          <Section
            title="Related Expressions"
            isExpanded={expandedSections.has('related')}
            onToggle={() => toggleSection('related')}
          >
            <div className="space-y-2">
              {analysis.relatedExpressions.map((rel, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">{rel.expression}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">- {rel.difference}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Politeness Explanation */}
        {analysis.politenessLevel?.explanation && (
          <Section
            title="Politeness Details"
            isExpanded={expandedSections.has('politeness')}
            onToggle={() => toggleSection('politeness')}
          >
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              {analysis.politenessLevel.explanation}
            </p>
            {analysis.politenessLevel.alternatives && analysis.politenessLevel.alternatives.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Alternative forms:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.politenessLevel.alternatives.map((alt, i) => (
                    <span
                      key={i}
                      className={`px-2 py-1 rounded text-xs ${politenessColors[alt.level] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {alt.expression} ({alt.level})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, isExpanded, onToggle, children }: SectionProps) {
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  );
}

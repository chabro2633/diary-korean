import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAnalysisResponse } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ANALYSIS_PROMPT = `You are an expert Korean language tutor specializing in teaching Korean through authentic media content. Analyze the following Korean expression in context.

## Input
Target Expression: {expression}
Full Sentence: {sentence}

## Context (surrounding dialogue)
{context}

## Video Information
- Title: {videoTitle}
- Category: {category}
- Speaker: {speaker}

## Required Output Format (JSON only, no markdown)
Return ONLY valid JSON with this structure:
{
  "definition": {
    "korean": "Korean definition/explanation",
    "english": "English translation",
    "partOfSpeech": "noun/verb/adjective/adverb/interjection/phrase"
  },
  "nuance": {
    "explanation": "Detailed nuance explanation in English",
    "emotionalTone": "happy/sad/frustrated/surprised/neutral/etc.",
    "usageFrequency": "very common/common/occasional/rare"
  },
  "situation": {
    "whenToUse": "Description of appropriate situations",
    "whenNotToUse": "Situations to avoid this expression",
    "typicalSpeakers": "Who typically uses this"
  },
  "politenessLevel": {
    "level": "formal/polite/casual/informal/intimate",
    "explanation": "Why this level applies",
    "alternatives": [
      {"level": "polite", "expression": "alternative expression"}
    ]
  },
  "culturalNote": {
    "note": "Cultural context or K-drama/K-pop specific usage",
    "relatedPhenomena": "Related cultural phenomena"
  },
  "exampleSentences": [
    {
      "korean": "Example sentence",
      "english": "Translation",
      "context": "Brief context"
    }
  ],
  "grammarPoints": [
    {
      "pattern": "Grammar pattern if applicable",
      "explanation": "How it works"
    }
  ],
  "relatedExpressions": [
    {
      "expression": "Similar expression",
      "difference": "How it differs"
    }
  ]
}

## Important Rules
1. ONLY output valid JSON. No markdown code blocks, no additional text.
2. Base analysis on the actual video context provided.
3. If uncertain, acknowledge limitations rather than guessing.
4. Keep explanations concise but informative.
5. Include romanization for complex words in the definition.`;

export async function analyzeExpression(params: {
  expression: string;
  sentence: string;
  context: string[];
  videoTitle: string;
  category?: string;
  speaker?: string;
}): Promise<AIAnalysisResponse> {
  const { expression, sentence, context, videoTitle, category, speaker } = params;

  const prompt = ANALYSIS_PROMPT
    .replace('{expression}', expression)
    .replace('{sentence}', sentence)
    .replace('{context}', context.join('\n'))
    .replace('{videoTitle}', videoTitle)
    .replace('{category}', category || 'Unknown')
    .replace('{speaker}', speaker || 'Unknown');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const analysis = JSON.parse(text) as AIAnalysisResponse;
    return analysis;
  } catch (error) {
    console.error('Gemini analysis error:', error);

    // Return fallback response
    return {
      definition: {
        korean: expression,
        english: 'Analysis unavailable',
        partOfSpeech: 'unknown',
      },
      nuance: {
        explanation: 'Unable to analyze this expression at the moment.',
        emotionalTone: 'neutral',
        usageFrequency: 'common',
      },
      situation: {
        whenToUse: 'Context-dependent',
        whenNotToUse: 'Formal situations may require different phrasing',
        typicalSpeakers: 'Various',
      },
      politenessLevel: {
        level: 'casual',
        explanation: 'Unable to determine politeness level',
        alternatives: [],
      },
      culturalNote: {
        note: 'Please try again later for cultural context.',
      },
      exampleSentences: [],
      grammarPoints: [],
      relatedExpressions: [],
    };
  }
}

// Generate context hash for caching
export function generateContextHash(
  subtitleId: number,
  contextIds: number[]
): string {
  const data = `${subtitleId}-${contextIds.sort().join(',')}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

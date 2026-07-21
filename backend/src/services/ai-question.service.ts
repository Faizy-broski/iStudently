import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import type { QuestionType, DifficultyLevel } from './quiz.service'
import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface DraftQuestion {
  title: string
  type: QuestionType
  description: string
  answer: string
  difficulty_level: DifficultyLevel
}

interface ExtractParams {
  fileBuffer: Buffer
  mimeType: string
  allowedTypes: QuestionType[]
  gradeLevelId?: string | null
  subjectId?: string | null
  chapterId?: string | null
}

interface GenerateParams {
  gradeLevelId?: string | null
  subjectId?: string | null
  chapterIds?: string[]
  count: number
  allowedTypes: QuestionType[]
  prompt?: string
  schoolId: string
}

// ============================================================================
// CLAUDE CLIENT (lazy — fails gracefully if key missing)
// ============================================================================

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to your backend .env file to use AI question features.'
      )
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

// ============================================================================
// SHARED SYSTEM PROMPT
// ============================================================================

const ANSWER_FORMAT_GUIDE = `
Answer format conventions (these are CRITICAL — the app parses them literally):

• "select" (single-choice): One option per line. Prefix the CORRECT option with an asterisk (*).
  Example:
    Paris
    London
    *Berlin
    Madrid

• "multiple" (multi-select): Same as select — one option per line. Prefix EACH correct option with *.
  Example:
    *Oxygen
    Helium
    *Nitrogen
    Argon

• "gap" (fill-in-the-blank): Write a sentence/paragraph with blanks marked as __word__.
  Example: The capital of France is __Paris__ and it is located in __Europe__.

• "text" (short text): Just the correct answer string.
  Example: 42

• "textarea" (essay/long text): Leave answer empty — these are manually graded.

• "matching" (drag & drop pairs): One pair per line using :: separator.
  Example:
    Paris::France
    Tokyo::Japan
    Berlin::Germany
`

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const, description: 'The question text' },
          type: {
            type: 'string' as const,
            enum: ['select', 'multiple', 'gap', 'text', 'textarea', 'matching'],
          },
          description: {
            type: 'string' as const,
            description: 'Optional hint or context for the question',
          },
          answer: {
            type: 'string' as const,
            description: 'Answer in the exact format specified per question type',
          },
          difficulty_level: {
            type: 'string' as const,
            enum: ['easy', 'medium', 'hard'],
          },
        },
        required: ['title', 'type', 'description', 'answer', 'difficulty_level'],
      },
    },
  },
  required: ['questions'],
}

// ============================================================================
// EXTRACT QUESTIONS FROM DOCUMENT
// ============================================================================

export async function extractQuestionsFromDocument(
  params: ExtractParams
): Promise<DraftQuestion[]> {
  const client = getClient()
  const { fileBuffer, mimeType, allowedTypes } = params

  const typesStr = allowedTypes.join(', ')
  const mimeBase = mimeType.split(';')[0].trim().toLowerCase()

  // Build content blocks based on mime type
  const contentBlocks: Anthropic.ContentBlockParam[] = []

  if (mimeBase === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    // DOCX — extract text with mammoth then send as plain text
    const result = await mammoth.extractRawText({ buffer: fileBuffer })
    contentBlocks.push({
      type: 'text',
      text: `Here is the document content:\n\n${result.value}`,
    })
  } else if (mimeBase === 'application/pdf') {
    // PDF — Claude accepts natively as document block
    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: fileBuffer.toString('base64'),
      },
    } as any)
  } else if (mimeBase.startsWith('image/')) {
    // Image — Claude accepts natively
    const imageMediaType = mimeBase as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageMediaType,
        data: fileBuffer.toString('base64'),
      },
    })
  } else {
    throw new Error(`Unsupported file type: ${mimeType}. Supported: PDF, DOCX, JPEG, PNG, WebP, GIF.`)
  }

  contentBlocks.push({
    type: 'text',
    text: `Extract every question and answer pair you can find in this document.

Restrictions:
- Only produce questions of these types: ${typesStr}
- Use the EXACT answer format conventions described in the system prompt.
- If you find an existing question that doesn't fit any allowed type, convert it to the closest allowed type.
- Assign a difficulty_level (easy/medium/hard) based on the complexity.
- For the "description" field, add any relevant context, hint, or instruction from the source.
- Return your output as a JSON object with a "questions" array.`,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: `You are an expert educational content extractor. Given a document (textbook page, worksheet, exam paper, etc.), extract all questions and their answers into a structured format.\n\n${ANSWER_FORMAT_GUIDE}`,
    messages: [{ role: 'user', content: contentBlocks }],
  })

  // Parse the response
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) throw new Error('No text response from AI')

  const parsed = parseJsonFromResponse(textBlock.text)
  return (parsed.questions || []) as DraftQuestion[]
}

// ============================================================================
// GENERATE QUESTIONS ON DEMAND
// ============================================================================

export async function generateQuestions(
  params: GenerateParams
): Promise<DraftQuestion[]> {
  const client = getClient()
  const {
    gradeLevelId,
    subjectId,
    chapterIds,
    count,
    allowedTypes,
    prompt: userPrompt,
    schoolId,
  } = params

  // Resolve names for context
  const contextParts: string[] = []

  if (gradeLevelId) {
    const { data } = await supabase
      .from('grade_levels')
      .select('name')
      .eq('id', gradeLevelId)
      .single()
    if (data) contextParts.push(`Grade Level: ${data.name}`)
  }

  if (subjectId) {
    const { data } = await supabase
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .single()
    if (data) contextParts.push(`Subject: ${data.name}`)
  }

  if (chapterIds && chapterIds.length > 0) {
    const { data } = await supabase
      .from('chapters')
      .select('title, order_index')
      .in('id', chapterIds)
      .order('order_index', { ascending: true })
    if (data && data.length > 0) {
      contextParts.push(`Chapters: ${data.map(c => c.title).join(', ')}`)
    }
  }

  const typesStr = allowedTypes.join(', ')
  const contextStr = contextParts.length > 0 ? contextParts.join('\n') : 'General knowledge'

  const userMessage = `Generate exactly ${count} quiz questions based on the following context:

${contextStr}

Allowed question types: ${typesStr}
${userPrompt ? `\nAdditional instructions: ${userPrompt}` : ''}

Requirements:
- Distribute questions across the allowed types as evenly as practical.
- Vary the difficulty (easy/medium/hard) — aim for a mix.
- Use the EXACT answer format conventions from the system prompt.
- Make questions educational, clear, and age-appropriate.
- Return your output as a JSON object with a "questions" array.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: `You are an expert educational question generator. Create quiz questions based on academic context provided.\n\n${ANSWER_FORMAT_GUIDE}`,
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!textBlock) throw new Error('No text response from AI')

  const parsed = parseJsonFromResponse(textBlock.text)
  return (parsed.questions || []) as DraftQuestion[]
}

// ============================================================================
// HELPERS
// ============================================================================

function parseJsonFromResponse(text: string): { questions: DraftQuestion[] } {
  // Try direct parse first
  try {
    return JSON.parse(text)
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
    // Try to find a JSON object in the text
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) {
      return JSON.parse(objMatch[0])
    }
    throw new Error('Failed to parse AI response as JSON')
  }
}

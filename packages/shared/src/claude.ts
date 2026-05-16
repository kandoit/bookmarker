import OpenAI from 'openai'
import type { Bookmark, AIBookmarkInfo, ChatMessage } from './types'

const FAST_MODEL = 'gpt-4o-mini'
const CHAT_MODEL = 'gpt-4o'

export function createClient(apiKey: string) {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
}

export async function analyzeUrl(
  url: string,
  pageContent: string | null,
  apiKey: string
): Promise<AIBookmarkInfo> {
  const client = createClient(apiKey)

  const contentSection = pageContent
    ? `\nPage content excerpt:\n${pageContent.slice(0, 4000)}`
    : '\n(No page content available — use your training knowledge about this URL.)'

  const response = await client.chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 512,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `Analyze this URL and provide bookmark metadata.

URL: ${url}${contentSection}

Respond with ONLY a JSON object:
{
  "title": "Page title (concise)",
  "description": "2-3 sentence summary of what this page is and why it's useful",
  "tags": ["tag1", "tag2", "tag3"]
}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    return {
      title: parsed.title ?? '',
      description: parsed.description ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
    }
  } catch {
    return { title: '', description: '', tags: [] }
  }
}

export async function searchBookmarks(
  query: string,
  bookmarks: Bookmark[],
  apiKey: string
): Promise<{ bookmark: Bookmark; reason: string }[]> {
  if (!bookmarks.length) return []
  const client = createClient(apiKey)

  const list = bookmarks
    .map(b => `[${b.id}] "${b.title}" - ${b.url}\n  ${b.description}\n  tags: ${b.tags.join(', ')}`)
    .join('\n\n')

  const response = await client.chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `You are a bookmark search engine. Find the most relevant bookmarks for this query.

Query: "${query}"

Available bookmarks:
${list}

Return a JSON object with a "results" array of the top 5 most relevant matches:
{"results": [{"id": "bookmark-id", "reason": "one sentence why this matches"}]}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    const results: { id: string; reason: string }[] = parsed.results ?? []
    return results
      .map(r => ({
        bookmark: bookmarks.find(b => b.id === r.id)!,
        reason: r.reason,
      }))
      .filter(r => r.bookmark)
  } catch {
    return []
  }
}

export async function* streamChat(
  messages: ChatMessage[],
  bookmarks: Bookmark[],
  apiKey: string
): AsyncGenerator<string> {
  const client = createClient(apiKey)

  const bookmarkList = bookmarks
    .map(b => `[${b.id}] "${b.title}" (${b.url})\n  ${b.description}\n  tags: ${b.tags.join(', ')}`)
    .join('\n\n')

  const systemPrompt = bookmarks.length
    ? `You are an AI assistant for a personal bookmark manager. Help the user find and manage their bookmarks.

The user has ${bookmarks.length} bookmarks:

${bookmarkList}

When referencing a bookmark in your response, include its ID in this format: [[BOOKMARK:id]] — the UI will render it as a card.
Be concise and helpful.`
    : `You are an AI assistant for a personal bookmark manager. The user has no bookmarks yet. Encourage them to add some.`

  const stream = await client.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? ''
    if (text) yield text
  }
}

import Anthropic from '@anthropic-ai/sdk'
import type { Bookmark, AIBookmarkInfo, ChatMessage } from './types'

const MODEL = 'claude-sonnet-4-6'

export function createClient(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
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

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Analyze this URL and provide bookmark metadata.

URL: ${url}${contentSection}

Respond with ONLY a JSON object (no markdown):
{
  "title": "Page title (concise)",
  "description": "2-3 sentence summary of what this page is and why it's useful",
  "tags": ["tag1", "tag2", "tag3"]
}`,
      },
    ],
  })

  try {
    const text = (msg.content[0] as { text: string }).text.trim()
    const json = text.startsWith('{') ? text : text.match(/\{[\s\S]+\}/)?.[0] ?? '{}'
    const parsed = JSON.parse(json)
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

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a bookmark search engine. Find the most relevant bookmarks for this query.

Query: "${query}"

Available bookmarks:
${list}

Return a JSON array of the top 5 most relevant matches (fewer if not enough relevant ones):
[{"id": "bookmark-id", "reason": "one sentence why this matches"}]

Return ONLY the JSON array, no markdown.`,
      },
    ],
  })

  try {
    const text = (msg.content[0] as { text: string }).text.trim()
    const json = text.startsWith('[') ? text : text.match(/\[[\s\S]+\]/)?.[0] ?? '[]'
    const results: { id: string; reason: string }[] = JSON.parse(json)
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

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}

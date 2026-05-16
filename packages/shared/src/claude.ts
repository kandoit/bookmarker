import OpenAI from 'openai'
import type { Bookmark, AIBookmarkInfo, ChatMessage, AgentTool, StreamEvent } from './types'

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

function buildSystemPrompt(bookmarks: Bookmark[]): string {
  const bookmarkList = bookmarks
    .map(b => `[${b.id}] "${b.title}" (${b.url})\n  ${b.description}\n  tags: ${b.tags.join(', ')}`)
    .join('\n\n')

  return bookmarks.length
    ? `You are an AI assistant for a personal bookmark manager.

You can search existing bookmarks and add new ones using your tools.
When a user shares a URL, use add_bookmark to save it automatically — don't just describe it.
When a user asks to search for bookmarks, use search_bookmarks to find relevant ones and present the results clearly.
When referencing a saved bookmark in text, write [[BOOKMARK:id]] and the UI renders it as a card.
Be concise and action-oriented.

Saved bookmarks (${bookmarks.length}):
${bookmarkList}`
    : `You are an AI assistant for a personal bookmark manager. The user has no bookmarks yet.
When they share a URL, use the add_bookmark tool to save it.`
}

export async function* streamChat(
  bookmarks: Bookmark[],
  messages: ChatMessage[],
  apiKey: string,
  tools: AgentTool[] = []
): AsyncGenerator<StreamEvent> {
  const client = createClient(apiKey)

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(bookmarks) },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  // Agentic loop — keeps running until no more tool calls
  while (true) {
    const stream = await client.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: 2048,
      stream: true,
      messages: openaiMessages,
      ...(openaiTools.length > 0 && { tools: openaiTools, tool_choice: 'auto' }),
    })

    // Accumulate streamed response
    const pending: Record<number, { id: string; name: string; args: string }> = {}
    let assistantText = ''
    let finishReason = ''

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason

      if (delta?.content) {
        assistantText += delta.content
        yield { type: 'text', text: delta.content }
      }

      for (const tc of delta?.tool_calls ?? []) {
        if (!pending[tc.index]) {
          pending[tc.index] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' }
        }
        if (tc.id) pending[tc.index].id = tc.id
        if (tc.function?.name) pending[tc.index].name = tc.function.name
        pending[tc.index].args += tc.function?.arguments ?? ''
      }
    }

    // Record assistant turn
    const toolCalls = Object.values(pending)
    openaiMessages.push({
      role: 'assistant',
      content: assistantText || null,
      ...(toolCalls.length > 0 && {
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      }),
    })

    if (finishReason !== 'tool_calls' || toolCalls.length === 0) break

    // Execute each tool call
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(tc.args) } catch { /* invalid JSON */ }

      yield { type: 'tool_start', name: tc.name, args }

      const tool = tools.find(t => t.name === tc.name)
      let result = 'Tool not found'
      if (tool) {
        try { result = await tool.execute(args) } catch (e) {
          result = `Error: ${e instanceof Error ? e.message : 'unknown'}`
        }
      }

      yield { type: 'tool_done', name: tc.name, result }

      openaiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
    // Continue loop so the agent can respond after tool execution
  }
}

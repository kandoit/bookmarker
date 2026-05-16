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

export async function suggestWorkspaceBookmarks(
  workspaceName: string,
  workspaceDescription: string,
  bookmarks: Bookmark[],
  apiKey: string
): Promise<{ bookmark: Bookmark; reason: string }[]> {
  if (!bookmarks.length) return []
  const client = createClient(apiKey)

  const list = bookmarks
    .map(b => `[${b.id}] "${b.title}" — ${b.url}\n  ${b.description}\n  tags: ${b.tags.join(', ')}`)
    .join('\n\n')

  const response = await client.chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `You are helping fill a workspace called "${workspaceName}"${workspaceDescription ? ` (${workspaceDescription})` : ''}.

Pick every bookmark from the list below that is clearly relevant to this workspace topic. Be inclusive — if in doubt, include it.

Bookmarks:
${list}

Return ONLY a JSON object:
{"results": [{"id": "bookmark-id", "reason": "one short sentence why it belongs"}]}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    const results: { id: string; reason: string }[] = parsed.results ?? []
    return results
      .map(r => ({ bookmark: bookmarks.find(b => b.id === r.id)!, reason: r.reason }))
      .filter(r => r.bookmark)
  } catch {
    return []
  }
}

export async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
    })
    if (!res.ok) return null
    const text = await res.text()
    return text.slice(0, 8000)
  } catch {
    return null
  }
}

export async function suggestNewBookmarks(
  bookmarks: Bookmark[],
  apiKey: string
): Promise<{ title: string; url: string; description: string; tags: string[]; reason: string }[]> {
  if (!bookmarks.length) return []
  const client = createClient(apiKey)

  const interests = bookmarks
    .slice(0, 40)
    .map(b => `"${b.title}" — tags: ${b.tags.join(', ')}`)
    .join('\n')
  const existingUrls = bookmarks.map(b => b.url).join('\n')

  const response = await client.chat.completions.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `Based on a user's bookmarks, suggest 6 new resources they would likely enjoy that they don't already have.

User's bookmarks:
${interests}

Already saved URLs — do NOT suggest any of these:
${existingUrls}

Requirements:
- Only suggest real, well-known, high-quality resources with working URLs
- Diversify across their interest areas
- Each suggestion must be something genuinely useful, not generic

Return ONLY JSON:
{"suggestions": [{"title": "...", "url": "https://...", "description": "2-3 sentence summary", "tags": ["tag1", "tag2"], "reason": "one sentence why this fits their interests"}]}`,
      },
    ],
  })

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    return Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  } catch {
    return []
  }
}

function buildSystemPrompt(bookmarks: Bookmark[]): string {
  const bookmarkList = bookmarks
    .map(b => `[${b.id}] "${b.title}" (${b.url})\n  ${b.description}\n  tags: ${b.tags.join(', ')}`)
    .join('\n\n')

  const rules = `RULES (follow strictly):
1. When the user shares any URL (http:// or https://), call add_bookmark immediately — never just describe it.
2. The add_bookmark tool fetches the real page to extract title, description, and tags automatically.
3. When the user mentions a website or page by name without a URL, ask them to paste the URL so you can save it.
4. When the user wants to find bookmarks, call search_bookmarks with their keywords.
5. When the user asks for recommendations or new suggestions, call suggest_bookmarks.
6. After saving a bookmark, reference it as [[BOOKMARK:id]] so the UI renders a clickable card.`

  return bookmarks.length
    ? `You are an AI assistant for a personal bookmark manager.

${rules}

Saved bookmarks (${bookmarks.length}):
${bookmarkList}`
    : `You are an AI assistant for a personal bookmark manager. The user has no bookmarks yet.

${rules}`
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

import type { Bookmark, Workspace } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function toUnixTs(iso: string) {
  return Math.floor(new Date(iso).getTime() / 1000)
}

// ── Export ────────────────────────────────────────────────────────────────────

function bookmarkLine(b: Bookmark) {
  const ts = toUnixTs(b.createdAt)
  const tags = b.tags.length ? ` TAGS="${escapeHtml(b.tags.join(','))}"` : ''
  const desc = b.description ? `\n        <DD>${escapeHtml(b.description)}` : ''
  return `        <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${ts}"${tags}>${escapeHtml(b.title || b.url)}</A>${desc}`
}

export function exportBookmarksHTML(
  bookmarks: Bookmark[],
  workspaces: Workspace[] = [],
  opts: { bookmarkIds?: string[]; workspaceIds?: string[] } = {}
): string {
  const bFilter = opts.bookmarkIds ? new Set(opts.bookmarkIds) : null
  const wFilter = opts.workspaceIds ? new Set(opts.workspaceIds) : null

  const selBookmarks = bFilter ? bookmarks.filter(b => bFilter.has(b.id)) : bookmarks
  const selWorkspaces = wFilter ? workspaces.filter(w => wFilter.has(w.id)) : workspaces

  // Bookmark IDs that live in at least one selected workspace
  const inFolder = new Set(selWorkspaces.flatMap(w => w.bookmarkIds))

  const folderSections = selWorkspaces.map(w => {
    const wBms = w.bookmarkIds
      .map(id => bookmarks.find(b => b.id === id))
      .filter(Boolean) as Bookmark[]
    const inner = wBms.map(bookmarkLine).join('\n')
    return `    <DT><H3>${escapeHtml(w.name)}</H3>\n    <DL><p>\n${inner}\n    </DL><p>`
  }).join('\n')

  const standalone = selBookmarks
    .filter(b => !inFolder.has(b.id))
    .map(b => bookmarkLine(b).replace(/^    /, '')) // dedent one level
    .join('\n')

  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${standalone}
${folderSections}
</DL><p>`
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportedBookmark {
  url: string
  title: string
  description: string
  tags: string[]
}

export interface ImportedFolder {
  name: string
  bookmarks: ImportedBookmark[]
}

export interface ParsedBookmarkFile {
  bookmarks: ImportedBookmark[]
  folders: ImportedFolder[]
}

function parseLinks(dl: Element): ImportedBookmark[] {
  const results: ImportedBookmark[] = []
  const dts = Array.from(dl.querySelectorAll(':scope > dt'))
  for (const dt of dts) {
    const a = dt.querySelector('a')
    if (!a) continue
    const url = a.getAttribute('href') ?? ''
    if (!url.startsWith('http')) continue
    const dd = dt.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : null
    results.push({
      url,
      title: a.textContent?.trim() ?? url,
      description: dd?.textContent?.trim() ?? '',
      tags: (a.getAttribute('tags') ?? a.getAttribute('shortcuturl') ?? '')
        .split(',').map(t => t.trim()).filter(Boolean),
    })
  }
  return results
}

export function parseNetscapeHTML(html: string): ParsedBookmarkFile {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const result: ParsedBookmarkFile = { bookmarks: [], folders: [] }

  const topDl = doc.querySelector('dl')
  if (!topDl) return result

  // Top-level <DT> items
  for (const dt of Array.from(topDl.querySelectorAll(':scope > dt'))) {
    const h3 = dt.querySelector('h3')
    if (h3) {
      // It's a folder — find the next DL sibling
      const folderDl = dt.nextElementSibling?.tagName === 'DL'
        ? dt.nextElementSibling
        : null
      result.folders.push({
        name: h3.textContent?.trim() ?? 'Folder',
        bookmarks: folderDl ? parseLinks(folderDl) : [],
      })
    } else {
      const a = dt.querySelector('a')
      if (a) {
        const url = a.getAttribute('href') ?? ''
        if (!url.startsWith('http')) continue
        const dd = dt.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : null
        result.bookmarks.push({
          url,
          title: a.textContent?.trim() ?? url,
          description: dd?.textContent?.trim() ?? '',
          tags: (a.getAttribute('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean),
        })
      }
    }
  }

  return result
}

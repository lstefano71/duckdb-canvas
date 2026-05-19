const DEBOUNCE_MS = 2000
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export async function loadWorkspace(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/workspaces/${encodeURIComponent(slug)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function autoSaveWorkspace(slug: string, snapshot: unknown): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    try {
      await fetch(`/api/workspaces/${encodeURIComponent(slug)}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      })
    } catch (err) {
      console.warn('[workspace] Auto-save failed:', err)
    }
  }, DEBOUNCE_MS)
}

export async function saveWorkspace(slug: string, snapshot: unknown): Promise<void> {
  await fetch(`/api/workspaces/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  })
}

export async function listWorkspaces(): Promise<string[]> {
  const res = await fetch('/api/workspaces')
  if (!res.ok) return []
  return await res.json()
}

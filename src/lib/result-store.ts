// In-memory store for columnar result data (keyed by unique ID).
// This avoids serializing large arrays into tldraw shape props.

const store = new Map<string, Array<ArrayLike<unknown>>>()

let nextId = 0

export function storeResultData(columns: Array<ArrayLike<unknown>>): string {
  const key = `result-${nextId++}`
  store.set(key, columns)
  return key
}

export function getResultData(key: string): Array<ArrayLike<unknown>> | null {
  return store.get(key) || null
}

export function deleteResultData(key: string): void {
  store.delete(key)
}

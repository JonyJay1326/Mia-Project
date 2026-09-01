/** IndexedDB 小封装：打开库、读写草稿队列 */

const DB_NAME = 'mia-drafts'
const DB_VERSION = 1
const STORE = 'drafts'

/** 打开（或创建）草稿数据库 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
  })
}

/**
 * 在事务中执行 store 操作
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作失败'))
  })
}

/** 写入或覆盖一条草稿 */
export async function idbPut<T extends { id: string }>(value: T): Promise<void> {
  await withStore('readwrite', (store) => store.put(value))
}

/** 按 id 删除草稿 */
export async function idbDelete(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

/** 读取全部草稿 */
export async function idbGetAll<T>(): Promise<T[]> {
  return withStore('readonly', (store) => store.getAll())
}

/** 检测当前环境是否可用 IndexedDB（如隐私模式） */
export function canUseIdb(): boolean {
  try {
    return typeof indexedDB !== 'undefined'
  } catch {
    return false
  }
}

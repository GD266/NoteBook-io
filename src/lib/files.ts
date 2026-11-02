import { invoke, isTauri } from '@tauri-apps/api/core'

export interface OpenedTextFile {
  name: string
  fileName: string
  path: string
  content: string
}

/** Returns and clears the .txt files Windows passed to this process. */
export async function takePendingTextFiles(): Promise<string[]> {
  if (!isTauri()) return []
  return invoke<string[]>('take_pending_files')
}

/** Reads one .txt file through the desktop bridge. */
export async function readTextFile(path: string): Promise<OpenedTextFile> {
  return invoke<OpenedTextFile>('read_text_file', { path })
}

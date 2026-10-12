import { create } from 'zustand'

/** A question to answer with yes or no, e.g. before something is deleted. */
export interface ConfirmRequest {
  kind: 'confirm'
  title: string
  text: string
  confirmLabel: string
  /** Deleting gets the red button. */
  danger?: boolean
}

/** A request for a short text, e.g. a new name. */
export interface PromptRequest {
  kind: 'prompt'
  title: string
  label: string
  value: string
  confirmLabel: string
}

export type DialogRequest = ConfirmRequest | PromptRequest

interface DialogState {
  /** The question that is on screen right now. */
  request: DialogRequest | null
  /** Hands the answer to whoever asked and closes the dialog. */
  answer: (value: boolean | string | null) => void
  ask: (request: DialogRequest, resolve: (value: boolean | string | null) => void) => void
}

export const useDialogStore = create<DialogState>()((set, get) => {
  let pending: ((value: boolean | string | null) => void) | null = null
  return {
    request: null,
    answer: (value) => {
      const resolve = pending
      pending = null
      set({ request: null })
      resolve?.(value)
    },
    ask: (request, resolve) => {
      // a question that is still open counts as declined
      get().answer(request.kind === 'confirm' ? false : null)
      pending = resolve
      set({ request })
    },
  }
})

/** Asks a yes/no question in the app's own dialog; resolves to the answer. */
export function confirmDialog(request: Omit<ConfirmRequest, 'kind'>): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().ask({ kind: 'confirm', ...request }, (value) => resolve(value === true))
  })
}

/** Asks for a text; resolves to the trimmed text, or `null` if cancelled or left empty. */
export function promptDialog(request: Omit<PromptRequest, 'kind'>): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().ask({ kind: 'prompt', ...request }, (value) => {
      const text = typeof value === 'string' ? value.trim() : ''
      resolve(text === '' ? null : text)
    })
  })
}

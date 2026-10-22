import { getItem } from "@/lib/storage";
import { createStore, newId, nowIso } from "@/lib/create-store";

const store = createStore<NotesState>("gadget-notes", seedState);
export const NOTES_STORAGE_KEY = store.key;

export const DEFAULT_FOLDER_NAME = "Default folder";

const WELCOME_TITLE = "Welcome to Notes";
const WELCOME_CONTENT = `This is your scratchpad. A few tips:

- **Folders** group notes. Use **New folder** in the sidebar, or rename/delete from a folder’s menu.
- **New notes** land in the current folder (or Default folder). You can also use **+** on a folder row.
- **Drag** a note onto another folder to move it, or use the note’s context menu.
- **Trash** soft-deletes; open Trash at the bottom to restore or delete forever.

Edit or delete this note whenever you like.
`;

export type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  /** Every note lives in a folder. */
  folderId: string;
  createdAt: string;
  updatedAt: string;
  /** Soft-deleted notes live in trash until restored or purged. */
  deletedAt?: string;
};

export type NotesState = {
  folders: NoteFolder[];
  notes: Note[];
};

type LegacyNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string | null;
  deletedAt?: string;
};

function seedState(): NotesState {
  const now = nowIso();
  const folderId = newId();
  return {
    folders: [{ id: folderId, name: DEFAULT_FOLDER_NAME, createdAt: now }],
    notes: [
      {
        id: newId(),
        title: WELCOME_TITLE,
        content: WELCOME_CONTENT,
        folderId,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

/** Ensure every note has a folder; create Default if needed. */
function normalize(state: NotesState): NotesState {
  let { folders, notes } = state;
  if (folders.length === 0) {
    const seeded = seedState();
    if (notes.length === 0) return seeded;
    const folder = seeded.folders[0]!;
    return {
      folders: [folder],
      notes: notes.map((n) => ({ ...n, folderId: folder.id })),
    };
  }
  const fallbackId = folders.find((f) => f.name === DEFAULT_FOLDER_NAME)?.id ?? folders[0]!.id;
  let changed = false;
  const nextNotes = notes.map((n) => {
    if (n.folderId && folders.some((f) => f.id === n.folderId)) return n;
    changed = true;
    return { ...n, folderId: fallbackId };
  });
  return changed ? { folders, notes: nextNotes } : state;
}

/** Load and migrate legacy payloads; always leaves at least Default with notes filed. */
export function loadState(): NotesState {
  const raw = getItem<NotesState | LegacyNote[]>(NOTES_STORAGE_KEY);
  if (!raw) {
    const seeded = seedState();
    void persist(seeded);
    return seeded;
  }
  let state: NotesState;
  if (Array.isArray(raw)) {
    state = {
      folders: [],
      notes: raw.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        folderId: n.folderId ?? "",
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
      })),
    };
  } else {
    state = {
      folders: raw.folders ?? [],
      notes: (raw.notes ?? []).map((n) => ({
        ...n,
        folderId: n.folderId ?? "",
      })),
    };
  }
  const next = normalize(state);
  if (next !== state) void persist(next);
  return next;
}

function persist(state: NotesState): Promise<void> {
  return store.save(state);
}

function write(mutator: (state: NotesState) => NotesState): NotesState {
  const next = normalize(mutator(loadState()));
  void persist(next);
  return next;
}

function applyNotePatch(
  state: NotesState,
  id: string,
  patch: Partial<Pick<Note, "title" | "content">>,
): NotesState {
  return {
    ...state,
    notes: state.notes.map((n) => {
      if (n.id !== id) return n;
      return {
        ...n,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        updatedAt: nowIso(),
      };
    }),
  };
}

/** Same as `updateNote` but awaits the store flush (for autosave UI). */
export async function updateNoteAndWait(
  id: string,
  patch: Partial<Pick<Note, "title" | "content">>,
): Promise<NotesState> {
  const next = applyNotePatch(loadState(), id, patch);
  await persist(next);
  return next;
}

export function listFolders(): NoteFolder[] {
  return loadState().folders;
}

export function listActiveNotes(): Note[] {
  return loadState().notes.filter((n) => !n.deletedAt);
}

/** Prefer Default, else the first folder. */
export function defaultFolderId(state = loadState()): string {
  return state.folders.find((f) => f.name === DEFAULT_FOLDER_NAME)?.id ?? state.folders[0]!.id;
}

export function addFolder(name = "New folder"): NoteFolder {
  const folder: NoteFolder = {
    id: newId(),
    name: name.trim() || "New folder",
    createdAt: nowIso(),
  };
  write((s) => ({ ...s, folders: [...s.folders, folder] }));
  return folder;
}

export function renameFolder(id: string, name: string): NotesState {
  const next = name.trim() || "New folder";
  return write((s) => ({
    ...s,
    folders: s.folders.map((f) => (f.id === id ? { ...f, name: next } : f)),
  }));
}

/**
 * Removes the folder. Its notes move to another folder (Default if present, else the first
 * remaining). If it was the last folder, a fresh Default is created for them.
 */
export function deleteFolder(id: string): NotesState {
  return write((s) => {
    const remaining = s.folders.filter((f) => f.id !== id);
    let folders = remaining;
    let targetId = remaining.find((f) => f.name === DEFAULT_FOLDER_NAME)?.id ?? remaining[0]?.id;
    if (!targetId) {
      const folder: NoteFolder = { id: newId(), name: DEFAULT_FOLDER_NAME, createdAt: nowIso() };
      folders = [folder];
      targetId = folder.id;
    }
    return {
      folders,
      notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: targetId!, updatedAt: nowIso() } : n)),
    };
  });
}

export function addNote(opts: { folderId: string; title?: string; content?: string }): Note {
  const now = nowIso();
  const note: Note = {
    id: newId(),
    title: opts.title ?? "",
    content: opts.content ?? "",
    folderId: opts.folderId,
    createdAt: now,
    updatedAt: now,
  };
  write((s) => ({ ...s, notes: [note, ...s.notes] }));
  return note;
}

/** Title may stay empty while editing; use `finalizeTitle` on blur. */
export function updateNote(id: string, patch: Partial<Pick<Note, "title" | "content">>): NotesState {
  return write((s) => applyNotePatch(s, id, patch));
}

/** Coerce blank titles to "Untitled" after the user leaves the field. */
export function finalizeTitle(id: string): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      if (n.title.trim() || !n.content.trim()) return n;
      return { ...n, title: "Untitled", updatedAt: nowIso() };
    }),
  }));
}

export function moveNote(id: string, folderId: string): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) =>
      n.id === id ? { ...n, folderId, updatedAt: nowIso() } : n,
    ),
  }));
}

export function trashNote(id: string): NotesState {
  const now = nowIso();
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => (n.id === id ? { ...n, deletedAt: now } : n)),
  }));
}

export function restoreNote(id: string): NotesState {
  return write((s) => ({
    ...s,
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      const { deletedAt: _, ...rest } = n;
      return { ...rest, updatedAt: nowIso() };
    }),
  }));
}

export function purgeNote(id: string): NotesState {
  return write((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
}

export function emptyTrash(): NotesState {
  return write((s) => ({ ...s, notes: s.notes.filter((n) => !n.deletedAt) }));
}

/** Notes with no content and no real title are never kept. */
export function isEmptyNote(n: Note): boolean {
  const title = n.title.trim();
  return !n.content.trim() && (title === "" || title === "Untitled");
}

/** Permanently drops empty notes (except `keepId`); returns true if any were removed. */
export function pruneEmptyNotes(keepId?: string | null): boolean {
  const state = loadState();
  const kept = state.notes.filter((n) => n.id === keepId || !isEmptyNote(n));
  if (kept.length === state.notes.length) return false;
  write((s) => ({ ...s, notes: kept }));
  return true;
}

export function displayTitle(note: Note): string {
  return note.title.trim() || "Untitled";
}

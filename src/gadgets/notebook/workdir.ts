import { createStore } from "@/lib/create-store";

// Key keeps its original name so a folder chosen before the rename is still remembered.
export const NOTES_DIR_KEY = "gadget-notes-dir";

/** The folder the Notebook works in. Empty until the user chooses one. */
const store = createStore<string>(NOTES_DIR_KEY, () => "");

export const getWorkDir = () => store.read();
export const setWorkDir = (path: string) => store.save(path);

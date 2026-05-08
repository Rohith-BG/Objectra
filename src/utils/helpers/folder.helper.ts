import type { Folder } from "../../folders/folder.types.js";
import { ForbiddenError } from "../errors/http.errors.js";

export function filterAllowedFolders(folders: Folder[],allowedFolders: string[] | undefined): Folder[] {
  if (!allowedFolders || allowedFolders.length === 0) {
    return folders;
  }

  const allowedSet = new Set(allowedFolders);
  
  return folders.filter((folder) => allowedSet.has(folder.id));
}

export function assertFolderAccess(folderId: string,allowedFolders: string[] | undefined): void {
  
  if (!allowedFolders || allowedFolders.length === 0) {
    return;
  }

  if (!allowedFolders.includes(folderId)) {
    throw new ForbiddenError(
      `Access denied: You do not have permission to access folder '${folderId}'`
    );
  }
}
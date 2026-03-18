export interface FileEntry {
  name: string;
  type: "file" | "directory";
  contents?: string;
  children?: FileEntry[];
}

export interface UIFileEntry extends FileEntry {
  path: string;
  isOpen?: boolean;
  children?: FileEntry[] | UIFileEntry[];
  _refreshKey?: number; // Timestamp to force refresh of media files after rename
}

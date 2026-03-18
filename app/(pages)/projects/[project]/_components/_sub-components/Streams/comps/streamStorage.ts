// IndexedDB storage for stream chunks - PROJECT-SPECIFIC
interface StreamChunk {
  id: string;
  filePath: string;
  codeContent?: string;
  isComplete: boolean;
  timestamp: number;
  projectId: string; // Add projectId to chunks
}

class StreamStorage {
  private dbInstances = new Map<string, IDBDatabase>(); // Cache DB instances per project
  private readonly version = 1;
  private readonly storeName = "chunks";
  private cleanupInitialized = false;
  private activeStreams = new Set<string>(); // Track active streaming projects

  constructor() {
    this.initializeCleanup();
  }

  // Mark project as actively streaming
  markStreamActive(projectId: string) {
    this.activeStreams.add(projectId);
  }

  // Mark project streaming as complete
  markStreamComplete(projectId: string) {
    this.activeStreams.delete(projectId);
  }

  // Check if project is actively streaming
  isStreamActive(projectId: string): boolean {
    return this.activeStreams.has(projectId);
  }

  // Initialize cleanup listeners for page refresh/unload
  private initializeCleanup() {
    if (this.cleanupInitialized || typeof window === "undefined") return;

    this.cleanupInitialized = true;

    // Clear all project databases on page refresh/unload (but only inactive ones)
    const clearAllOnUnload = async () => {
      try {
        const projectIds = Array.from(this.dbInstances.keys());
        // Only cleanup projects that are NOT actively streaming
        const inactiveProjects = projectIds.filter(
          (id) => !this.activeStreams.has(id)
        );

        if (inactiveProjects.length > 0) {
          const cleanupPromises = inactiveProjects.map((projectId) =>
            this.clearProject(projectId)
          );
          await Promise.all(cleanupPromises);
          console.log(
            `Cleared ${inactiveProjects.length} inactive StreamChunks databases on page unload`
          );
        }
      } catch (error) {
        console.warn("Failed to clear databases on unload:", error);
      }
    };

    // Handle page refresh/reload
    window.addEventListener("beforeunload", clearAllOnUnload);

    // Handle tab close
    window.addEventListener("unload", clearAllOnUnload);

    // Handle page visibility change (when switching tabs) - but don't clear active streams
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        // Only clear inactive projects when tab becomes hidden
        clearAllOnUnload();
      }
    });
  }

  // Generate project-specific database name
  private getDbName(projectId: string): string {
    return `StreamChunks_${projectId}`;
  }

  async init(projectId: string): Promise<void> {
    // Return existing connection if available
    if (this.dbInstances.has(projectId)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const dbName = this.getDbName(projectId);
      const request = indexedDB.open(dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.dbInstances.set(projectId, request.result);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("filePath", "filePath", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("isComplete", "isComplete", { unique: false });
          store.createIndex("projectId", "projectId", { unique: false });
        }
      };
    });
  }

  private getDb(projectId: string): IDBDatabase {
    const db = this.dbInstances.get(projectId);
    if (!db) {
      throw new Error(
        `Database not initialized for project: ${projectId}. Call init() first.`
      );
    }
    return db;
  }

  async storeChunks(projectId: string, chunks: StreamChunk[]): Promise<void> {
    // Ensure database is initialized before storing
    if (!this.dbInstances.has(projectId)) {
      await this.init(projectId);
    }

    const db = this.getDb(projectId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      const total = chunks.length;

      if (total === 0) {
        resolve();
        return;
      }

      // Deduplicate chunks by filePath before storing and ensure projectId
      const deduplicatedChunks = new Map<string, StreamChunk>();

      chunks.forEach((chunk) => {
        const chunkWithProject = { ...chunk, projectId }; // Ensure projectId is set
        const existing = deduplicatedChunks.get(chunk.filePath);

        // Keep the most complete version (complete > incomplete, newer > older)
        if (
          !existing ||
          (chunkWithProject.isComplete && !existing.isComplete) ||
          (chunkWithProject.isComplete === existing.isComplete &&
            chunkWithProject.timestamp > existing.timestamp)
        ) {
          deduplicatedChunks.set(chunk.filePath, {
            ...chunkWithProject,
            id: `${projectId}_${chunk.filePath}`, // Project-specific ID
          });
        }
      });

      const finalChunks = Array.from(deduplicatedChunks.values());
      const finalTotal = finalChunks.length;

      if (finalTotal === 0) {
        resolve();
        return;
      }

      finalChunks.forEach((chunk) => {
        const request = store.put(chunk);
        request.onsuccess = () => {
          completed++;
          if (completed === finalTotal) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getChunks(
    projectId: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<StreamChunk[]> {
    // Ensure database is initialized before reading
    if (!this.dbInstances.has(projectId)) {
      await this.init(projectId);
    }

    const db = this.getDb(projectId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("timestamp");

      const chunks: StreamChunk[] = [];
      let skipped = 0;
      let collected = 0;

      const request = index.openCursor(null, "next");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && collected < limit) {
          const chunk = cursor.value as StreamChunk;
          // Only return chunks for this specific project
          if (chunk.projectId === projectId) {
            if (skipped >= offset) {
              chunks.push(chunk);
              collected++;
            } else {
              skipped++;
            }
          }
          cursor.continue();
        } else {
          resolve(chunks);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getCompleteChunks(
    projectId: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<StreamChunk[]> {
    // Ensure database is initialized before reading
    if (!this.dbInstances.has(projectId)) {
      await this.init(projectId);
    }

    const db = this.getDb(projectId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("isComplete");

      const chunks: StreamChunk[] = [];
      let skipped = 0;
      let collected = 0;

      const request = index.openCursor(IDBKeyRange.only(true), "next");

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && collected < limit) {
          const chunk = cursor.value as StreamChunk;
          // Only return chunks for this specific project
          if (chunk.projectId === projectId) {
            if (skipped >= offset) {
              chunks.push(chunk);
              collected++;
            } else {
              skipped++;
            }
          }
          cursor.continue();
        } else {
          resolve(chunks);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getTotalCount(projectId: string): Promise<number> {
    // Ensure database is initialized before reading
    if (!this.dbInstances.has(projectId)) {
      await this.init(projectId);
    }

    const db = this.getDb(projectId);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("projectId");
      const request = index.count(IDBKeyRange.only(projectId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(projectId: string): Promise<void> {
    // Don't clear if stream is active
    if (this.isStreamActive(projectId)) {
      console.warn(`Cannot clear storage for active stream: ${projectId}`);
      return;
    }

    const db = this.dbInstances.get(projectId);
    if (!db) {
      console.warn(`No database found for project: ${projectId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const index = store.index("projectId");

      // Delete only chunks for this project
      const request = index.openCursor(IDBKeyRange.only(projectId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Clear ALL data for a project and close/delete the database
  async clearProject(projectId: string): Promise<void> {
    // Don't clear if stream is active
    if (this.isStreamActive(projectId)) {
      console.warn(`Cannot clear project data for active stream: ${projectId}`);
      return;
    }

    try {
      // Close existing connection
      const db = this.dbInstances.get(projectId);
      if (db) {
        db.close();
        this.dbInstances.delete(projectId);
      }

      // Delete the entire database for this project
      const dbName = this.getDbName(projectId);
      return new Promise((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);

        deleteRequest.onsuccess = () => {
          console.log(
            `StreamChunks database deleted for project: ${projectId}`
          );
          resolve();
        };

        deleteRequest.onerror = () => {
          console.warn(
            `Failed to delete StreamChunks database for project: ${projectId}`
          );
          reject(deleteRequest.error);
        };

        deleteRequest.onblocked = () => {
          console.warn(
            `StreamChunks database deletion blocked for project: ${projectId}`
          );
          resolve(); // Still resolve as the database will be deleted eventually
        };
      });
    } catch (error) {
      console.error(`Error clearing project ${projectId}:`, error);
      throw error;
    }
  }

  async deduplicateStorage(projectId: string): Promise<void> {
    try {
      // Get all chunks for this project
      const allChunks = await this.getChunks(projectId, 0, 1000);

      // Clear storage for this project
      await this.clear(projectId);

      // Store deduplicated chunks for this project
      await this.storeChunks(projectId, allChunks);
    } catch (error) {
      console.error(
        `Failed to deduplicate storage for project ${projectId}:`,
        error
      );
      throw error;
    }
  }

  async close(projectId?: string): Promise<void> {
    if (projectId) {
      // Close specific project database
      const db = this.dbInstances.get(projectId);
      if (db) {
        db.close();
        this.dbInstances.delete(projectId);
      }
    } else {
      // Close all databases
      this.dbInstances.forEach((db) => db.close());
      this.dbInstances.clear();
    }
  }

  // Debug method to list all project databases
  async debugDatabases(): Promise<void> {
    try {
      if ("databases" in indexedDB) {
        const databases = await indexedDB.databases();
        const streamDbs = databases.filter((db) =>
          db.name?.startsWith("StreamChunks_")
        );
        console.log(
          "StreamChunks databases:",
          streamDbs.map((db) => db.name)
        );
      } else {
        console.log("indexedDB.databases() not supported in this browser");
      }
    } catch (error) {
      console.warn("Failed to list StreamChunks databases:", error);
    }
  }
}

// Singleton instance - now project-aware
export const streamStorage = new StreamStorage();

export type { StreamChunk };

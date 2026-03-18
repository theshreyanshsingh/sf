// --- Types ---
export type ProcessedStatus =
  | "empty"
  | "raw_unexpected"
  | "streaming_json"
  | "potentially_complete";

export interface ProcessedBase {
  status: ProcessedStatus;
  raw: string;
}

export interface ProcessedRaw extends ProcessedBase {
  status: "raw_unexpected";
}

export interface ProcessedEmpty extends ProcessedBase {
  status: "empty";
}

export interface ProcessedJson extends ProcessedBase {
  status: "streaming_json" | "potentially_complete";
  innerContent: string;
  stepsArray: string[];
  isStepsComplete: boolean;
  identifiedCompleteCodeBlocks: {
    filePath: string;
    codeContent: string;
    id: string;
  }[];
  potentialCodeBlockPaths: { filePath: string; id: string }[];
  identifiedFileListItems: string[];
  filesCount: number;
  hasGenFilesKey: boolean;
  hasFilesKey: boolean;
  hasJsonPrefix: boolean;
  hasJsonSuffix: boolean;
  hasStepsArray: boolean;
}

export type ProcessedResult = ProcessedEmpty | ProcessedRaw | ProcessedJson;

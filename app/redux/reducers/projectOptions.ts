import { API } from "@/app/config/publicEnv";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import { clearImagesURL, setClaudeApiKey, setId, setPlan } from "./basicData";
import { setChatId } from "./chatSlice";
import {
  DEFAULT_PREVIEW_RUNTIME,
  DEFAULT_PREVIEW_SNACK_DEPENDENCIES,
  DEFAULT_PREVIEW_SNACK_DESCRIPTION,
  DEFAULT_PREVIEW_SNACK_FILES,
  DEFAULT_PREVIEW_SNACK_NAME,
  DEFAULT_PREVIEW_SNACK_SDK_VERSION,
  PREVIEW_SDK_54_CORE_DEPENDENCIES,
  inferPreviewRuntime,
  type PreviewRuntime,
  type PreviewSnackDependencies,
  type PreviewSnackFiles,
} from "@/default/mobile";

interface FetchProjectParams {
  string: string;
}

const DEPENDENCY_EXTENSION_SUFFIX_REGEX = /\.(cjs|mjs|js|jsx|ts|tsx)$/i;
const DEPENDENCY_PACKAGE_PATH_REGEX =
  /^(?:@[^/\s]+\/[^/\s]+|[a-zA-Z0-9][\w.-]*)(?:\/.*)?$/;

const normalizeDependencyNameForState = (rawName: string): string | null => {
  let name = rawName.trim();
  if (!name) return null;

  let removedDecorator = false;
  if (name.startsWith("module://")) {
    name = name.slice("module://".length);
    removedDecorator = true;
  } else if (name.startsWith("module:")) {
    name = name.slice("module:".length);
    removedDecorator = true;
  } else if (name.startsWith("npm:")) {
    name = name.slice("npm:".length);
    removedDecorator = true;
  } else if (name.startsWith("jsr:")) {
    name = name.slice("jsr:".length);
    removedDecorator = true;
  }

  name = (name.split("?")[0] ?? name).split("#")[0] ?? name;

  if (removedDecorator && name.startsWith("/")) {
    const withoutLeadingSlash = name.replace(/^\/+/, "");
    if (DEPENDENCY_PACKAGE_PATH_REGEX.test(withoutLeadingSlash)) {
      name = withoutLeadingSlash;
    }
  }

  if (
    !name ||
    name.startsWith(".") ||
    name.startsWith("/") ||
    name.startsWith("http://") ||
    name.startsWith("https://") ||
    name.startsWith("node:")
  ) {
    return null;
  }

  if (name.startsWith("@")) {
    const parts = name.split("/");
    if (parts.length < 2) return null;
    let packageName = parts[1];
    if (DEPENDENCY_EXTENSION_SUFFIX_REGEX.test(packageName)) {
      packageName = packageName.replace(DEPENDENCY_EXTENSION_SUFFIX_REGEX, "");
    }
    if (!packageName) return null;
    return `${parts[0]}/${packageName}`;
  }

  let packageName = name.split("/")[0];
  if (DEPENDENCY_EXTENSION_SUFFIX_REGEX.test(packageName)) {
    packageName = packageName.replace(DEPENDENCY_EXTENSION_SUFFIX_REGEX, "");
  }
  return packageName || null;
};

const enforcePreviewSdk54DependencyPins = (
  dependencies: PreviewSnackDependencies,
): PreviewSnackDependencies => {
  return {
    ...dependencies,
    ...PREVIEW_SDK_54_CORE_DEPENDENCIES,
  };
};

const normalizePreviewSdkVersionForState = (rawSdkVersion?: string): string => {
  if (!rawSdkVersion) return DEFAULT_PREVIEW_SNACK_SDK_VERSION;
  const trimmed = rawSdkVersion.trim();
  if (!trimmed) return DEFAULT_PREVIEW_SNACK_SDK_VERSION;
  if (trimmed.startsWith("54.")) return trimmed;
  return DEFAULT_PREVIEW_SNACK_SDK_VERSION;
};

export const fetchProject = createAsyncThunk<
  {
    title: string;
    projectId: string;
    input: string;
    csslib: string;
    framework: string;
    memory: string;
    isResponseCompleted: boolean;
    url: string;
    lastResponder: "ai" | "user";
    enh_prompt: string;
    promptCount: number;
    tokenLimit?: number;
    tokensUsed?: number;
    tokensRemaining?: number;
    startingPoint?: string | null;
    previewRuntime?: PreviewRuntime | null;
  },
  FetchProjectParams
>("projectOptions/fetchProject", async ({ string: requestBody }, thunkAPI) => {
  try {
    const url = `${API}/build-project`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    // thunkAPI.dispatch(setMessages({ messages: data.messages }));
    thunkAPI.dispatch(setPlan(data.plan));
    thunkAPI.dispatch(clearImagesURL());
    thunkAPI.dispatch(setId(data.id));
    thunkAPI.dispatch(setClaudeApiKey(data.apikey));

    const resolvedPreviewRuntime =
      data.previewRuntime === "mobile" || data.previewRuntime === "web"
        ? data.previewRuntime
        : data.runtime === "mobile" || data.runtime === "web"
          ? data.runtime
          : data.platform === "mobile" || data.platform === "web"
            ? data.platform
            : inferPreviewRuntime(data.framework);

    if (!data.url) {
      thunkAPI.dispatch(
        setGenerationSuccess(
          resolvedPreviewRuntime === "web" ? "thinking" : null,
        ),
      );
    }

    sessionStorage.setItem("framework", data.framework);

    const effectiveSnapshotUrl =
      (typeof data?.codeUrl === "string" && data.codeUrl.trim()) ||
      (typeof data?.code_url === "string" && data.code_url.trim()) ||
      (typeof data?.url === "string" && data.url.trim()) ||
      "";

    const hydratedChatId =
      typeof data.chatId === "string" && data.chatId.trim()
        ? data.chatId.trim()
        : "";
    const pid =
      typeof data.projectId === "string" && data.projectId.trim()
        ? data.projectId.trim()
        : "";
    if (hydratedChatId && pid) {
      const key = `superblocksChatId_${pid}`;
      const perProjectStored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(key)?.trim() || ""
          : "";
      const reduxChatId = (
        thunkAPI.getState() as { messagesprovider: { chatId: string | null } }
      ).messagesprovider.chatId;
      const shouldApplyHydratedChatId =
        !reduxChatId ||
        (!perProjectStored && reduxChatId !== hydratedChatId);
      if (shouldApplyHydratedChatId) {
        thunkAPI.dispatch(setChatId(hydratedChatId));
      }
      if (typeof window !== "undefined" && !window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, hydratedChatId);
      }
    }

    return {
      title: data.title,
      projectId: data.projectId,
      input: data.input,
      csslib: data.csslib,
      framework: data.framework,
      memory: data.memory,
      // `url` here is used by the web runtime hydration to fetch the snapshot JSON.
      // Prefer effective `codeUrl` (restoredMessageId-aware) when present.
      url: effectiveSnapshotUrl,
      lastResponder: data.lastResponder,
      isResponseCompleted: data.isResponseCompleted,
      enh_prompt: data.enh_prompt,
      promptCount: data.promptCount,
      tokenLimit: data.tokenLimit,
      tokensUsed: data.tokensUsed,
      tokensRemaining: data.tokensRemaining,
      startingPoint: data.startingPoint || null,
      previewRuntime:
        resolvedPreviewRuntime === "mobile" || resolvedPreviewRuntime === "web"
          ? resolvedPreviewRuntime
          : null,
    };
  } catch (error: unknown) {
    return thunkAPI.rejectWithValue(error);
  }
});

interface PlanState {
  fullscreen: boolean;
  mode: "edit" | "split" | "code" | "pages";
  responsive: "desktop" | "mobile";
  previewRuntime: PreviewRuntime;
  runtimeLocked: boolean;
  loading: "loading" | "done" | "error" | null;
  title: string | null;
  projectId: string | null;
  framework: string | null;
  input: string | null;
  memory: string | null;
  csslib: string | null;
  generating: boolean;
  isStreamActive: boolean | null; // New: Track if stream is receiving data
  readerMode: boolean;
  url: string | null; // Backend URL for fetching project files
  previewUrl: string | null; // WebContainer preview URL
  lastResponder: "ai" | "user" | null;
  isResponseCompleted: boolean | null;
  enh_prompt: string | null;
  startingPoint: string | null;
  generationSuccess: null | "success" | "failed" | "thinking";
  memoryModal: boolean;
  promptCount: number | null;
  tokenLimit: number | null;
  tokensUsed: number | null;
  tokensRemaining: number | null;
  refreshCounter: number;
  inspectorMode: boolean;
  editMode: boolean;
  showTemplateBlocks: boolean;
  showPreviewPageBar: boolean;
  model: string | null;
  pendingAttachment: {
    fileName: string;
    lineNumber: number;
    endLine?: number;
    elementName: string;
    code?: string;
  } | null;
  selectedBlock: {
    id: string;
    html: string;
    selector?: string;
    page?: string;
  } | null;
  previewSnackName: string;
  previewSnackDescription: string;
  previewSnackSdkVersion: string;
  previewSnackFiles: PreviewSnackFiles;
  previewSnackDependencies: PreviewSnackDependencies;
  urlLoadId: number;
}

const buildInitialState = (): PlanState => ({
  fullscreen: false,
  mode: "edit",
  responsive: "desktop",
  previewRuntime: DEFAULT_PREVIEW_RUNTIME,
  runtimeLocked: false,
  loading: null,
  title: null,
  projectId: null,
  generating: false,
  readerMode: false,
  framework: null,
  input: null,
  memory: null,
  csslib: null,
  isStreamActive: null, // New: Track if stream is receiving data
  url: null, // Backend URL for fetching project files
  previewUrl: null, // WebContainer preview URL
  lastResponder: null,
  isResponseCompleted: null,
  enh_prompt: null,
  startingPoint: null,
  generationSuccess: "success",
  memoryModal: false,
  promptCount: null,
  tokenLimit: null,
  tokensUsed: null,
  tokensRemaining: null,
  refreshCounter: 0,
  inspectorMode: false,
  editMode: false,
  showTemplateBlocks: false,
  showPreviewPageBar: false,
  model: null,
  pendingAttachment: null,
  selectedBlock: null,
  previewSnackName: DEFAULT_PREVIEW_SNACK_NAME,
  previewSnackDescription: DEFAULT_PREVIEW_SNACK_DESCRIPTION,
  previewSnackSdkVersion: DEFAULT_PREVIEW_SNACK_SDK_VERSION,
  previewSnackFiles: { ...DEFAULT_PREVIEW_SNACK_FILES },
  previewSnackDependencies: { ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES },
  urlLoadId: 0,
});

// Initial state is empty
const initialState: PlanState = buildInitialState();

// Create the slice
const projectOptions = createSlice({
  name: "projectoptions",
  initialState,
  reducers: {
    clearUrlAndPrompt: (state) => {
      return {
        ...state,
        url: null,
        previewUrl: null,
        enh_prompt: null,
      };
    },
    setprojectOptions: (state, action: PayloadAction<PlanState>) => {
      return {
        ...state,
        fullscreen: action.payload.fullscreen,
        mode: action.payload.mode,
        responsive: action.payload.responsive,
      };
    },
    setPreviewRuntime: (state, action: PayloadAction<PreviewRuntime>) => {
      if (state.runtimeLocked) return state;
      return {
        ...state,
        previewRuntime: action.payload,
      };
    },
    lockPreviewRuntime: (state, action: PayloadAction<PreviewRuntime>) => {
      return {
        ...state,
        previewRuntime: action.payload,
        runtimeLocked: true,
      };
    },
    bumpUrlLoadId: (state) => {
      return {
        ...state,
        urlLoadId: state.urlLoadId + 1,
      };
    },
    setPromptCount: (state, action: PayloadAction<number>) => {
      return {
        ...state,
        promptCount: action.payload,
      };
    },
    setShowPreviewPageBar: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        showPreviewPageBar: action.payload,
      };
    },
    setTokenUsage: (
      state,
      action: PayloadAction<{
        tokenLimit?: number | null;
        tokensUsed?: number | null;
        tokensRemaining?: number | null;
      }>
    ) => {
      return {
        ...state,
        tokenLimit:
          typeof action.payload.tokenLimit === "number"
            ? action.payload.tokenLimit
            : state.tokenLimit,
        tokensUsed:
          typeof action.payload.tokensUsed === "number"
            ? action.payload.tokensUsed
            : state.tokensUsed,
        tokensRemaining:
          typeof action.payload.tokensRemaining === "number"
            ? action.payload.tokensRemaining
            : state.tokensRemaining,
      };
    },
    setGenerationSuccess: (
      state,
      action: PayloadAction<"success" | "thinking" | "failed" | null>
    ) => {
      return {
        ...state,
        generationSuccess: action.payload,
      };
    },
    setTitle: (state, action: PayloadAction<string | null>) => {
      return {
        ...state,
        title: action.payload,
      };
    },
    setMemory: (state, action: PayloadAction<string>) => {
      return {
        ...state,
        memory: action.payload,
      };
    },
    refreshPreview: (state) => {
      state.refreshCounter += 1;
    },
    setMemoryModal: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        memoryModal: action.payload,
      };
    },
    setprojectDetails: (state, action: PayloadAction<PlanState>) => {
      return {
        ...state,
        input: action.payload.input,
        memory: action.payload.memory,
        csslib: action.payload.csslib,
        framework: action.payload.framework,
      };
    },
    setProjectMode: (
      state,
      action: PayloadAction<{ mode: "edit" | "split" | "code" | "pages" }>
    ) => {
      return {
        ...state,
        mode: action.payload.mode,
      };
    },
    setReaderMode: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        readerMode: action.payload,
      };
    },
    setResponsivess: (
      state,
      action: PayloadAction<{ responsive: "desktop" | "mobile" }>
    ) => {
      return {
        ...state,
        responsive: action.payload.responsive,
      };
    },
    setFullscreen: (state, action: PayloadAction<{ fullscreen: boolean }>) => {
      return {
        ...state,
        fullscreen: action.payload.fullscreen,
      };
    },
    setGenerating: (
      state,
      action: PayloadAction<{
        generating: boolean;
        isResponseCompleted?: boolean;
        generationSuccess?: "success" | "failed" | "thinking" | null;
      }>
    ) => {
      return {
        ...state,
        generating: action.payload.generating,
        isResponseCompleted: action.payload.isResponseCompleted ?? null,
        generationSuccess: action.payload.generationSuccess ?? null,
      };
    },
    setModel: (state, action: PayloadAction<string | null>) => {
      return {
        ...state,
        model: action.payload,
      };
    },
    setStreamActive: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        isStreamActive: action.payload,
      };
    },
    setInspectorMode: (state, action: PayloadAction<boolean>) => {
      state.inspectorMode = action.payload;
      if (action.payload) {
        state.editMode = false;
        state.selectedBlock = null;
      }
    },
    setEditMode: (state, action: PayloadAction<boolean>) => {
      state.editMode = action.payload;
      if (action.payload) {
        state.inspectorMode = false;
      } else {
        state.showTemplateBlocks = false;
        state.selectedBlock = null;
      }
    },
    setShowTemplateBlocks: (state, action: PayloadAction<boolean>) => {
      state.showTemplateBlocks = action.payload;
    },
    setPendingAttachment: (
      state,
      action: PayloadAction<{
        fileName: string;
        lineNumber: number;
        endLine?: number;
        elementName: string;
        code?: string;
      } | null>
    ) => {
      return {
        ...state,
        pendingAttachment: action.payload,
      };
    },
    setSelectedBlock: (
      state,
      action: PayloadAction<{
        id: string;
        html: string;
        selector?: string;
        page?: string;
      } | null>
    ) => {
      return {
        ...state,
        selectedBlock: action.payload,
      };
    },
    setUrl: (state, action: PayloadAction<string | null>) => {
      return {
        ...state,
        url: action.payload,
      };
    },
    setPreviewUrl: (state, action: PayloadAction<string | null>) => {
      return {
        ...state,
        previewUrl: action.payload,
      };
    },
    setPreviewSnackMeta: (
      state,
      action: PayloadAction<{
        name?: string;
        description?: string;
        sdkVersion?: string;
      }>
    ) => {
      return {
        ...state,
        previewSnackName: action.payload.name ?? state.previewSnackName,
        previewSnackDescription:
          action.payload.description ?? state.previewSnackDescription,
        previewSnackSdkVersion:
          action.payload.sdkVersion !== undefined
            ? normalizePreviewSdkVersionForState(action.payload.sdkVersion)
            : state.previewSnackSdkVersion,
      };
    },
    setPreviewSnackFiles: (state, action: PayloadAction<PreviewSnackFiles>) => {
      return {
        ...state,
        previewSnackFiles: { ...action.payload },
      };
    },
    updatePreviewSnackFiles: (
      state,
      action: PayloadAction<Record<string, string | null>>
    ) => {
      const nextFiles: PreviewSnackFiles = { ...state.previewSnackFiles };
      let changed = false;
      Object.entries(action.payload).forEach(([path, contents]) => {
        if (contents === null) {
          if (path in nextFiles) {
            delete nextFiles[path];
            changed = true;
          }
        } else if (nextFiles[path] !== contents) {
          nextFiles[path] = contents;
          changed = true;
        }
      });
      if (!changed) return state;
      return {
        ...state,
        previewSnackFiles: nextFiles,
      };
    },
    setPreviewSnackDependencies: (
      state,
      action: PayloadAction<PreviewSnackDependencies>
    ) => {
      const normalizedDependencies: PreviewSnackDependencies = {};
      Object.entries(action.payload).forEach(([name, version]) => {
        if (typeof version !== "string" || !version.trim()) return;
        const normalizedName = normalizeDependencyNameForState(name);
        if (!normalizedName) return;
        normalizedDependencies[normalizedName] = version.trim();
      });
      return {
        ...state,
        previewSnackDependencies:
          enforcePreviewSdk54DependencyPins(normalizedDependencies),
      };
    },
    updatePreviewSnackDependencies: (
      state,
      action: PayloadAction<Record<string, string | null>>
    ) => {
      const nextDependencies: PreviewSnackDependencies = {
        ...state.previewSnackDependencies,
      };
      let changed = false;

      Object.entries({ ...nextDependencies }).forEach(([name, version]) => {
        const normalizedName = normalizeDependencyNameForState(name);
        if (!normalizedName || normalizedName === name) return;
        delete nextDependencies[name];
        nextDependencies[normalizedName] = version;
        changed = true;
      });

      Object.entries(action.payload).forEach(([name, version]) => {
        const normalizedName = normalizeDependencyNameForState(name);
        if (!normalizedName) return;

        if (normalizedName !== name && name in nextDependencies) {
          delete nextDependencies[name];
          changed = true;
        }

        if (version === null) {
          if (normalizedName in nextDependencies) {
            delete nextDependencies[normalizedName];
            changed = true;
          }
        } else {
          const normalizedVersion = version.trim();
          if (!normalizedVersion) return;
          if (nextDependencies[normalizedName] !== normalizedVersion) {
            nextDependencies[normalizedName] = normalizedVersion;
            changed = true;
          }
        }
      });

      const pinnedDependencies = enforcePreviewSdk54DependencyPins(nextDependencies);
      const pinAdjusted =
        Object.keys(pinnedDependencies).length !==
          Object.keys(nextDependencies).length ||
        Object.entries(pinnedDependencies).some(
          ([name, version]) => nextDependencies[name] !== version,
        );

      if (!changed && !pinAdjusted) return state;
      return {
        ...state,
        previewSnackDependencies: pinnedDependencies,
      };
    },
    resetPreviewSnackState: (state) => {
      return {
        ...state,
        previewSnackName: DEFAULT_PREVIEW_SNACK_NAME,
        previewSnackDescription: DEFAULT_PREVIEW_SNACK_DESCRIPTION,
        previewSnackSdkVersion: DEFAULT_PREVIEW_SNACK_SDK_VERSION,
        previewSnackFiles: { ...DEFAULT_PREVIEW_SNACK_FILES },
        previewSnackDependencies: { ...DEFAULT_PREVIEW_SNACK_DEPENDENCIES },
      };
    },
    resetProjectOptions: () => buildInitialState(),
  },
  extraReducers: (builder) => {
    builder.addCase(fetchProject.pending, (state) => {
      state.loading = "loading";
    });
    builder.addCase(
      fetchProject.fulfilled,
      (
        state,
        action: PayloadAction<{
          title: string;
          projectId: string;
          input: string;
          csslib: string;
          framework: string;
          memory: string;
          isResponseCompleted: boolean;
          url: string;
          lastResponder: "ai" | "user";
          enh_prompt: string;
          promptCount: number | null;
          tokenLimit?: number | null;
          tokensUsed?: number | null;
          tokensRemaining?: number | null;
          startingPoint?: string | null;
          previewRuntime?: PreviewRuntime | null;
        }>
      ) => {
        state.url = null;
        state.loading = "done";
        state.title = action.payload.title;
        state.projectId = action.payload.projectId;
        state.framework = action.payload.framework;
        const apiRuntime =
          action.payload.previewRuntime === "mobile" ||
          action.payload.previewRuntime === "web"
            ? action.payload.previewRuntime
            : inferPreviewRuntime(action.payload.framework);
        state.previewRuntime = apiRuntime;
        state.runtimeLocked = true;
        state.input = action.payload.input;
        state.csslib = action.payload.csslib;
        state.memory = action.payload.memory;
        state.url = action.payload.url;
        state.lastResponder = action.payload.lastResponder;
        state.isResponseCompleted = action.payload.isResponseCompleted;
        state.enh_prompt = action.payload.enh_prompt;
        state.promptCount = action.payload.promptCount;
        state.tokenLimit =
          typeof action.payload.tokenLimit === "number"
            ? action.payload.tokenLimit
            : null;
        state.tokensUsed =
          typeof action.payload.tokensUsed === "number"
            ? action.payload.tokensUsed
            : null;
        state.tokensRemaining =
          typeof action.payload.tokensRemaining === "number"
            ? action.payload.tokensRemaining
            : null;
        state.startingPoint = action.payload.startingPoint || null;
      }
    );
    builder.addCase(fetchProject.rejected, (state) => {
      state.loading = "error";
    });
  },
});

export const {
  setprojectOptions,
  setPreviewRuntime,
  lockPreviewRuntime,
  bumpUrlLoadId,
  setMemory,
  setMemoryModal,
  setProjectMode,
  setResponsivess,
  setGenerating,
  setFullscreen,
  setReaderMode,
  setprojectDetails,
  setPromptCount,
  setShowPreviewPageBar,
  setTokenUsage,
  clearUrlAndPrompt,
  setGenerationSuccess,
  refreshPreview,
  setTitle,
  setModel,
  setStreamActive,
  setInspectorMode,
  setEditMode,
  setShowTemplateBlocks,
  setPendingAttachment,
  setSelectedBlock,
  setUrl,
  setPreviewUrl,
  setPreviewSnackMeta,
  setPreviewSnackFiles,
  updatePreviewSnackFiles,
  setPreviewSnackDependencies,
  updatePreviewSnackDependencies,
  resetPreviewSnackState,
  resetProjectOptions,
} = projectOptions.actions;
export default projectOptions.reducer;

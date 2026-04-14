import { API } from "@/app/config/publicEnv";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Project {
  title: string;
  generatedName: string;
  input?: string;
  csslib?: string;
  framework?: string;
  memory?: string;
  url?: string;
  isPinned?: boolean;
  updatedAt: string;
  isPublic: boolean;
  deployed_url: string;
  /** Web vs mobile builder target — drives list card icon */
  previewRuntime?: "web" | "mobile" | null;
  templateSlug?: string | null;
  templateCategory?: string | null;
  siteMetaTitle?: string | null;
  siteFaviconUrl?: string | null;
}

interface userState {
  name: string | null;
  plan: string | null;
  prompt: string | null;
  loginModalOpen: boolean;
  authenticated: boolean | null;
  email: string | null;
  projectId: string | null;
  BetaOpen: boolean;
  images: string[];
  imageURLs: string[];
  currentPage: string;
  projects: Project[];
  loading: "success" | "error" | "loading" | null;
  pricingModalOpen: boolean;
  id: string | null;
  isSidebarCollapsed: boolean;
  MobileChatOpen: boolean;
  claudeApiKey: string;
}

// Initial state is empty
const initialState: userState = {
  name: null,
  plan: null,
  prompt: null,
  loginModalOpen: false,
  authenticated: null,
  email: null,
  projectId: null,
  BetaOpen: false,
  images: [],
  imageURLs: [],
  currentPage: "",
  projects: [],
  loading: "loading",
  pricingModalOpen: false,
  id: null,
  isSidebarCollapsed: false,
  MobileChatOpen: false,
  claudeApiKey: "",
};

interface FetchAllProjectsParams {
  email: string;
}

export const fetchAllProjects = createAsyncThunk<
  {
    projects: Project[];
  },
  FetchAllProjectsParams
>("basicData/fetchAllProjects", async ({ email }, thunkAPI) => {
  try {
    const url = `${API}/get-all-projects`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.projects || !Array.isArray(data.projects)) {
      throw new Error(
        "Invalid response format: missing or invalid projects array"
      );
    }

    return { projects: data.projects };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return thunkAPI.rejectWithValue(errorMessage);
  }
});

// Create the slice
const basicData = createSlice({
  name: "basicData",
  initialState,
  reducers: {
    setVisibility: (
      state,
      action: PayloadAction<{ projectId: string; isPublic: boolean }>
    ) => {
      state.projects = state.projects.map((project) =>
        project.generatedName === action.payload.projectId
          ? { ...project, isPublic: action.payload.isPublic }
          : project
      );
    },
    setPlan: (state, action: PayloadAction<"free" | "scale">) => {
      state.plan = action.payload;
    },
    setClaudeApiKey: (state, action: PayloadAction<string>) => {
      state.claudeApiKey = action.payload;
    },
    setIsSidebarCollapsed: (state) => {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
    setMobileChatOpen: (state) => {
      state.MobileChatOpen = !state.MobileChatOpen;
    },
    setId: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
    setPricingModalOpen: (state, action: PayloadAction<boolean>) => {
      state.pricingModalOpen = action.payload;
    },
    setPinned: (
      state,
      action: PayloadAction<{ projectId: string; isPinned: boolean }>
    ) => {
      state.projects = state.projects.map((project) =>
        project.generatedName === action.payload.projectId
          ? { ...project, isPinned: action.payload.isPinned }
          : project
      );
    },
    renameProject: (
      state,
      action: PayloadAction<{ projectId: string; newTitle: string }>
    ) => {
      state.projects = state.projects.map((project) =>
        project.generatedName === action.payload.projectId
          ? { ...project, title: action.payload.newTitle }
          : project
      );
    },
    deleteProject: (state, action: PayloadAction<{ projectId: string }>) => {
      state.projects = state.projects.filter(
        (project) => project.generatedName !== action.payload.projectId
      );
    },
    setbasicData: (state, action: PayloadAction<userState>) => {
      return {
        ...state,
        name: action.payload.name,
        plan: action.payload.plan,
      };
    },
    setAuthenticated: (
      state,
      action: PayloadAction<{
        authStatus: boolean;
        name: string;
        email: string;
        projectId: string;
      }>
    ) => {
      return {
        ...state,
        authenticated: action.payload.authStatus,
        name: action.payload.name,
        email: action.payload.email,
        projectId: action.payload.projectId,
      };
    },
    setLoginModalOpen: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        loginModalOpen: action.payload,
      };
    },
    setBetaModalOpen: (state, action: PayloadAction<boolean>) => {
      return {
        ...state,
        BetaOpen: action.payload,
      };
    },
    addImage: (state, action: PayloadAction<string>) => {
      if (state.images.length < 2) {
        state.images.push(action.payload);
      }
    },
    removeImage: (state, action: PayloadAction<number>) => {
      state.images.splice(action.payload, 1);
    },
    clearImages: (state) => {
      state.images = [];
    },
    addImageURL: (state, action: PayloadAction<string>) => {
      if (state.imageURLs.length < 2) {
        state.imageURLs.push(action.payload);
      }
    },
    removeImageURL: (state, action: PayloadAction<number>) => {
      state.imageURLs.splice(action.payload, 1);
    },
    clearImagesURL: (state) => {
      state.imageURLs = [];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchAllProjects.pending, (state) => {
      state.loading = "loading";
    });
    builder.addCase(
      fetchAllProjects.fulfilled,
      (state, action: PayloadAction<{ projects: Project[] }>) => {
        state.loading = "success";
        state.projects = action.payload.projects;
      }
    );
    builder.addCase(fetchAllProjects.rejected, (state) => {
      state.loading = "error";
    });
  },
});

export const {
  setbasicData,
  setLoginModalOpen,
  setAuthenticated,
  setBetaModalOpen,
  addImage,
  removeImage,
  clearImages,
  addImageURL,
  removeImageURL,
  clearImagesURL,
  setPinned,
  setVisibility,
  renameProject,
  deleteProject,
  setPlan,
  setPricingModalOpen,
  setId,
  setIsSidebarCollapsed,
  setMobileChatOpen,
  setClaudeApiKey,
} = basicData.actions;
export default basicData.reducer;

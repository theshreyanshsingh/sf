import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface terminalState {
  success: boolean | null;
  output: string | null;
}

// Initial state is empty
const initialState: terminalState = {
  output: "",
  success: null,
};

// Create the slice
const terminalProvider = createSlice({
  name: "terminalprovider",
  initialState,
  reducers: {
    setTerminal: (state, action: PayloadAction<terminalState>) => {
      state.success = null;
      state.output = "";
      return {
        ...state,
        success: action.payload.success,
        output: action.payload.output,
      };
    },
    resetTerminal: () => initialState,
  },
});

export const { setTerminal, resetTerminal } = terminalProvider.actions;
export default terminalProvider.reducer;

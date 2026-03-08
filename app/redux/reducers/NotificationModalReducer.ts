import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface notificaionState {
  modalOpen: boolean;
  text: string | null;
  status: 'success' | 'error' | 'info' | null;
}

// Initial state is empty
const initialState: notificaionState = {
  modalOpen: false,
  text: null,
  status: null,
};

// Create the slice
const notificaitonProvider = createSlice({
  name: 'notificaitonprovider',
  initialState,
  reducers: {
    setNotification: (state, action: PayloadAction<notificaionState>) => {
      return {
        ...state,
        modalOpen: action.payload.modalOpen,
        text: action.payload.text,
        status: action.payload.status,
      };
    },
  },
});

export const { setNotification } = notificaitonProvider.actions;
export default notificaitonProvider.reducer;

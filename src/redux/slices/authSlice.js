import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: {
    name: "",
    _id: "",
    email: "",
    role: "",
    phone: "",
    profileImg: "",
    pagePermissions: [],
  },
};

const authSlice = createSlice({
  name: "authSlice",
  initialState,
  reducers: {
    isLoginSuccess: (state, action) => {
      state.user = action.payload;
    },
    updateUserPermissions: (state, action) => {
      state.user.pagePermissions = action.payload;
    },
  },
});

export const { isLoginSuccess, updateUserPermissions } = authSlice.actions;
export default authSlice.reducer;
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setProjectMode } from "@/app/redux/reducers/projectOptions";
import { RootState } from "@/app/redux/store";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { CiViewTimeline } from "react-icons/ci";
import { IoCode } from "react-icons/io5";
import { MdOutlineLayers } from "react-icons/md";

const Switcher = () => {
  const dispatch = useDispatch();
  const { mode, generationSuccess, previewRuntime } = useSelector(
    (state: RootState) => state.projectOptions
  );
  const isMobilePreviewRuntime = previewRuntime === "mobile";
  const canChangeWorkspaceMode =
    generationSuccess === "success" || generationSuccess === "thinking";

  const allOptions = [
    { id: "edit", icon: "Preview", label: "Edit" },
    { id: "code", icon: "Editor", label: "Code" },
    { id: "split", icon: "Console", label: "Split" },
    { id: "pages", icon: "Pages", label: "Pages" },
  ];

  const allMobileOptions = [
    { id: "edit", icon: <CiViewTimeline />, label: "Edit" },
    { id: "code", icon: <IoCode />, label: "Code" },
    { id: "pages", icon: <MdOutlineLayers />, label: "Pages" },
  ];

  const options = isMobilePreviewRuntime
    ? allOptions.filter(
        (option) => option.id !== "pages" && option.id !== "split"
      )
    : allOptions;

  const mobileOptions = isMobilePreviewRuntime
    ? allMobileOptions.filter(
        (option) => option.id !== "pages" && option.id !== "split"
      )
    : allMobileOptions;

  const allowedModes = isMobilePreviewRuntime
    ? ["edit", "code"]
    : ["edit", "code", "split", "pages"];

  // swtcih btwn code, split and edit
  const handleMode = async (id: "edit" | "code" | "split" | "pages") => {
    try {
      if (allowedModes.includes(id)) {
        dispatch(setProjectMode({ mode: id }));
      } else {
        console.error(`Invalid mode: ${id}`);
      }
    } catch (error) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "There is an issue while saving the code!",
        })
      );
      console.log(error);
    }
  };

  useEffect(() => {
    if (isMobilePreviewRuntime && (mode === "pages" || mode === "split")) {
      dispatch(setProjectMode({ mode: "edit" }));
    }
  }, [dispatch, isMobilePreviewRuntime, mode]);

  return (
    <div className="relative flex bg-[#252525] rounded-md w-fit shadow-lg z-10">
      {/* Desktop switcher */}
      <div className="justify-center items-center md:flex hidden">
        {options.map((option, index) => (
          <React.Fragment key={option.id}>
            <button
              onClick={() => {
                if (canChangeWorkspaceMode) {
                  handleMode(option.id as "edit" | "split" | "code" | "pages");
                }
              }}
              className={`relative flex items-center justify-center px-3 py-1 text-xs font-medium font-sans  transition-all duration-200 z-10 ${
                mode === option.id
                  ? "text-black bg-white rounded-md"
                  : "text-white hover:text-[#4f92e1]"
              }`}
            >
              {option.icon}
            </button>
            {index < options.length - 1 && (
              <div className="w-px h-3 bg-[#FFFFFF]/30 self-center" />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Mobile switcher */}
      <div className="justify-center items-center flex md:hidden">
        {mobileOptions.map((option, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => {
                if (canChangeWorkspaceMode) {
                  handleMode(option.id as "edit" | "code" | "split" | "pages");
                }
              }}
              className={`relative flex items-center justify-center px-3 py-1 text-xs font-medium font-sans  transition-all duration-200 z-10 ${
                mode === option.id
                  ? "text-black bg-white rounded-md"
                  : "text-white hover:text-[#4f92e1]"
              }`}
            >
              {option.icon}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Switcher;

"use client";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { RootState } from "@/app/redux/store";
import { useResponse } from "@/app/_services/useResponse copy";
import { Meteors } from "@/components/magicui/meteors";

const EnhancedPrompt = ({
  enh_prompt,
  projectId,
}: {
  enh_prompt: string;
  projectId: string;
}) => {
  let initialDetails;
  try {
    initialDetails = JSON.parse(enh_prompt);
  } catch (error) {
    // If parsing fails, treat it as a plain text plan
    initialDetails = {
      plan: enh_prompt,
      framework: "other", // Default to non-webcomponents
      summary: "",
      features: [],
      memoryEnhancement: "",
      theme: "",
    };
  }

  const dispatch = useDispatch();

  const { email } = useAuthenticated();

  const { generateResponse } = useResponse();

  const [isEditing, setIsEditing] = useState(false);
  const [projectSummary, setProjectSummary] = useState(initialDetails.summary);
  const [features, setFeatures] = useState<string[]>(
    initialDetails.features || []
  );
  const [memoryEnhancement, setMemoryEnhancement] = useState(
    initialDetails.memoryEnhancement
  );
  const [theme, setTheme] = useState(initialDetails.theme);

  if (!enh_prompt) return null;

  // Check if the framework is webcomponents
  const { framework } = useSelector((state: RootState) => state.projectOptions);

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    // Validate inputs for webcomponents
    if (!projectSummary.trim()) {
      alert("Project Summary cannot be empty");
      return;
    }

    if (features.some((feature) => !feature.trim())) {
      alert("Features cannot be empty");
      return;
    }

    if (!memoryEnhancement.trim()) {
      alert("Memory cannot be empty");
      return;
    }

    if (!theme.trim()) {
      alert("theme cannot be empty");
      return;
    }

    // Save logic would go here
    setIsEditing(false);
  };

  const handleStart = async () => {
    try {
      generateResponse({
        email: email.value || "",
        projectId,
        input: JSON.stringify(initialDetails),
        save: true,
      });
    } catch (error) {
      console.log(error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Something went wrong!",
        })
      );
    }
  };

  return (
    <div className="relative flex justify-center items-center w-full h-full">
      <Meteors />
      {/* Blue Gradient Background */}
      <div
        className="absolute inset-0 z-10 opacity-75 pointer-events-none"
        style={{
          backgroundImage: `
  radial-gradient(at 20% 90%, hsla(220, 70%, 25%, 0.3) 0px, transparent 50%),
  radial-gradient(at 50% 50%, hsla(240, 80%, 30%, 0.25) 0px, transparent 50%)
`,
        }}
      />

      {/* Grain Effect */}
      <div
        className="absolute inset-0 z-20"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      />
      <div className="absolute transform -translate-y-1/2 top-1/2 space-y-4">
        <div className="justify-between items-center flex">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-white font-sans mb-1">
              Agent's Plan
            </h3>
          </div>
          <div className="flex justify-end items-center space-x-3">
            <button
              onClick={handleStart}
              className="cursor-pointer text-black bg-white hover:text-black hover:bg-gray-50 rounded-md px-3 p-1 gap-x-1 justify-center items-center flex font-sans font-medium text-xs"
            >
              Begin Build
            </button>
          </div>
        </div>
        <div className="max-md:w-[80vw] md:w-[50vw] h-[60vh] overflow-y-auto  rounded-xl shadow-2xl text-white font-sans backdrop-blur-sm">
          <div className="text-sm">
            {initialDetails.plan.url && (
              <div className=" mb-4">
                <div className="max-h-64 overflow-y-auto border border-[#2a2a2b] rounded-lg bg-[#1c1c1d] p-2">
                  <img
                    src={initialDetails.plan.url || initialDetails.url}
                    alt="Project Preview"
                    className="w-full h-auto rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>
            )}

            <div className="bg-[#1c1c1d]  rounded-lg p-4">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[#b1b1b1] font-mono">
                {initialDetails.plan.plan ||
                  initialDetails.plan.data ||
                  initialDetails.plan ||
                  "No plan data available"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedPrompt;

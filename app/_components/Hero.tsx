"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}
import Header from "./Header";
import NavigationBanner from "./NavigationBanner";
import { AnimatePresence, motion } from "framer-motion";
import AttachmentPreview, { AttachmentType } from "./AttachmentPreview";
import VoiceWaves from "./VoiceWaves";
import {
  FaArrowRight,
  FaPaperclip,
  FaChevronDown,
  FaMicrophone,
  FaStop,
} from "react-icons/fa6";
import { useDispatch } from "react-redux";
import {
  addImage,
  addImageURL,
  removeImage,
  removeImageURL,
  setLoginModalOpen,
  setPricingModalOpen,
} from "../redux/reducers/basicData";
import { useAuthenticated } from "../helpers/useAuthenticated";
import { LuLoaderCircle } from "react-icons/lu";
import { CgFigma } from "react-icons/cg";

// import { setGenerating } from "../redux/reducers/projectOptions";
import { API } from "../config/publicEnv";
import { setNotification } from "../redux/reducers/NotificationModalReducer";
import { useSubscriptionCheck } from "../helpers/useSubscriptionCheck";
import { clearAllFiles, EmptySheet } from "../redux/reducers/projectFiles";
import { useRouter } from "next/navigation";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Meteors } from "@/components/magicui/meteors";
import { MorphingText } from "@/components/magicui/morphing-text";
import { IoIosArrowDown } from "react-icons/io";
import { CiLaptop, CiMobile1 } from "react-icons/ci";

import {
  clearMessages,
  Message,
  setChatHidden,
  setChatId,
} from "../redux/reducers/chatSlice";
import { createProject } from "../_services/createProject";
import { setTitle } from "../redux/reducers/projectOptions";
import {
  STARTING_POINTS,
  MOBILE_STARTING_POINTS,
  type StartingPoint,
} from "../config/startingPoints";

// FAQ Data
const faqData = [
  {
    question:
      "Why does Superblocks never crash or slow down during long coding sessions?",
    answer:
      "Superblocks is optimized for performance and stability. It uses efficient memory management and auto-saving so even large projects stay responsive without crashes or lag.",
  },
  {
    question: "How does building an application with Superblocks work?",
    answer:
      "Simply describe what you want to build in natural language, and our AI agents will generate a complete, production-ready application with modern frameworks like React, Vue, or Angular. The process includes UI design, functionality implementation, and deployment setup.",
  },
  {
    question: "Is Superblocks good for SEO?",
    answer:
      "Yes! All applications built with Superblocks are automatically optimized for SEO with proper meta tags, structured data, fast loading times, and mobile responsiveness. We follow modern SEO best practices to ensure your app ranks well in search engines.",
  },
  {
    question: "Will I waste credits on failed or buggy code generation?",
    answer:
      "No. You never pay for failures. Credits are only used for correct, tested outputs failed or erroneous attempts don’t consume them, and Superblocks retries intelligently.",
  },
  {
    question:
      "How does Superblocks ensure the generated code is clean and maintainable?",
    answer:
      "Superblocks’ agent understands your app’s context and structure. It outputs modular, readable, and clearly annotated code—making it easy to customize and scale.",
  },
];

const WEB_TYPEWRITER_TEXTS = [
  "Build a Todo App",
  "Create a landing page",
  "Develop a habit tracker website",
  "Build a Music Player",
  "Make a social media app",
];

const MOBILE_TYPEWRITER_TEXTS = [
  "Build an iOS fitness tracker app",
  "Create an Android food delivery app",
  "Design a mobile fintech wallet app",
  "Build a travel booking mobile app",
  "Make a social media mobile app",
];

// Community Card Component
const CommunityCard = ({
  data,
  index,
}: {
  data: { title: string; url: string; image: string };
  index: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="overflow-hidden hover:border-[#3a3a3b] transition-all duration-300 group"
    >
      <div className="aspect-video relative rounded-lg overflow-hidden">
        <img
          className="h-full w-full object-cover bg-black"
          src={data.image}
          alt={data.title}
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />

        {/* Preview Button - appears on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <a
            href={
              data.url.startsWith("http://") || data.url.startsWith("https://")
                ? data.url
                : `https://${data.url}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer px-2 py-1 bg-white text-black font-medium text-sm rounded-lg hover:bg-gray-100 duration-200 transform translate-y-2 group-hover:translate-y-0 font-sans transition-transform"
          >
            Preview
          </a>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-xs text-[#71717A]">
          <h3 className="text-white font-semibold text-sm line-clamp-1">
            {data.title}
          </h3>
        </div>
      </div>
    </motion.div>
  );
};

// FAQ Item Component
const FAQItem = ({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className=" overflow-hidden max-w-3xl w-full justify-center items-center flex flex-col "
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="cursor-pointer  w-full px-6 py-4 text-left flex justify-between items-center  transition-colors"
      >
        <span className="text-white font-medium text-sm font-sans pr-4">
          {question}
        </span>
        <FaChevronDown
          className={`text-[#71717A] transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-4 pt-0">
          <p className="text-[#b1b1b1] text-sm leading-relaxed">{answer}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface Project {
  title: string;
  url: string;
  image: string;
}

const Hero = () => {
  const [input, setInput] = useState("");
  const [framework] = useState("React");
  const [cssLibrary] = useState("Tailwind CSS");
  const [memory] = useState("");
  const allowedModels = new Set(["claude-opus-4.6", "claude-sonnet-4.5"]);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === "undefined") return "claude-sonnet-4.5";
    const stored = sessionStorage.getItem("model");
    return stored && allowedModels.has(stored)
      ? stored
      : "claude-sonnet-4.5";
  });
  const [selectedStartingPoint, setSelectedStartingPoint] =
    useState<StartingPoint | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [previewDropdownOpen, setPreviewDropdownOpen] = useState(false);
  const [landingPreview, setLandingPreview] = useState<"web" | "mobile">(
    "web"
  );
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const router = useRouter();

  const dispatch = useDispatch();

  // Save selected model to session storage whenever it changes
  useEffect(() => {
    sessionStorage.setItem("model", selectedModel);
  }, [selectedModel]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setInput((prev) => prev + (prev ? " " : "") + finalTranscript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "not-allowed") {
            dispatch(
              setNotification({
                modalOpen: true,
                status: "error",
                text: "Microphone permission denied. Please allow microphone access and try again.",
              })
            );
          } else if (event.error === "no-speech") {
            dispatch(
              setNotification({
                modalOpen: true,
                status: "error",
                text: "No speech detected. Please try speaking again.",
              })
            );
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [dispatch]);

  const [loading, setLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [figmaModalOpen, setFigmaModalOpen] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaConnected, setFigmaConnected] = useState<boolean>(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [attachments, setAttachments] = useState<AttachmentType[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const previewDropdownRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<boolean>(false);

  const { isAuthenticated, email } = useAuthenticated();

  const { needsUpgrade, checkSubscriptionStatus } = useSubscriptionCheck({
    isAuthenticated: isAuthenticated.value,
    email: email?.value || "",
  });

  const mainContentVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.2, delay: 0.2 } },
  };

  const inputBoxVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.2, delay: 0.3 } },
  };

  const agentIntroVariants = {
    hidden: { y: -10, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
  };

  const footerVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, delay: 0.8 } },
  };

  const typewriterTexts = useMemo(
    () =>
      landingPreview === "mobile"
        ? MOBILE_TYPEWRITER_TEXTS
        : WEB_TYPEWRITER_TEXTS,
    [landingPreview]
  );

  const activeStartingPoints = useMemo(
    () =>
      landingPreview === "mobile" ? MOBILE_STARTING_POINTS : STARTING_POINTS,
    [landingPreview]
  );

  const subHeadline =
    landingPreview === "mobile"
      ? "Turn one idea into a launch-ready mobile app experience with polished screens and flows."
      : "Turn a single idea, into a launch ready SEO-optimized application with hosting.";

  const startingPointsHint =
    landingPreview === "mobile"
      ? "Pick a mobile app template to prefill the prompt."
      : "Pick a launch template to prefill the prompt.";

  const modelOptions = [
    { name: "claude-opus-4.6", display: "Claude Opus 4.6", scale: false },
    { name: "claude-sonnet-4.5", display: "Claude Sonnet 4.5", scale: false },
  ];
  const landingPreviewOptions: Array<{
    name: "web" | "mobile";
    display: string;
    icon: React.ReactNode;
  }> = [
    { name: "web", display: "Web", icon: <CiLaptop className="text-sm" /> },
    {
      name: "mobile",
      display: "Mobile (Beta)",
      icon: <CiMobile1 className="text-sm" />,
    },
  ];

  useEffect(() => {
    const currentText = typewriterTexts[textIndex];

    const typingSpeed = isDeleting ? 50 : 100; // Faster delete speed
    const nextCharIndex = isDeleting ? charIndex - 1 : charIndex + 1;

    const updateText = () => {
      setPlaceholder(currentText.substring(0, nextCharIndex));

      if (!isDeleting && nextCharIndex === currentText.length) {
        setTimeout(() => setIsDeleting(true), 1000);
      } else if (isDeleting && nextCharIndex === 0) {
        setIsDeleting(false);
        setTextIndex((prev) => (prev + 1) % typewriterTexts.length);
      }
      setCharIndex(nextCharIndex);
    };

    const timeout = setTimeout(updateText, typingSpeed);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, typewriterTexts]);

  useEffect(() => {
    setTextIndex(0);
    setCharIndex(0);
    setIsDeleting(false);
    setPlaceholder("");
    setSelectedStartingPoint(null);
  }, [landingPreview]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(event.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
      if (
        previewDropdownRef.current &&
        !previewDropdownRef.current.contains(event.target as Node)
      ) {
        setPreviewDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleAttachClick = () => {
    if (!isAuthenticated.value) {
      router.push("/login");
    } else {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  function encodeImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!isAuthenticated.value) {
        dispatch(setLoginModalOpen(true));
      } else {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Limit to 2 attachment for all models
        if (attachments.length >= 2) {
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text: "You can only attach 2 image.",
            })
          );
          return;
        }

        const newFile = files[0];

        // Validate file type
        const validImageTypes = ["image/jpeg", "image/png"];
        const isValidType = validImageTypes.includes(newFile.type);

        if (!isValidType) {
          alert("Please upload only images.");
          return;
        }

        // Generate a unique file name
        const uniqueFileName = `upload_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // // Show loading state
        // setAttachments((prev) => [
        //   ...prev,
        //   {
        //     file: newFile,
        //     preview: "",
        //     type: "image",

        //     name: uniqueFileName, // Store unique name
        //   },
        // ]);

        // Upload to S3 or server
        const uploadedUrl = await getPresignedUrl(newFile, uniqueFileName);
        if (!uploadedUrl) {
          dispatch(
            setNotification({
              modalOpen: true,
              status: "error",
              text: "Error uploading!",
            })
          );
          return;
        }

        dispatch(addImageURL(uploadedUrl));

        // Convert image to Base64
        const base64Image = await encodeImageToBase64(newFile);
        dispatch(addImage(base64Image));

        // Create preview URL
        const filePreview = URL.createObjectURL(newFile);

        // Update attachment list (remove loading state & add URL)
        setAttachments((prev) =>
          prev.map((att) =>
            att.file === newFile
              ? {
                  ...att,
                  preview: filePreview,
                  isUploading: false,
                  uploadedUrl, // Store URL
                }
              : att
          )
        );
      }
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      // Reset file input
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];

      // Remove from Redux using index
      dispatch(removeImage(index));
      dispatch(removeImageURL(index));

      // Revoke object URL to free memory
      if (newAttachments[index]?.preview) {
        URL.revokeObjectURL(newAttachments[index].preview);
      }

      // Remove the attachment from state
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const getPresignedUrl = async (file: File, name: string): Promise<string> => {
    try {
      const response = await fetch(`${API}/get-presigned-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: name,
          fileType: file.type,
          email: email.value,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { uploadURL, url } = await response.json();
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed! status: ${uploadResponse.status}`);
      }

      return url;
    } catch (error) {
      console.error("Upload failed:", error);
      setAttachments((prev) => {
        const failedAttachmentIndex = prev.length - 1;
        if (failedAttachmentIndex < 0) return prev;

        const newAttachments = [...prev];
        const failedAttachment = newAttachments[failedAttachmentIndex];

        // Remove from Redux
        dispatch(removeImage(failedAttachmentIndex));
        dispatch(removeImageURL(failedAttachmentIndex));

        // Cleanup preview URL
        if (failedAttachment?.preview) {
          URL.revokeObjectURL(failedAttachment.preview);
        }

        // Remove the failed attachment
        newAttachments.splice(failedAttachmentIndex, 1);
        return newAttachments;
      });

      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to upload image. Please try again.",
        })
      );

      throw new Error("Failed to get presigned URL");
    }
  };

  const checkStatus = useCallback(async () => {
    if (isAuthenticated.value && email.value && !checkRef.current) {
      checkRef.current = true;
      await checkSubscriptionStatus();
    }
  }, [email.value, isAuthenticated.value, checkSubscriptionStatus]);

  useEffect(() => {
    // Only check subscription status once when component mounts
    checkStatus();

    // Cleanup function for attachments
    return () => {
      attachments.forEach((attachment) => {
        if (attachment.preview) {
          URL.revokeObjectURL(attachment.preview);
        }
      });
    };
  }, [email.value, checkStatus, attachments]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    // Check if any attachments are still uploading
    if (attachments.some((att) => att.isUploading)) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Please wait for all attachments to finish uploading.",
        })
      );
      return;
    }
    sessionStorage.clear();
    if (loading || !input.trim()) return;
    if (!isAuthenticated.value) {
      return router.push("/login");
    }
    const attachmentUrls = attachments
      .filter((att) => !att.isUploading && att.url)
      .slice(0, 2)
      .map((att) => att.url);

    const startingPointPrompt = selectedStartingPoint?.prompt || "";
    const combinedPrompt = startingPointPrompt
      ? `${startingPointPrompt}\n\nUser request:\n${input.trim()}`
      : input.trim();

    sessionStorage.setItem("input", input);
    sessionStorage.setItem("model", selectedModel);
    const characters = "abcdefghijklmnopqrstuvwxyz123456789";
    const generateSegment = (length: number) =>
      Array.from({ length }, () =>
        characters.charAt(Math.floor(Math.random() * characters.length))
      ).join("");

    const projectId = `${generateSegment(8)}-${generateSegment(8)}-${generateSegment(8)}-${generateSegment(8)}`;

    const payload = {
      prompt: combinedPrompt,
      model: selectedModel,
      attachments: attachmentUrls,
      attachmentCount: attachmentUrls.length,
      projectId,
      session: email.value || undefined,
      startingPoint: selectedStartingPoint?.id || null,
      previewRuntime: landingPreview,
      platform: landingPreview,
    };

    // Create user message object
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(), // Add timestamp when message is created
      attachments: attachments
        .filter((att) => !att.isUploading && att.url)
        .map((att) => ({
          name: att.name,
          url: att.url,
          type: att.type,
        })),
    };

    // Store payload and message in sessionStorage for this project
    const sessionData = {
      payload,
      message: userMessage,
      projectId,
      model: selectedModel,
      startingPoint: selectedStartingPoint?.id || null,
      previewRuntime: landingPreview,
    };
    sessionStorage.setItem(
      `superblocksMessage_${projectId}`,
      JSON.stringify(sessionData)
    );

    const result = await createProject(payload);

    if (result.success) {
      dispatch(clearMessages());
      dispatch(clearAllFiles());

      dispatch(setChatHidden(false));

      if (result.chatName && result.chatId) {
        sessionStorage.setItem("chatName", result.chatName);
        sessionStorage.setItem("chatId", result.chatId);
        dispatch(setTitle(result.projectTitle as string));
        dispatch(setChatId(result.chatId));
      }
      // Check if upgrade is needed
      if (result.upgradeNeeded === false) {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "info",
            text: "Upgrade needed to create this project.",
          })
        );
        setLoading(false);
        return;
      } else {
        window.location.href = `/projects/${projectId}`;
      }
    } else {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: result.message || "Failed to create project. Please try again.",
        })
      );
    }
    setLoading(false);
  }, [
    loading,
    input,
    memory,
    framework,
    cssLibrary,
    selectedModel,
    selectedStartingPoint,
    landingPreview,
    dispatch,
    router,
  ]);

  const startListening = async () => {
    if (!speechSupported) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Speech recognition is not supported in your browser.",
        })
      );
      return;
    }

    if (!recognitionRef.current) return;

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognitionRef.current.start();
    } catch (error) {
      console.error("Microphone permission error:", error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Microphone permission is required for speech-to-text functionality.",
        })
      );
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const startFigmaConnect = () => {
    window.location.href = "/api/figma/oauth";
  };

  const importFigmaImage = async () => {
    if (!figmaUrl.trim()) return;
    setFigmaLoading(true);
    try {
      const res = await fetch("/api/figma/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: figmaUrl.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { base64: string };

      // Convert base64 data URL to File for S3 upload
      const base64Data = data.base64.split(",")[1] || "";
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length)
        .fill(0)
        .map((_, i) => byteCharacters.charCodeAt(i));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });
      const uniqueName = `figma_${Date.now()}_${Math.floor(Math.random() * 10000)}.png`;
      const file = new File([blob], uniqueName, { type: "image/png" });

      // Optimistic preview entry
      setAttachments((prev) => [
        ...prev,
        {
          file,
          preview: data.base64,
          type: "image",
          isUploading: true,
          name: uniqueName,
        } as any,
      ]);

      // Upload to S3 and attach URL
      const uploadedUrl = await getPresignedUrl(file, uniqueName);
      if (!uploadedUrl) throw new Error("Failed to upload Figma image");

      dispatch(addImage(data.base64));
      dispatch(addImageURL(uploadedUrl));

      // Mark local attachment as uploaded
      setAttachments((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex(
          (att) => (att as any).name === uniqueName
        );
        if (idx !== -1) {
          (updated[idx] as any).isUploading = false;
          (updated[idx] as any).uploadedUrl = uploadedUrl;
        }
        return updated;
      });

      setFigmaModalOpen(false);
      setFigmaUrl("");
    } catch (e) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Failed to import from Figma",
        })
      );
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaImport = () => {
    setFigmaModalOpen(true);
  };

  // Figma helpers
  const fetchFigmaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/figma/status", { cache: "no-store" });
      if (!res.ok) return setFigmaConnected(false);
      const data = (await res.json()) as { connected: boolean };
      setFigmaConnected(Boolean(data.connected));
    } catch {
      setFigmaConnected(false);
    }
  }, []);

  useEffect(() => {
    if (figmaModalOpen) fetchFigmaStatus();
  }, [figmaModalOpen, fetchFigmaStatus]);

  const fetchSites = async () => {
    try {
      const response = await fetch(`${API}/get-sites`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      const data = await response.json();

      if (data.success && data.urls.length > 0) {
        const projectList = data.urls.map(
          (
            d: { title: string; url: string; image: string },
            index: number
          ) => ({
            title: d.title,
            url: d.url,
            image: d.image,
          })
        );
        setProjects(projectList);
      }
    } catch (error) {
      console.error("Error fetching sites:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  return (
    <main className="min-h-screen bg-[#000000] grid grid-cols-1 gap-10 md:gap-16 py-24 overflow-hidden relative">
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

      <Meteors />

      {/* Navigation Banner */}
      <NavigationBanner />

      {/* Header */}
      <Header />

      {/* Figma Modal */}
      <AnimatePresence>
        {figmaModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            <div
              onClick={() => setFigmaModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative z-[100000] w-full max-w-lg bg-[#141415] p-8 rounded-2xl shadow-2xl border border-[#2a2a2b] backdrop-blur-sm"
            >
              {/* Close Button */}
              <button
                onClick={() => setFigmaModalOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#2a2a2b] hover:bg-[#3a3a3b] transition-colors duration-200 group"
              >
                <svg
                  className="w-4 h-4 text-[#8C8C8C] group-hover:text-white transition-colors duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              {/* Header Section */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center mx-auto mb-4">
                  <CgFigma className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-2 font-[insSerifIt]">
                  Import from Figma
                </h3>
                <p className="text-[#b1b1b1] text-base font-sans">
                  Bring your designs to life with one click
                </p>
              </div>

              {/* Steps Section */}
              <div className="mb-8 p-6 bg-[#1c1c1d] rounded-xl border border-[#2a2a2b]">
                <h4 className="text-lg font-semibold text-white mb-4 text-center">
                  How to import
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        Open your Figma file
                      </p>
                      <p className="text-[#8C8C8C] text-xs">
                        Select the frame you want to import
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        Copy the frame link
                      </p>
                      <p className="text-[#8C8C8C] text-xs">
                        Right-click and select "Copy link" or press Ctrl+L
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white font-bold text-sm">3</span>
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">
                        Paste and import
                      </p>
                      <p className="text-[#8C8C8C] text-xs">
                        Paste the URL below and click import
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Section */}
              {!figmaConnected ? (
                <div className="text-center">
                  <p className="text-[#b1b1b1] text-sm mb-6">
                    Connect your Figma account to start importing designs
                  </p>
                  <button
                    onClick={startFigmaConnect}
                    className="w-full bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] text-white py-3 rounded-xl font-medium text-sm hover:from-[#5ba0f2] hover:to-[#6bb3f7] shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Connect with Figma
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-white font-medium text-sm mb-2">
                      Figma URL
                    </label>
                    <input
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      className="w-full rounded-lg bg-[#1c1c1d] border border-[#2a2a2b] p-3 text-white font-sans text-sm outline-none focus:border-[#4a90e2] transition-colors"
                      placeholder="https://www.figma.com/design/frame_id/..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFigmaModalOpen(false)}
                      className="flex-1 px-3 text-sm font-sans py-1 text-[#8C8C8C] rounded-lg hover:bg-[#2a2a2b] font-sans font-medium text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={importFigmaImage}
                      disabled={figmaLoading || !figmaUrl.trim()}
                      className={`flex-1 px-3 py-1  text-sm font-sans rounded-lg font-sans font-medium text-sm transition-all duration-300 ${
                        figmaLoading || !figmaUrl.trim()
                          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] text-white hover:from-[#5ba0f2] hover:to-[#6bb3f7] shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {figmaLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Importing...
                        </div>
                      ) : (
                        "Import Design"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero and Input Section */}
      <section className="w-full max-w-3xl mx-auto mt-[6%] justify-center items-center flex flex-col">
        {/* Introduce  */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={agentIntroVariants}
          className="relative text-white rounded-3xl px-2 p-1 flex max-md:mt-[10%] justify-center items-center gap-x-1 border border-[#2a2a2b] bg-stone-50/10 backdrop-blur-3xl overflow-hidden mb-2"
        >
          <CiMobile1 className="text-lg text-[#4F92E1]" />
          <span
            className="relative text-xs sm:text-sm inline-block bg-gradient-to-r from-transparent via-white to-transparent bg-clip-text text-transparent animate-shimmer"
            style={{
              backgroundSize: "200% 100%",
              backgroundImage:
                "linear-gradient(90deg, rgba(192,192,192,0.7) 0%, rgba(255,255,255,1) 50%, rgba(192,192,192,0.7) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            <span>Introducing Mobile apps with Superblocks. </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setLandingPreview("mobile");
              setPreviewDropdownOpen(false);
            }}
            className="ml-1 cursor-pointer bg-white text-[#000] text-xs sm:text-sm font-sans px-2 py-1 rounded-xl"
          >
            Give it a shot!
          </button>
        </motion.div>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={mainContentVariants}
          className="text-center space-y-5 mt-5 mb-8"
        >
          <h1 className="text-xl  sm:text-6xl text-balance font-bold text-white tracking-tight leading-tight">
            What would you like to build?
          </h1>
          <p className="text-sm sm:text-lg text-[#b1b1b1] font-medium max-w-2xl mx-auto">
            {subHeadline}
          </p>
        </motion.div>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={inputBoxVariants}
          className="w-full space-y-4 max-md:px-4"
        >
          {needsUpgrade === true && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="justify-center items-center flex text-center p-2 rounded-lg bg-[#1c1c1d] backdrop-blur-sm shadow-lg my-1"
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-sans font-medium text-white">
                You&rsquo;ve reached your prompt limit. Upgrade to Scale for 100 messages.
              </div>
            </motion.div>
          )}
          {/*  TEXT INPUT (FIRST) */}
          <div className="bg-[#141415] relative rounded-xl p-4 flex flex-col items-start justify-center shadow-lg sm:min-h-[150px] md:min-h-[250px] max-h-[250px] w-full">
            <BorderBeam
              duration={6}
              delay={3}
              size={400}
              borderWidth={2}
              className="from-transparent via-blue-500 to-transparent"
            />
            {/* Attachment Preview */}
            <AttachmentPreview
              attachments={attachments as AttachmentType[]}
              onRemove={handleRemoveAttachment}
            />

            <textarea
              maxLength={10000}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-white outline-none text-sm resize-none w-full min-h-[100px] max-h-[250px] overflow-hidden scrollbar-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              disabled={loading || isListening}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();

                  if (needsUpgrade) {
                    dispatch(setPricingModalOpen(true));
                  } else {
                    if (input.trim() && !loading) {
                      handleGenerate();
                    }
                  }
                }
              }}
            />

            {/* Action Buttons */}
            <div className="justify-between items-center flex w-full">
              <div className="flex items-center gap-2">
                <button
                  disabled={
                    loading ||
                    (needsUpgrade as boolean)
                  }
                  onClick={handleAttachClick}
                  className="cursor-pointer p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center transition-colors text-[#b1b1b1] hover:bg-[#2a292c]"
                  title="Attach image"
                >
                  <FaPaperclip />
                </button>
                <button
                  disabled={
                    loading ||
                    (needsUpgrade as boolean)
                  }
                  onClick={handleFigmaImport}
                  className="cursor-pointer p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center transition-colors text-[#b1b1b1] hover:bg-[#2a292c]"
                  title="Attach image"
                >
                  <CgFigma />
                  <div className="hidden md:block">Import from Figma</div>
                </button>

                {/* Model Dropdown */}
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    disabled={loading}
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="cursor-pointer text-[#71717A] hover:text-[#b1b1b1] hover:bg-[#1c1c1d] px-3 py-1.5 rounded-full text-xs font-sans font-medium gap-x-1 flex justify-center items-center hover:text-white transition-colors min-w-[70px]"
                  >
                    <span className="truncate">
                      {modelOptions.find(
                        (option) => option.name === selectedModel
                      )?.display || selectedModel}
                    </span>
                    <FaChevronDown
                      className={`transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {modelDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 w-48 bg-[#2a292c]  rounded-md shadow-xl max-h-60 overflow-y-auto"
                      style={{ zIndex: 99999 }}
                    >
                      {modelOptions.map((model) => (
                        <button
                          key={model.name}
                          onClick={() => {
                            setSelectedModel(model.name);
                            setModelDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-sans font-medium transition-colors hover:bg-[#1a1a1b] ${
                            selectedModel === model.name
                              ? "text-white bg-[#1c1c1d]"
                              : "text-[#71717A]"
                          }`}
                        >
                          {model.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Landing Preview Dropdown */}
                <div className="relative" ref={previewDropdownRef}>
                  <button
                    disabled={loading}
                    onClick={() => setPreviewDropdownOpen(!previewDropdownOpen)}
                    className="cursor-pointer text-[#71717A] hover:text-[#b1b1b1] hover:bg-[#1c1c1d] px-3 py-1.5 rounded-full text-xs font-sans font-medium gap-x-1 flex justify-center items-center hover:text-white transition-colors min-w-[70px]"
                  >
                    {landingPreview === "web" ? (
                      <CiLaptop className="text-sm" />
                    ) : (
                      <CiMobile1 className="text-sm" />
                    )}
                    <span className="truncate">
                      {landingPreviewOptions.find(
                        (option) => option.name === landingPreview
                      )?.display || "Web"}
                    </span>
                    <FaChevronDown
                      className={`transition-transform duration-200 ${previewDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {previewDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 w-32 bg-[#2a292c] rounded-md shadow-xl max-h-60 overflow-y-auto"
                      style={{ zIndex: 99999 }}
                    >
                      {landingPreviewOptions.map((option) => (
                        <button
                          key={option.name}
                          onClick={() => {
                            setLandingPreview(option.name);
                            setPreviewDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-sans font-medium transition-colors hover:bg-[#1a1a1b] flex items-center gap-2 ${
                            landingPreview === option.name
                              ? "text-white bg-[#1c1c1d]"
                              : "text-[#71717A]"
                          }`}
                        >
                          {option.icon}
                          {option.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center gap-2">
                {/* Voice Waves */}
                <VoiceWaves isListening={isListening} />
                {/* Microphone Button */}
                {speechSupported && (
                  <button
                    disabled={loading || (needsUpgrade as boolean)}
                    onClick={isListening ? stopListening : startListening}
                    className={`cursor-pointer p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center transition-colors ${
                      isListening
                        ? "text-blue-400 bg-blue-900/20 hover:bg-blue-900/30 animate-pulse"
                        : "text-[#71717A]  hover:bg-[#2a292c]"
                    }`}
                    title={isListening ? "Stop recording" : "Start voice input"}
                  >
                    {isListening ? <FaStop /> : <FaMicrophone />}
                  </button>
                )}

                {needsUpgrade === true ? (
                  <button
                    disabled={loading}
                    onClick={() => {
                      dispatch(setPricingModalOpen(true));
                    }}
                    className="justify-center items-center flex font-sans py-1 gap-x-1 font-medium text-white bg-[#4F92E1] rounded-md hover:bg-[##4F92E3] text-xs border border-[#6A65F2] cursor-pointer px-2 p-1"
                  >
                    Upgrade to Scale
                  </button>
                ) : needsUpgrade === false ? (
                  <button
                    disabled={loading}
                    onClick={handleGenerate}
                    className="cursor-pointer hover:bg-gray-200 text-[#71717A] bg-white p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center"
                  >
                    {loading ? (
                      <LuLoaderCircle className="animate-spin" />
                    ) : (
                      <FaArrowRight />
                    )}
                  </button>
                ) : (
                  <button
                    disabled={loading}
                    className="cursor-pointer hover:bg-gray-200 text-[#71717A] bg-white p-2 rounded-md text-xs font-sans font-medium gap-x-1 flex justify-center items-center"
                  >
                    <LuLoaderCircle className="animate-spin" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Starting Points */}
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#4a90e2] font-semibold">
                  Starting Points
                </p>
                <p className="text-[11px] text-[#8b8b90]">
                  {startingPointsHint}
                </p>
              </div>
              {selectedStartingPoint && (
                <button
                  type="button"
                  onClick={() => setSelectedStartingPoint(null)}
                  className="text-[11px] text-[#9b9ba3] hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeStartingPoints.map((startingPoint) => {
                const isActive = selectedStartingPoint?.id === startingPoint.id;
                return (
                  <button
                    key={startingPoint.id}
                    type="button"
                    onClick={() => {
                      setSelectedStartingPoint(startingPoint);
                      setInput(startingPoint.prompt);
                    }}
                    className={`text-left rounded-xl border px-4 py-3 transition-all ${
                      isActive
                        ? "border-[#4a90e2] bg-[#182233] text-white shadow-[0_0_0_1px_rgba(74,144,226,0.4)]"
                        : "border-[#2a2a2b] bg-[#141415] text-[#c5c5cb] hover:border-[#3b3b3c]"
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">
                      {startingPoint.label}
                    </div>
                    <div className="text-[11px] text-[#9b9ba3] mt-1">
                      {startingPoint.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </motion.div>
      </section>

      {/* Arrow */}
      <section className="justify-center items-end flex w-full h-[10vh]">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={inputBoxVariants}
          className="w-full space-y-4 flex justify-center items-end"
        >
          <IoIosArrowDown className="text-[#6c6c6f] animate-bounce" />
        </motion.div>
      </section>

      {/* From the community */}
      {/* <section
        id="community"
        className="justify-center items-center max-md:px-4 flex flex-col w-full max-w-5xl mx-auto min-h-screen"
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={mainContentVariants}
          className="w-full"
        >
          <div className="items-start justify-start w-full flex-col flex mb-8">
            <div className="text-white font-semibold text-md font-sans mb-2">
              From the Community
            </div>

            <div className="text-[#5d5d5d] font-medium text-sm font-sans">
              See what the community has built with Superblocks
            </div>
          </div>

          {!loadingProjects ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 bg-[#1c1c1d] p-1 rounded-lg">
                {projects.map((project, index) => (
                  <CommunityCard key={index} data={project} index={index} />
                ))}
              </div>
              <div className="justify-end flex items-center">
                <button
                  onClick={() => {
                    router.push("/community");
                  }}
                  className="cursor-pointer hover:text-white text-[#5d5d5d] text-xs font-sans font-medium flex justify-center items-center space-x-2"
                >
                  Browse more
                  <MdOutlineKeyboardArrowRight className="text-lg" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center">
              <LuLoaderCircle className="animate-spin" />
            </div>
          )}
        </motion.div>
      </section> */}

      {/* Pricing */}
      <section
        id="pricing"
        className="justify-center max-md:px-4  items-center flex flex-col w-full max-w-4xl mx-auto py-20"
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={mainContentVariants}
          className="w-full"
        >
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-[#b1b1b1] text-sm sm:text-base max-w-2xl mx-auto">
              Choose the plan that fits your needs. Start free, upgrade when
              you&apos;re ready to scale.
            </p>
          </div>

          <div className="flex justify-center items-center mx-auto">
            {/* Free Plan */}
            {/* <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-8 hover:border-[#3a3a3b] transition-all duration-300 relative"
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-white">Free</h3>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  $0
                  <span className="text-lg font-normal text-[#71717A]">
                    /month
                  </span>
                </div>
                <p className="text-[#b1b1b1] text-sm">
                  Perfect for getting started and exploring what&apos;s
                  possible.
                </p>
              </div>

              <button className="w-full bg-[#2a2a2b] text-white py-3 rounded-lg font-medium text-sm hover:bg-[#3a3a3b] transition-colors mb-6">
                Get Started Free
              </button>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-blue-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-white text-sm">
                    5 prompts per month
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-blue-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-white text-sm">Basic AI models</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-blue-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-white text-sm">Community support</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4 text-blue-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-white text-sm">Public projects</span>
                </div>
              </div>
            </motion.div> */}

            {/* Scale Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-[#141415] border border-[#4a90e2] rounded-xl p-8 hover:border-[#5ba0f2] transition-all duration-300 relative"
            >
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-[#4a90e2] text-white px-3 py-1 rounded-full text-xs font-medium">
                  Most Popular
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-5 h-5 text-[#4a90e2]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285 31.372 31.372 0 00-7.86 3.83.75.75 0 01-.84 0 31.508 31.508 0 00-2.08-1.287V9.394c0-.244.116-.463.302-.592a35.504 35.504 0 013.305-2.033.75.75 0 00-.714-1.319 37 37 0 00-3.446 2.12A2.216 2.216 0 006 9.393v.38a31.293 31.293 0 00-4.28-1.746.75.75 0 01-.254-1.285 41.059 41.059 0 018.198-5.424zM6 11.459a29.848 29.848 0 00-2.455-1.158 41.029 41.029 0 00-.39 3.114.75.75 0 00.419.74c.528.256 1.046.53 1.554.82-.21-.899-.455-1.746-.721-2.517zm.286 1.961a.75.75 0 01.848.06 28.424 28.424 0 014.132 3.624 28.731 28.731 0 01-2.993 1.454.75.75 0 01-.848-.06 28.424 28.424 0 01-4.132-3.624A28.731 28.731 0 016.286 13.42zm7.428-4.673A47.394 47.394 0 0117 6.394v3.114c-.855.31-1.82.602-2.286.77a.75.75 0 01-.848-.06 28.424 28.424 0 00-4.132-3.624A28.731 28.731 0 0113.714 8.747z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-white">Scale</h3>
                </div>
                <div className="text-3xl font-bold text-white mb-2">
                  $29
                  <span className="text-lg font-normal text-[#71717A]">
                    /month
                  </span>
                </div>
                <p className="text-[#b1b1b1] text-sm">
                  Expand your build capacity with 100 messages every billing cycle
                </p>
              </div>

              <button
                onClick={() => {
                  if (!isAuthenticated.value) {
                    router.push("/login");
                  } else {
                    dispatch(setPricingModalOpen(true));
                  }
                }}
                className="w-full cursor-pointer bg-white text-black py-3 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors mb-6"
              >
                Upgrade to Scale
              </button>

              <div className="mb-6">
                <p className="text-[#71717A] text-xs font-medium mb-4">
                  BENEFITS
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                  <span className="text-white text-sm">
                    100 messages / billing cycle
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                  <span className="text-white text-sm">
                    Priority customer support with faster response times
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                  <span className="text-white text-sm">
                    Every user starts on Free with 5 prompts
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                  <span className="text-white text-sm">
                    Manage billing directly in Stripe
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="justify-center items-center flex flex-col w-full max-w-4xl mx-auto py-20"
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={mainContentVariants}
          className="w-full"
        >
          <div className="text-center mb-12">
            <h1 className="relative z-1 text-lg md:text-4xl  bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-600  text-center font-sans font-semibold">
              Frequently Asked Questions
            </h1>
            <p className="text-[#b1b1b1] text-sm sm:text-base text-balance sm:max-w-2xl mx-auto">
              Everything you need to know about building your applications with
              Superblocks
            </p>
          </div>

          <div className="space-y-4 justify-center items-center flex flex-col">
            {faqData.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                index={index}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <section>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={footerVariants}
          className="flex justify-center items-end w-full flex-col"
        >
          {/* Line */}
          <div className="w-full justify-center items-center flex flex-col">
            <div className="pt-5 border-t border-[#1c1c1d] w-full max-w-3xl self-center snap-center object-center" />

            {/* Rights and Social Icons */}
            <div className="w-full max-w-3xl self-center flex justify-center items-center pb-4">
              <span className="text-[#71717A] text-sm">
                © {new Date().getFullYear()} Superblocks. All rights reserved.
              </span>
            </div>
          </div>

          <div className="text-center w-full pt-25">
            <MorphingText
              texts={["Superblocks", "Vibe coding platform"]}
              className="text-6xl w-full sm:text-8xl lg:text-9xl font-[insSerifIt] text-white"
            />
          </div>
        </motion.div>
      </section>
    </main>
  );
};

export default Hero;

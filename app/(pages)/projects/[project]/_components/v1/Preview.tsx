"use client";
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { AnimatePresence, motion, Variants } from "framer-motion"; // For loading animation
import { readFile as wcReadFile } from "@/app/helpers/webcontainer";
import { LuLoaderCircle } from "react-icons/lu";
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatUnderlined,
  MdStrikethroughS,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatClear,
  MdOutlineAdd,
  MdOutlineSave,
  MdOutlineLink,
  MdOutlineLayers,
} from "react-icons/md";
import { TiPen, TiFlashOutline } from "react-icons/ti";
import { SiModal } from "react-icons/si";
import { GoCodeOfConduct } from "react-icons/go";
import { CiViewTimeline } from "react-icons/ci";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import {
  setGenerating,
  refreshPreview,
  setInspectorMode,
  setEditMode,
  setPendingAttachment,
  setSelectedBlock as setSelectedBlockAction,
} from "@/app/redux/reducers/projectOptions";
import { createStreamableRequest } from "@/app/helpers/useSendRequest";
import { usePathname } from "next/navigation";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { updateSpecificFile } from "@/app/redux/reducers/projectFiles";
import { API } from "@/app/config/publicEnv";
import TiptapEditor from "./Editor/TiptapEditor";
import {
  createBasicPageHtml as createBasicPageTemplate,
  ensureUniquePagePath as ensureUniquePagePathHelper,
  normalizePagePath as normalizePagePathHelper,
} from "@/app/helpers/sitePages";
import { isCodeProjectData } from "@/app/helpers/projectKind";

type TemplateBlock = {
  id: string;
  name: string;
  description: string;
  html: string;
};

type SitePage = {
  path: string;
  title?: string;
};

type OrphanedLink = {
  from: string;
  to: string;
  href: string;
};

type SiteGraph = {
  pages: SitePage[];
  links: OrphanedLink[];
  orphanedLinks: OrphanedLink[];
  orphanedPages: string[];
  embeds: { head: string[]; body: string[] };
  forms: { id: string; name?: string; page?: string }[];
  startingPoint?: string | null;
  pageRoot?: string;
};

type SelectedBlock = {
  id: string;
  html: string;
  selector?: string;
  page?: string;
};

// Loading animation items
const items = [
  {
    text: "Setting up your development environment",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Installing dependencies and packages",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Building your application components",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
  {
    text: "Preparing your live preview",
    icon: (
      <div className="w-6 h-6 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center">
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    ),
  },
];

const TEMPLATE_BLOCKS: TemplateBlock[] = [
  {
    id: "hero-simple",
    name: "Hero section",
    description: "Large heading, subheading and primary button.",
    html: `
      <section data-sb-block-id="hero-simple" style="padding: 72px 24px; max-width: 960px; margin: 0 auto; text-align: left; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">
        <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #4a90e2; font-weight: 600; margin: 0 0 12px 0;">
          NEW TEMPLATE BLOCK
        </p>
        <h1 style="font-size: 40px; line-height: 1.1; letter-spacing: -0.03em; color: #ffffff; margin: 0 0 16px 0;">
          Drop-in hero to start your page fast.
        </h1>
        <p style="font-size: 16px; line-height: 1.6; color: #a0a0a8; max-width: 520px; margin: 0 0 28px 0;">
          This section is fully editable. Change the copy, tweak the button label, or remove it entirely from the live preview.
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          <a href="#"
            style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 999px; background: linear-gradient(135deg, #4a90e2, #5ba0f2); color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; box-shadow: 0 12px 30px rgba(74, 144, 226, 0.35);">
            Primary action
          </a>
          <a href="#"
            style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 999px; background: rgba(20,20,21,0.9); color: #e0e0e6; font-size: 14px; font-weight: 500; text-decoration: none; border: 1px solid #2a2a2b;">
            Secondary link
          </a>
        </div>
      </section>
    `,
  },
  {
    id: "feature-grid",
    name: "3-column features",
    description: "Three feature cards with title and description.",
    html: `
      <section data-sb-block-id="feature-grid" style="padding: 56px 24px; max-width: 1040px; margin: 0 auto; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">
        <div style="text-align: left; margin-bottom: 28px;">
          <h2 style="font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; color: #ffffff; margin: 0 0 10px 0;">
            Explain what makes this page special.
          </h2>
          <p style="font-size: 15px; line-height: 1.6; color: #a0a0a8; max-width: 520px; margin: 0;">
            Each card below is editable. Use them for features, benefits, or anything else you want to highlight.
          </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px;">
          <article style="border-radius: 14px; padding: 18px 18px 20px; border: 1px solid #2a2a2b; background: radial-gradient(circle at top left, rgba(74,144,226,0.18), transparent 55%), #141415;">
            <h3 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">First feature title</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #b0b0b6; margin: 0;">
              Short, scannable copy that you can replace with your own benefit or feature explanation.
            </p>
          </article>
          <article style="border-radius: 14px; padding: 18px 18px 20px; border: 1px solid #2a2a2b; background: radial-gradient(circle at top left, rgba(74,144,226,0.18), transparent 55%), #141415;">
            <h3 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Second feature title</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #b0b0b6; margin: 0;">
              Use this card for another concise point that supports your main message.
            </p>
          </article>
          <article style="border-radius: 14px; padding: 18px 18px 20px; border: 1px solid #2a2a2b; background: radial-gradient(circle at top left, rgba(74,144,226,0.18), transparent 55%), #141415;">
            <h3 style="font-size: 16px; font-weight: 600; color: #ffffff; margin: 0 0 8px 0;">Third feature title</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #b0b0b6; margin: 0;">
              Keep it clear and focused so visitors can understand it at a glance.
            </p>
          </article>
        </div>
      </section>
    `,
  },
  {
    id: "cta-banner",
    name: "Call-to-action strip",
    description: "Full-width CTA with supporting copy.",
    html: `
      <section data-sb-block-id="cta-banner" style="margin: 40px 0 0; padding: 20px 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">
        <div style="border-radius: 16px; border: 1px solid #2a2a2b; background: linear-gradient(135deg, rgba(74,144,226,0.16), rgba(20,20,21,0.96)); padding: 18px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; justify-content: space-between;">
          <div style="flex: 1 1 auto; min-width: 0;">
            <p style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #c5d8ff; font-weight: 600; margin: 0 0 8px 0;">
              READY TO LAUNCH
            </p>
            <h3 style="font-size: 18px; color: #ffffff; margin: 0 0 6px 0;">
              Turn this page into something your visitors want to act on.
            </h3>
            <p style="font-size: 14px; color: #dde0ff; opacity: 0.8; margin: 0;">
              Update the text here to describe your primary next step: booking, signup, or a simple contact.
            </p>
          </div>
          <div style="flex: 0 0 auto; display: flex; gap: 8px;">
            <a href="#"
              style="display: inline-flex; align-items: center; justify-content: center; padding: 9px 16px; border-radius: 999px; background: #ffffff; color: #111118; font-size: 13px; font-weight: 600; text-decoration: none;">
              Primary CTA
            </a>
            <a href="#"
              style="display: inline-flex; align-items: center; justify-content: center; padding: 9px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); color: #f5f5ff; font-size: 13px; font-weight: 500; text-decoration: none; background: rgba(0,0,0,0.25);">
              Secondary
            </a>
          </div>
        </div>
      </section>
    `,
  },
];

const Preview = () => {
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [loadError, setLoadError] = useState(false);
  const [index, setIndex] = useState(0);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [templateBlocks, setTemplateBlocks] = useState<TemplateBlock[]>(TEMPLATE_BLOCKS);
  const [siteGraph, setSiteGraph] = useState<SiteGraph | null>(null);
  const [currentPage, setCurrentPage] = useState<string>("index.html");
  const [pageInput, setPageInput] = useState<string>("");
  const [sitePanelOpen, setSitePanelOpen] = useState(false);
  const [embedPanelOpen, setEmbedPanelOpen] = useState(false);
  const [embedHead, setEmbedHead] = useState("");
  const [embedBody, setEmbedBody] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlock | null>(null);
  const [blockEditorContent, setBlockEditorContent] = useState("");

  const { email } = useAuthenticated();
  const dispatch = useDispatch();
  const { refreshCounter, responsive, inspectorMode, editMode, showTemplateBlocks, selectedBlock: selectedBlockFromStore, previewUrl } = useSelector((state: RootState) => state.projectOptions);
  const { files: projectFiles, currentFile, data: projectData, fetchedData: fetchedProjectData } = useSelector(
    (state: RootState) => state.projectFiles
  );

  const path = usePathname();
  const projectId = useMemo(() => {
    const segments = path.split("/");
    return segments[segments.length - 1] || segments[2] || "";
  }, [path]);

  const sendStreamableRequest = useMemo(() => createStreamableRequest(dispatch), [dispatch]);

  const normalizePagePath = useCallback(
    (value?: string) => normalizePagePathHelper(value, siteGraph || undefined),
    [siteGraph]
  );

  const ensureUniquePagePath = useCallback(
    (path: string) => ensureUniquePagePathHelper(path, siteGraph?.pages || []),
    [siteGraph]
  );

  const previewSrc = useMemo(() => {
    if (!previewUrl) return "";
    const base = previewUrl.replace(/\/$/, "");
    const pagePath = normalizePagePath(currentPage);
    return `${base}/${pagePath}`;
  }, [previewUrl, currentPage, normalizePagePath]);

  const splitEmbeds = useCallback((value: string) => {
    return (value || "")
      .split(/(?:<!--\s*sb:embed\s*-->|\n{2,})/gi)
      .map((snippet) => snippet.trim())
      .filter(Boolean);
  }, []);

  const getEmbedState = useCallback(() => {
    return {
      head: splitEmbeds(embedHead || ""),
      body: splitEmbeds(embedBody || ""),
    };
  }, [embedHead, embedBody, splitEmbeds]);

  const validateEmbed = useCallback(
    (value: string, slot: "head" | "body") => {
      const trimmed = (value || "").trim();
      if (!trimmed) {
        return { status: "empty", message: "No snippet provided yet." };
      }

      const lower = trimmed.toLowerCase();
      const hasScript = /<script[\s>]/i.test(trimmed);
      const hasLinkOrStyle = /<link[\s>]|<style[\s>]/i.test(trimmed);
      const hasHtmlTag = /<html[\s>]|<body[\s>]|<head[\s>]/i.test(trimmed);
      const hasDocumentWrite = /document\.write/i.test(trimmed);

      if (hasHtmlTag) {
        return {
          status: "error",
          message: "Remove <html>, <head>, or <body> tags. Paste only the snippet.",
        };
      }

      if (!hasScript && !hasLinkOrStyle) {
        return {
          status: "warning",
          message:
            slot === "head"
              ? "No <script>, <link>, or <style> tag detected."
              : "No <script> tag detected.",
        };
      }

      if (hasDocumentWrite) {
        return {
          status: "warning",
          message: "Snippet uses document.write which can break rendering.",
        };
      }

      return { status: "ok", message: "Snippet looks valid." };
    },
    []
  );

  const headValidation = useMemo(
    () => validateEmbed(embedHead, "head"),
    [embedHead, validateEmbed]
  );
  const bodyValidation = useMemo(
    () => validateEmbed(embedBody, "body"),
    [embedBody, validateEmbed]
  );
  const hasEmbedError = useMemo(
    () => headValidation.status === "error" || bodyValidation.status === "error",
    [headValidation.status, bodyValidation.status]
  );

  const applyEmbedsToHtml = useCallback(
    (html: string) => {
      if (!html) return html;
      const embeds = getEmbedState();

      const inject = (source: string, slot: "head" | "body") => {
        const start = `<!-- sb:${slot}-start -->`;
        const end = `<!-- sb:${slot}-end -->`;
        const block = `${start}\n${(embeds[slot] || []).join("\n")}\n${end}`;
        const regex = new RegExp(`${start}[\\s\\S]*?${end}`, "i");
        if (regex.test(source)) {
          return source.replace(regex, block);
        }
        if (slot === "head" && source.includes("</head>")) {
          return source.replace("</head>", `${block}\n</head>`);
        }
        if (slot === "body" && source.includes("</body>")) {
          return source.replace("</body>", `${block}\n</body>`);
        }
        return source;
      };

      let updated = inject(html, "head");
      updated = inject(updated, "body");
      return updated;
    },
    [getEmbedState]
  );

  const extractInnerHtml = useCallback((html: string) => {
    try {
      const temp = document.createElement("div");
      temp.innerHTML = html.trim();
      const el = temp.firstElementChild;
      return el ? el.innerHTML : html;
    } catch {
      return html;
    }
  }, []);

  const mergeBlockHtml = useCallback(
    (outerHtml: string, innerHtml: string, blockId: string) => {
      try {
        const temp = document.createElement("div");
        temp.innerHTML = outerHtml.trim();
        const el = temp.firstElementChild;
        if (!el) return outerHtml;
        el.innerHTML = innerHtml;
        if (blockId && !el.getAttribute("data-sb-block-id")) {
          el.setAttribute("data-sb-block-id", blockId);
        }
        return el.outerHTML;
      } catch {
        return outerHtml;
      }
    },
    []
  );

  const createBasicPageHtml = useCallback(
    (title: string, slug: string) => {
      const html = createBasicPageTemplate({
        title,
        slug,
        embeds: getEmbedState(),
      });
      return applyEmbedsToHtml(html);
    },
    [applyEmbedsToHtml, getEmbedState]
  );

  const projectDataForKind = fetchedProjectData || projectData;
  const isCodeProject = useMemo(
    () => isCodeProjectData(projectDataForKind),
    [projectDataForKind]
  );

  const fetchSiteGraph = useCallback(async () => {
    if (!API || !email.value || !projectId) return;
    try {
      const response = await fetch(`${API}/site-graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email: email.value }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.success) return;
      setSiteGraph({
        pages: data.pages || [],
        links: data.links || [],
        orphanedLinks: data.orphanedLinks || [],
        orphanedPages: data.orphanedPages || [],
        embeds: data.embeds || { head: [], body: [] },
        forms: data.forms || [],
        startingPoint: data.startingPoint || null,
        pageRoot: data.pageRoot || "",
      });
      setEmbedHead((data.embeds?.head || []).join("\n\n"));
      setEmbedBody((data.embeds?.body || []).join("\n\n"));
    } catch (error) {
      console.warn("[Preview] Failed to fetch site graph:", error);
    }
  }, [API, email.value, projectId]);

  const handleClearBlockSelection = useCallback(() => {
    setSelectedBlock(null);
    setBlockEditorContent("");
    dispatch(setSelectedBlockAction(null));
    iframeRef.current?.contentWindow?.postMessage(
      { type: "WYSIWYG_CLEAR_BLOCK" },
      "*"
    );
  }, [dispatch]);

  // Handle refresh counter - with debounce to prevent rapid reloads
  useEffect(() => {
    // Debounce iframe reload to prevent conflicts with WebContainer initialization
    const timeoutId = setTimeout(() => {
      setIframeKey(Date.now());
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [refreshCounter]);

  useEffect(() => {
    if (isCodeProject) {
      setSiteGraph(null);
      setEmbedHead("");
      setEmbedBody("");
      setCurrentPage("index.html");
      setPageInput("index.html");
      return;
    }
    fetchSiteGraph();
  }, [fetchSiteGraph, refreshCounter, isCodeProject]);

  useEffect(() => {
    const loadTemplateBlocks = async () => {
      try {
        const response = await fetch("/components/block-manifest.json");
        if (!response.ok) return;
        const data = await response.json();
        const blocks = Array.isArray(data) ? data : data?.blocks || [];
        const normalized = blocks
          .map((block: any) => ({
            id: block.id || block.name || "block",
            name: block.name || block.label || block.id || "Block",
            description: block.description || "",
            html: block.html || block.content || "",
          }))
          .filter((block: TemplateBlock) => block.html);

        if (normalized.length > 0) {
          setTemplateBlocks(normalized);
        }
      } catch (error) {
        console.warn("[Preview] Failed to load block manifest:", error);
      }
    };

    loadTemplateBlocks();
  }, []);

  useEffect(() => {
    if (!siteGraph || !siteGraph.pages || siteGraph.pages.length === 0) {
      return;
    }

    const normalizedCurrent = normalizePagePath(currentPage);
    const exists = siteGraph.pages.some((page) => page.path === normalizedCurrent);

    if (!exists) {
      const home =
        siteGraph.pages.find((p) => p.path.endsWith("index.html")) ||
        siteGraph.pages[0];
      if (home?.path) {
        setCurrentPage(home.path);
        setPageInput(home.path);
      }
    } else if (!pageInput) {
      setPageInput(normalizedCurrent);
    }
  }, [siteGraph, normalizePagePath, currentPage, pageInput]);

  useEffect(() => {
    if (currentPage) {
      setIframeKey(Date.now());
    }
  }, [currentPage]);

  // Update window width on resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Item rotation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % items.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Sync mode to iframe
  useEffect(() => {
    const sendMessagesToIframe = () => {
      if (iframeRef.current?.contentWindow && previewUrl) {
        try {
          const inspectorMsg = inspectorMode ? "ENABLE_INSPECTOR" : "DISABLE_INSPECTOR";
          iframeRef.current.contentWindow.postMessage({ 
            type: "SUPERBLOCKS_INSPECTOR", 
            msg: inspectorMsg 
          }, "*");
          iframeRef.current.contentWindow.postMessage({ 
            type: "WYSIWYG_EDIT_MODE", 
            enabled: editMode 
          }, "*");
        } catch (error) {
          console.warn('[Preview] Error sending messages to iframe:', error);
        }
      }
    };

    // Send immediately if iframe is ready
    sendMessagesToIframe();

    // Also retry after a short delay in case iframe is still loading
    const timeoutId = setTimeout(() => {
      sendMessagesToIframe();
    }, 100);

    if (!inspectorMode && !editMode) {
      return () => clearTimeout(timeoutId);
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (inspectorMode) dispatch(setInspectorMode(false));
        if (editMode) dispatch(setEditMode(false));
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [inspectorMode, editMode, dispatch, previewUrl]);

  useEffect(() => {
    if (!editMode && selectedBlock) {
      handleClearBlockSelection();
    }
  }, [editMode, selectedBlock, handleClearBlockSelection]);

  useEffect(() => {
    if (!selectedBlockFromStore) {
      setSelectedBlock(null);
      setBlockEditorContent("");
      return;
    }

    if (!selectedBlock || selectedBlock.id !== selectedBlockFromStore.id) {
      setSelectedBlock(selectedBlockFromStore);
      setBlockEditorContent(extractInnerHtml(selectedBlockFromStore.html));
    }
  }, [selectedBlockFromStore, selectedBlock, extractInnerHtml]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { type, payload } = event.data;

      // 1. INSPECTOR LOGIC
      if (type === "SUPERBLOCKS_INSPECTOR" && event.data.msg === "ELEMENT_CLICKED") {
        const { filePath, startLine, endLine, code } = event.data;
        if (filePath && startLine) {
          dispatch(setPendingAttachment({
            fileName: filePath,
            lineNumber: startLine,
            endLine: endLine || undefined,
            elementName: "element",
            code: code,
          }));
        }
      }

      if (type === "WYSIWYG_BLOCK_SELECTED") {
        const { blockId, html, selector, page } = payload || {};
        if (blockId && html) {
          const nextBlock = { id: blockId, html, selector, page };
          setSelectedBlock(nextBlock);
          setBlockEditorContent(extractInnerHtml(html));
          dispatch(setSelectedBlockAction(nextBlock));
        }
      }

      if (type === "SB_FORM_SUBMIT") {
        const { formId, formName, page, fields } = payload || {};
        if (formId && API) {
          fetch(`${API}/forms/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              email: email.value,
              formId,
              formName,
              page,
              fields,
            }),
          }).catch((err) => console.warn("[Preview] Form submit failed", err));
        }
      }

      // 2. WYSIWYG LOGIC
      if (type === "WYSIWYG_CHANGE") {
        const { type: editType, element } = payload;
        if (!element) return;

        const isBlock = editType === 'BLOCK_INSERT';
        const isImage = editType === 'IMAGE_SWAP';
        const isPageSave = editType === 'PAGE_SAVE';
        const isTextEdit = editType === 'TEXT_EDIT';

        // Get the full HTML from the message
        const fullHTML = element.fullHtml || element.html || '';
        
        if (!fullHTML) {
          // Request HTML from iframe if not provided
          iframeRef.current?.contentWindow?.postMessage({ 
            type: 'WYSIWYG_REQUEST_HTML' 
          }, '*');
          return;
        }
        
        // Debug: Log if HTML contains formatting (for troubleshooting)
        if (isPageSave) {
          const hasFormatting = fullHTML.includes('<i>') || fullHTML.includes('<em>') || fullHTML.includes('<strong>') || fullHTML.includes('<b>') || fullHTML.includes('style=');
          console.log(`📝 [Preview] Saving HTML - Contains formatting: ${hasFormatting}, Length: ${fullHTML.length}`);
          if (hasFormatting) {
            const italicCount = (fullHTML.match(/<i>|<em>/g) || []).length;
            const boldCount = (fullHTML.match(/<strong>|<b>/g) || []).length;
            const styleCount = (fullHTML.match(/style="/g) || []).length;
            console.log(`📝 [Preview] Formatting found - Italic: ${italicCount}, Bold: ${boldCount}, Styles: ${styleCount}`);
          }
        }

        // ONLY save when Save button is explicitly clicked (PAGE_SAVE)
        // Other edits (TEXT_EDIT, BLOCK_INSERT, IMAGE_SWAP) are just tracked locally in the iframe
        // until the user clicks Save
        if (isPageSave) {
          // Use IIFE to handle async operations
          (async () => {
            try {
              const resolvedPagePath = normalizePagePath(currentPage || pageInput);
              const filePath = `/${resolvedPagePath}`;
              const webContainerPath = resolvedPagePath;
              const htmlToSave = applyEmbedsToHtml(fullHTML);
              
              // MATCH CODEEDITOR PATTERN: Save to backend FIRST (like CodeEditor does)
              // This ensures persistence across page refreshes
              if (API && email.value) {
                try {
                  const response = await fetch(`${API}/updatefiles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      content: htmlToSave,
                      filePath: filePath,
                      currentFile: JSON.stringify({ name: resolvedPagePath.split("/").pop(), path: filePath }),
                      projectFiles: JSON.stringify(projectFiles || {}),
                      projectId, 
                      email: email.value
                    }),
                  });
                  
                  if (response.ok) {
                    const result = await response.json();
                    console.log(`✅ [Preview] Saved to backend: ${filePath}`, result);
                    
                    dispatch(updateSpecificFile({ filePath: webContainerPath, content: htmlToSave, createDirectories: true }));
                    
                    // DON'T auto-refresh immediately - let AI update React files first
                    // User can manually refresh after AI completes, or we refresh after longer delay
                    // This prevents losing formatting that AI is still processing
                    setTimeout(() => {
                      dispatch(refreshPreview());
                      console.log(`🔄 [Preview] Refreshed preview (AI should have updated React files by now)`);
                      fetchSiteGraph();
                    }, 5000); // Longer delay to give AI time to update React source files
                  } else {
                    const errorText = await response.text();
                    console.warn('Backend save failed:', errorText);
                    dispatch(updateSpecificFile({ filePath: webContainerPath, content: htmlToSave, createDirectories: true }));
                  }
                } catch (err) {
                  console.warn('Backend save failed:', err);
                  dispatch(updateSpecificFile({ filePath: webContainerPath, content: htmlToSave, createDirectories: true }));
                }

                // CRITICAL: Trigger AI to update React source files with ALL formatting preserved
                // Check if HTML contains formatting tags to emphasize their importance
                const hasItalic = htmlToSave.includes('<i>') || htmlToSave.includes('<em>') || htmlToSave.includes('font-style:italic') || htmlToSave.includes('font-style: italic');
                const hasBold = htmlToSave.includes('<strong>') || htmlToSave.includes('<b>') || htmlToSave.includes('font-weight:bold') || htmlToSave.includes('font-weight: bold');
                const hasColors = htmlToSave.includes('style=') && (htmlToSave.includes('color:') || htmlToSave.includes('background-color:'));
                
                const formattingNotes = [];
                if (hasItalic) formattingNotes.push('HTML contains ITALIC formatting (<i>, <em>, or font-style:italic) - MUST preserve in React');
                if (hasBold) formattingNotes.push('HTML contains BOLD formatting (<strong>, <b>, or font-weight) - MUST preserve in React');
                if (hasColors) formattingNotes.push('HTML contains COLOR styles (style="color:..." or style="background-color:...") - MUST preserve in React');
                
                const formattingWarning = formattingNotes.length > 0 
                  ? `\n\n⚠️ CRITICAL: The HTML contains the following formatting that MUST be preserved:\n${formattingNotes.join('\n')}\n`
                  : '';
                
                const aiPrompt = `CRITICAL TASK: Update React source files to match WYSIWYG edits EXACTLY.

The user made visual edits (text formatting like italic/bold, colors, styles) in WYSIWYG mode and clicked Save.
You MUST update the React source code (App.jsx, index.jsx, or main component files) to render HTML that EXACTLY matches the provided HTML.

MANDATORY REQUIREMENTS:
1. PRESERVE ALL HTML FORMATTING TAGS: Keep <i>, <em>, <strong>, <b>, <u>, <s>, <span>, etc. exactly as shown
2. PRESERVE ALL INLINE STYLES: Keep ALL style="..." attributes exactly as shown (colors, fonts, spacing, etc.)
3. PRESERVE ALL CSS CLASSES: Keep all className attributes
4. CONVERT TO JSX PROPERLY: 
   - Use dangerouslySetInnerHTML={{__html: ...}} for complex HTML with formatting
   - OR convert <i> to <i>, <em> to <em>, <strong> to <strong>, etc. in JSX
   - Preserve style={{...}} objects with all CSS properties
5. MATCH EXACTLY: The rendered HTML must match the provided HTML character-by-character for formatting
${formattingWarning}
The full updated HTML with ALL formatting preserved:
${htmlToSave.substring(0, 25000)}

Update the React components NOW to preserve all formatting.`;

                sendStreamableRequest({
                  prompt: aiPrompt, 
                  images: [],
                  projectId, 
                  owner: email.value as string,
                  terminal: "", 
                  model: sessionStorage.getItem("model") || "claude-sonnet-4.5",
                  silent: false // Show AI is working so user knows it's updating
                });
                console.log(`🚀 [Preview] Triggered AI to update React source files - preserving formatting tags and styles`);
              } else {
                // No API/email - just save to state
                dispatch(updateSpecificFile({ filePath: webContainerPath, content: htmlToSave, createDirectories: true }));
              }

              // Send confirmation to iframe
              iframeRef.current?.contentWindow?.postMessage({ type: 'WYSIWYG_SAVED' }, '*');
              
            } catch (error) {
              console.error("❌ [Preview] Save error:", error);
            }
          })();
        }
        
        // For non-save edits (TEXT_EDIT, BLOCK_INSERT, IMAGE_SWAP), just log them
        // The iframe tracks these changes internally until Save is clicked
        if (!isPageSave) {
          console.log(`📝 [Preview] Edit tracked (not saved yet): ${editType}`);
        }
      }

      if (type === "WYSIWYG_SCRIPT_READY") {
        iframeRef.current?.contentWindow?.postMessage({ type: "WYSIWYG_EDIT_MODE", enabled: editMode }, "*");
      }

      // Handle HTML response from iframe (for cross-origin safety)
      if (type === "WYSIWYG_HTML_RESPONSE") {
        const { html } = event.data;
        if (html) {
          const resolvedPagePath = normalizePagePath(currentPage || pageInput);
          const filePath = resolvedPagePath;
          const htmlToSave = applyEmbedsToHtml(html);
          dispatch(updateSpecificFile({ filePath, content: htmlToSave, createDirectories: true }));
          console.log(`✅ [Preview] Saved HTML from iframe to ${filePath}`);

          if (API && email.value) {
            fetch(`${API}/updatefiles`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                projectId, 
                email: email.value, 
                filePath: `/${filePath}`, 
                content: htmlToSave, 
                currentFile: JSON.stringify({ name: filePath.split("/").pop(), path: `/${filePath}` }) 
              }),
            }).catch(err => console.warn('Backend save failed:', err));
          }
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    dispatch,
    projectId,
    email.value,
    editMode,
    previewUrl,
    sendStreamableRequest,
    currentPage,
    pageInput,
    applyEmbedsToHtml,
    normalizePagePath,
    fetchSiteGraph,
    extractInnerHtml,
  ]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBlock(false);
    const blockId = e.dataTransfer.getData("text/template-block-id") || e.dataTransfer.getData("text/plain");
    const block = templateBlocks.find(b => b.id === blockId);
    if (block && iframeRef.current?.contentWindow) {
      // Calculate drop Y position relative to iframe for visual placement
      const iframeRect = iframeRef.current.getBoundingClientRect();
      const dropY = e.clientY - iframeRect.top;
      
      iframeRef.current.contentWindow.postMessage({ 
        type: "WYSIWYG_INSERT_BLOCK", 
        payload: { 
          html: block.html, 
          position: "after",  // Use position relative to element at drop point
          dropY: dropY 
        } 
      }, "*");
    }
  }, [templateBlocks]);

  const handleCreatePage = useCallback(
    async (rawPath?: string) => {
      const target = normalizePagePath(
        rawPath || pageInput || `page-${Date.now().toString(36)}`
      );
      const safeTarget = ensureUniquePagePath(target);
      const slug = safeTarget.replace(/^pages\//, "").replace(/\.html$/, "");
      const title = slug
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const html = createBasicPageHtml(title, slug);
      if (!html || !html.trim()) {
        console.warn("[Preview] Basic page fallback is disabled.");
        return;
      }

      dispatch(updateSpecificFile({ filePath: safeTarget, content: html, createDirectories: true }));

      if (API && email.value) {
        try {
          await fetch(`${API}/updatefiles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              email: email.value,
              filePath: `/${safeTarget}`,
              content: html,
              currentFile: JSON.stringify({ name: safeTarget.split("/").pop(), path: `/${safeTarget}` }),
            }),
          });
        } catch (error) {
          console.warn("[Preview] Failed to save new page:", error);
        }
      }

      setCurrentPage(safeTarget);
      setPageInput(safeTarget);
      fetchSiteGraph();
    },
    [
      API,
      email.value,
      pageInput,
      projectId,
      normalizePagePath,
      ensureUniquePagePath,
      createBasicPageHtml,
      dispatch,
      fetchSiteGraph,
    ]
  );

  const handleSaveEmbeds = useCallback(async () => {
    const embeds = getEmbedState();
    const manifest = {
      version: 1,
      pageRoot: siteGraph?.pageRoot || "",
      pages: siteGraph?.pages || [],
      links: siteGraph?.links || [],
      orphanedLinks: siteGraph?.orphanedLinks || [],
      orphanedPages: siteGraph?.orphanedPages || [],
      blocks: [],
      forms: siteGraph?.forms || [],
      embeds,
      startingPoint: siteGraph?.startingPoint || null,
    };

    if (API && email.value) {
      try {
        await fetch(`${API}/updatefiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            email: email.value,
            filePath: "/site.manifest.json",
            content: JSON.stringify(manifest, null, 2),
            currentFile: JSON.stringify({
              name: "site.manifest.json",
              path: "/site.manifest.json",
            }),
          }),
        });
      } catch (error) {
        console.warn("[Preview] Failed to save embeds:", error);
      }
    }

    setSiteGraph((prev) =>
      prev
        ? {
            ...prev,
            embeds,
          }
        : prev
    );
    try {
      const resolvedPagePath = normalizePagePath(currentPage || pageInput);
      const html = await wcReadFile(resolvedPagePath) as string;
      const htmlToSave = applyEmbedsToHtml(html);
      dispatch(
        updateSpecificFile({
          filePath: resolvedPagePath,
          content: htmlToSave,
          createDirectories: true,
        })
      );
      setIframeKey(Date.now());
    } catch (error) {
      console.warn("[Preview] Unable to apply embeds:", error);
    }
    fetchSiteGraph();
    iframeRef.current?.contentWindow?.postMessage(
      { type: "WYSIWYG_REQUEST_HTML" },
      "*"
    );
  }, [
    API,
    email.value,
    projectId,
    getEmbedState,
    siteGraph,
    fetchSiteGraph,
    normalizePagePath,
    currentPage,
    pageInput,
    applyEmbedsToHtml,
    dispatch,
  ]);

  const handleApplyBlockChanges = useCallback(() => {
    if (!selectedBlock || !iframeRef.current?.contentWindow) return;
    const updatedHtml = mergeBlockHtml(
      selectedBlock.html,
      blockEditorContent,
      selectedBlock.id
    );
    iframeRef.current.contentWindow.postMessage(
      {
        type: "WYSIWYG_UPDATE_BLOCK",
        payload: {
          blockId: selectedBlock.id,
          html: updatedHtml,
        },
      },
      "*"
    );
    setSelectedBlock((prev) =>
      prev ? { ...prev, html: updatedHtml } : prev
    );
    dispatch(
      setSelectedBlockAction(
        selectedBlock ? { ...selectedBlock, html: updatedHtml } : null
      )
    );
    iframeRef.current.contentWindow.postMessage(
      { type: "WYSIWYG_REQUEST_HTML" },
      "*"
    );
  }, [selectedBlock, blockEditorContent, mergeBlockHtml, dispatch]);

  const applyBlockUpdate = useCallback(
    (blockId: string, html: string) => {
      if (!blockId || !html || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "WYSIWYG_UPDATE_BLOCK",
          payload: { blockId, html },
        },
        "*"
      );
      const nextBlock = { id: blockId, html };
      setSelectedBlock((prev) =>
        prev && prev.id === blockId ? { ...prev, html } : prev
      );
      setBlockEditorContent(extractInnerHtml(html));
      dispatch(setSelectedBlockAction({ ...nextBlock }));
      iframeRef.current.contentWindow.postMessage(
        { type: "WYSIWYG_REQUEST_HTML" },
        "*"
      );
    },
    [dispatch, extractInnerHtml]
  );

  useEffect(() => {
    const handleBlockUpdateEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (!detail.blockId || !detail.html) return;
      applyBlockUpdate(detail.blockId, detail.html);
    };

    const handleInsertBlockEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (!detail.html || !iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(
        {
          type: "WYSIWYG_INSERT_BLOCK",
          payload: {
            html: detail.html,
            position: detail.position || "append",
            dropY: detail.dropY,
          },
        },
        "*"
      );
      setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "WYSIWYG_REQUEST_HTML" },
          "*"
        );
      }, 150);
    };

    const handleNavigatePage = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (!detail.path) return;
      const normalized = normalizePagePath(detail.path);
      setCurrentPage(normalized);
      setPageInput(normalized);
    };

    window.addEventListener("SB_APPLY_BLOCK_UPDATE", handleBlockUpdateEvent);
    window.addEventListener("SB_INSERT_BLOCK_HTML", handleInsertBlockEvent);
    window.addEventListener("SB_NAVIGATE_PAGE", handleNavigatePage);

    return () => {
      window.removeEventListener("SB_APPLY_BLOCK_UPDATE", handleBlockUpdateEvent);
      window.removeEventListener("SB_INSERT_BLOCK_HTML", handleInsertBlockEvent);
      window.removeEventListener("SB_NAVIGATE_PAGE", handleNavigatePage);
    };
  }, [applyBlockUpdate, normalizePagePath]);

  return (
    <div className={`h-full w-full overflow-hidden relative ${editMode ? "flex" : ""}`}>
      {editMode && previewUrl && (
        <div className="flex-shrink-0 w-14 flex flex-col items-center gap-2 py-4 border-r border-[#2a2a2b] bg-[#141415] z-30">
          {[
            { id: 'bold', icon: MdFormatBold, title: 'Bold' },
            { id: 'italic', icon: MdFormatItalic, title: 'Italic' },
            { id: 'underline', icon: MdFormatUnderlined, title: 'Underline' },
            { id: 'strikeThrough', icon: MdStrikethroughS, title: 'Strike' },
          ].map(tool => (
            <button
              key={tool.id}
              className="w-9 h-9 flex items-center justify-center rounded-md border border-[#2a2a2b] bg-[#1a1a1d] text-white/70 hover:text-white hover:border-[#4a90e2] transition-colors"
              onClick={() => {
                iframeRef.current?.focus();
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage({
                    type: 'WYSIWYG_CACHE_SELECTION'
                  }, '*');
                  setTimeout(() => {
                    iframeRef.current?.contentWindow?.postMessage({
                      type: 'WYSIWYG_FORMAT',
                      payload: { command: tool.id }
                    }, '*');
                  }, 10);
                }
              }}
              title={tool.title}
              type="button"
            >
              <tool.icon className="text-base" />
            </button>
          ))}
          <div className="w-6 border-t border-[#2a2a2b] my-1" />
          {[
            { id: 'insertUnorderedList', icon: MdFormatListBulleted, title: 'Bullets' },
            { id: 'insertOrderedList', icon: MdFormatListNumbered, title: 'Numbers' },
          ].map(tool => (
            <button
              key={tool.id}
              className="w-9 h-9 flex items-center justify-center rounded-md border border-[#2a2a2b] bg-[#1a1a1d] text-white/70 hover:text-white hover:border-[#4a90e2] transition-colors"
              onClick={() => {
                iframeRef.current?.focus();
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage({
                    type: 'WYSIWYG_CACHE_SELECTION'
                  }, '*');
                  setTimeout(() => {
                    iframeRef.current?.contentWindow?.postMessage({
                      type: 'WYSIWYG_FORMAT',
                      payload: { command: tool.id }
                    }, '*');
                  }, 10);
                }
              }}
              title={tool.title}
              type="button"
            >
              <tool.icon className="text-base" />
            </button>
          ))}
          <div className="w-6 border-t border-[#2a2a2b] my-1" />
          <button
            className="w-9 h-9 flex items-center justify-center rounded-md border border-[#2a2a2b] bg-[#1a1a1d] text-white/70 hover:text-white hover:border-[#4a90e2] transition-colors"
            onClick={() => {
              iframeRef.current?.focus();
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                  type: 'WYSIWYG_CACHE_SELECTION'
                }, '*');
                setTimeout(() => {
                  iframeRef.current?.contentWindow?.postMessage({
                    type: 'WYSIWYG_FORMAT',
                    payload: { command: 'removeFormat' }
                  }, '*');
                }, 10);
              }
            }}
            title="Clear Format"
            type="button"
          >
            <MdFormatClear className="text-base" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-0 relative h-full w-full">
        {previewUrl && (
          <div className="absolute top-3 left-3 right-3 z-40 flex flex-col gap-2 pointer-events-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2a2a2b] bg-[#111116]/90 backdrop-blur-xl px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MdOutlineLink className="text-[#4a90e2]" />
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const normalized = normalizePagePath(pageInput);
                      setCurrentPage(normalized);
                      setPageInput(normalized);
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-[#5f5f66]"
                  placeholder="pages/index.html"
                />
                <button
                  onClick={() => {
                    const normalized = normalizePagePath(pageInput);
                    setCurrentPage(normalized);
                    setPageInput(normalized);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] text-white hover:border-[#4a90e2] transition-colors"
                >
                  Go
                </button>
                <button
                  onClick={() => handleCreatePage(pageInput)}
                  className="text-[11px] px-2 py-1 rounded-md bg-[#4a90e2] text-white hover:bg-[#5ba0f2] transition-colors flex items-center gap-1"
                >
                  <MdOutlineAdd />
                  New Page
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSitePanelOpen((prev) => !prev)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] text-[#c5c5cb] hover:text-white transition-colors flex items-center gap-1"
                >
                  <MdOutlineLayers />
                  Pages {siteGraph?.pages?.length || 0}
                </button>
                <button
                  onClick={() => setEmbedPanelOpen((prev) => !prev)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] text-[#c5c5cb] hover:text-white transition-colors"
                >
                  Embeds
                </button>
              </div>
            </div>

            {sitePanelOpen && (
              <div className="rounded-xl border border-[#2a2a2b] bg-[#141415]/95 backdrop-blur-xl p-4 text-sm text-white shadow-2xl">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2] mb-2">
                      Pages
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(siteGraph?.pages || []).map((page) => (
                        <button
                          key={page.path}
                          onClick={() => {
                            setCurrentPage(page.path);
                            setPageInput(page.path);
                          }}
                          className={`w-full text-left text-[12px] px-2 py-1 rounded-md border border-transparent hover:border-[#2a2a2b] ${
                            normalizePagePath(currentPage) === page.path
                              ? "bg-[#1f2530] text-white"
                              : "text-[#b0b0b6]"
                          }`}
                        >
                          {page.title || page.path}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2] mb-2">
                      Orphaned Pages
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(siteGraph?.orphanedPages || []).length === 0 && (
                        <p className="text-[11px] text-[#7d7d84]">
                          No orphaned pages.
                        </p>
                      )}
                      {(siteGraph?.orphanedPages || []).map((page) => (
                        <div key={page} className="text-[11px] text-[#b0b0b6]">
                          {page}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2] mb-2">
                      Orphaned Links
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {(siteGraph?.orphanedLinks || []).length === 0 && (
                        <p className="text-[11px] text-[#7d7d84]">
                          No orphaned links.
                        </p>
                      )}
                      {(siteGraph?.orphanedLinks || []).map((link, idx) => (
                        <div key={`${link.to}-${idx}`} className="text-[11px] text-[#b0b0b6]">
                          <div>{link.href}</div>
                          <button
                            onClick={() => handleCreatePage(link.to)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#4a90e2] hover:text-[#5ba0f2]"
                          >
                            <MdOutlineAdd />
                            Create page
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {embedPanelOpen && (
              <div className="rounded-xl border border-[#2a2a2b] bg-[#141415]/95 backdrop-blur-xl p-4 text-sm text-white shadow-2xl space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2] mb-2">
                    Head Embed
                  </p>
                  <div className="flex items-center gap-2 mb-2 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        headValidation.status === "ok"
                          ? "border-green-500/50 text-green-300"
                          : headValidation.status === "warning"
                          ? "border-yellow-500/50 text-yellow-300"
                          : headValidation.status === "error"
                          ? "border-red-500/50 text-red-300"
                          : "border-[#2a2a2b] text-[#7d7d84]"
                      }`}
                    >
                      {headValidation.status.toUpperCase()}
                    </span>
                    <span className="text-[#9b9ba3]">
                      {headValidation.message}
                    </span>
                  </div>
                  <textarea
                    value={embedHead}
                    onChange={(e) => setEmbedHead(e.target.value)}
                    className="w-full min-h-[90px] rounded-lg border border-[#2a2a2b] bg-[#0f0f10] p-2 text-xs text-white"
                    placeholder="Paste analytics / tag manager snippet for <head>..."
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2] mb-2">
                    Body Embed
                  </p>
                  <div className="flex items-center gap-2 mb-2 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        bodyValidation.status === "ok"
                          ? "border-green-500/50 text-green-300"
                          : bodyValidation.status === "warning"
                          ? "border-yellow-500/50 text-yellow-300"
                          : bodyValidation.status === "error"
                          ? "border-red-500/50 text-red-300"
                          : "border-[#2a2a2b] text-[#7d7d84]"
                      }`}
                    >
                      {bodyValidation.status.toUpperCase()}
                    </span>
                    <span className="text-[#9b9ba3]">
                      {bodyValidation.message}
                    </span>
                  </div>
                  <textarea
                    value={embedBody}
                    onChange={(e) => setEmbedBody(e.target.value)}
                    className="w-full min-h-[90px] rounded-lg border border-[#2a2a2b] bg-[#0f0f10] p-2 text-xs text-white"
                    placeholder="Paste widget or script for the end of <body>..."
                  />
                </div>
                <button
                  onClick={handleSaveEmbeds}
                  disabled={hasEmbedError}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    hasEmbedError
                      ? "bg-[#2a2a2b] text-[#7d7d84] cursor-not-allowed"
                      : "bg-[#4a90e2] text-white hover:bg-[#5ba0f2]"
                  }`}
                >
                  <MdOutlineSave />
                  Save Embeds
                </button>
              </div>
            )}
          </div>
        )}

        {selectedBlock && (
          <div className="absolute bottom-4 left-4 z-40 w-[360px] max-h-[65vh] rounded-xl border border-[#2a2a2b] bg-[#111116]/95 backdrop-blur-xl shadow-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#4a90e2]">
                  Edit This Block
                </p>
                <p className="text-xs text-[#9b9ba3]">
                  {selectedBlock.id}
                </p>
              </div>
              <button
                onClick={handleClearBlockSelection}
                className="text-[11px] text-[#9b9ba3] hover:text-white"
              >
                Clear
              </button>
            </div>
            <div className="h-[260px] overflow-hidden rounded-lg border border-[#2a2a2b]">
              <TiptapEditor
                content={blockEditorContent}
                onChange={setBlockEditorContent}
              />
            </div>
            <button
              onClick={handleApplyBlockChanges}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#4a90e2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5ba0f2]"
            >
              Apply changes to block
            </button>
            <p className="text-[10px] text-[#7d7d84]">
              Use WYSIWYG save if you want to persist the full page immediately.
            </p>
          </div>
        )}
        <AnimatePresence>
          {!previewUrl && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#121214] text-white">
              <LuLoaderCircle className="text-4xl text-[#4a90e2] animate-spin mb-4" />
              <h3 className="text-xl font-semibold text-white">Agent is cooking!</h3>
              <p className="text-[#b1b1b1] text-sm mt-1">Preparing your live preview...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {editMode && showTemplateBlocks && (
          <div className="absolute top-24 right-4 z-40 w-64 max-h-[80vh] overflow-y-auto rounded-xl border border-[#2a2a2b] bg-[#111116]/95 backdrop-blur-xl shadow-2xl p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4a90e2] block">Available Blocks</span>
            {templateBlocks.map((block) => (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => { setIsDraggingBlock(true); e.dataTransfer.setData("text/template-block-id", block.id); }}
                onDragEnd={() => setIsDraggingBlock(false)}
                onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: "WYSIWYG_INSERT_BLOCK", payload: { html: block.html, position: "prepend" } }, "*")}
                className="w-full text-left rounded-lg border border-[#2a2a2b] bg-[#18181b] hover:border-[#4a90e2] p-3 cursor-pointer group transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">{block.name}</span>
                  <span className="text-[9px] font-bold text-[#4a90e2] opacity-0 group-hover:opacity-100 uppercase">Click to Add</span>
                </div>
                <p className="text-[10px] text-[#9b9ba3] mt-1 line-clamp-2">{block.description}</p>
              </div>
            ))}
          </div>
        )}

        {previewUrl && (
          <div className={`h-full w-full flex justify-center relative ${responsive === "mobile" ? "items-center bg-[#0a0a0b]" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDrop}>
            {isDraggingBlock && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#4a90e2]/10 border-4 border-dashed border-[#4a90e2] m-4 rounded-2xl pointer-events-none">
                <div className="bg-[#4a90e2] text-white px-8 py-3 rounded-full font-bold shadow-2xl scale-110">
                  Drop Block to Insert
                </div>
              </div>
            )}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={previewSrc || previewUrl}
              className={`border-none transition-all duration-500 shadow-2xl ${isDraggingBlock ? "pointer-events-none" : ""} ${responsive === "mobile" ? "w-[375px] h-[667px] border border-[#2a2a2b] rounded-xl" : "w-full h-full"
                }`}
              onLoad={(e) => {
                // Delay to ensure iframe content is fully loaded and WebContainer is ready
                // This prevents conflicts with WebContainer's frame_start.js initialization
                setTimeout(() => {
                  try {
                    if (iframeRef.current?.contentWindow) {
                      // Send inspector mode
                      const inspectorMsg = inspectorMode ? "ENABLE_INSPECTOR" : "DISABLE_INSPECTOR";
                      iframeRef.current.contentWindow.postMessage({ 
                        type: "SUPERBLOCKS_INSPECTOR", 
                        msg: inspectorMsg 
                      }, "*");
                      
                      // Send edit mode
                      if (editMode) {
                        iframeRef.current.contentWindow.postMessage({ 
                          type: "WYSIWYG_EDIT_MODE", 
                          enabled: true 
                        }, "*");
                      }
                    }
                  } catch (error) {
                    console.warn('[Preview] Error sending messages to iframe:', error);
                  }
                }, 500); // Increased delay to let WebContainer fully initialize
              }}
              onError={(e) => {
                console.error('[Preview] Iframe load error:', e);
                // Don't break the UI, just log the error
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Preview;

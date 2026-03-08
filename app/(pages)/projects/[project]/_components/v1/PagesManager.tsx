"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { MdOutlineAdd, MdOutlineLayers, MdOutlineOpenInNew } from "react-icons/md";
import { LuRefreshCw } from "react-icons/lu";
import { API } from "@/app/config/publicEnv";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useWebContainerContext } from "@/app/redux/useWebContainerContext";
import { updateSpecificFile, setCurrentFile } from "@/app/redux/reducers/projectFiles";
import { setProjectMode, refreshPreview } from "@/app/redux/reducers/projectOptions";
import type { RootState } from "@/app/redux/store";
import {
  createBasicPageHtml,
  ensureUniquePagePath,
  normalizePagePath,
  SiteGraph as SiteGraphBase,
} from "@/app/helpers/sitePages";

type SiteGraph = SiteGraphBase & {
  links?: { from: string; to: string; href: string }[];
  orphanedLinks?: { from: string; to: string; href: string }[];
  orphanedPages?: string[];
  embeds?: { head: string[]; body: string[] };
  forms?: { id: string; name?: string; page?: string }[];
};

type FormField = {
  id: string;
  type: "text" | "email" | "textarea" | "select" | "checkbox" | "tel" | "number";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string;
};

const defaultField = (): FormField => ({
  id: `field-${Date.now().toString(36)}`,
  type: "text",
  label: "Full name",
  placeholder: "Jane Doe",
  required: true,
});

const PagesManager = () => {
  const { email } = useAuthenticated();
  const { webcontainerInstance } = useWebContainerContext();
  const dispatch = useDispatch();
  const path = usePathname();
  const projectData = useSelector((state: RootState) => state.projectFiles.data) as
    | Record<string, string>
    | null;

  const projectId = useMemo(() => {
    const segments = path.split("/");
    return segments[2] || "";
  }, [path]);

  const [siteGraph, setSiteGraph] = useState<SiteGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState("");

  const [formName, setFormName] = useState("Contact Form");
  const [formSubmitLabel, setFormSubmitLabel] = useState("Send message");
  const [formSuccessMessage, setFormSuccessMessage] = useState("Thanks! We will get back to you shortly.");
  const [formLayout, setFormLayout] = useState<"stacked" | "two-column">("stacked");
  const [formAccent, setFormAccent] = useState("#4a90e2");
  const [formRadius, setFormRadius] = useState(12);
  const [formBg, setFormBg] = useState("#141415");
  const [formText, setFormText] = useState("#f5f5f7");
  const [inputBg, setInputBg] = useState("#0f0f10");
  const [inputBorder, setInputBorder] = useState("#2a2a2b");
  const [fields, setFields] = useState<FormField[]>([
    defaultField(),
    {
      id: `field-${Date.now().toString(36)}-email`,
      type: "email",
      label: "Email address",
      placeholder: "you@example.com",
      required: true,
    },
    {
      id: `field-${Date.now().toString(36)}-message`,
      type: "textarea",
      label: "Message",
      placeholder: "Tell us how we can help...",
      required: true,
    },
  ]);

  const escapeAttribute = useCallback((value: string) => {
    return String(value || "").replace(/"/g, "&quot;");
  }, []);

  const toFieldName = useCallback((label: string) => {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "field";
  }, []);

  const findFileContent = useCallback(
    async (paths: string[]) => {
      const unique = Array.from(new Set(paths.filter(Boolean)));
      for (const raw of unique) {
        const normalized = raw.replace(/^\/+/, "");
        const variants = [normalized, `/${normalized}`];

        if (projectData) {
          for (const key of variants) {
            if (key in projectData) {
              return { path: normalized, content: projectData[key] as string };
            }
          }
        }

        if (webcontainerInstance) {
          for (const key of variants) {
            try {
              const filePath = key.startsWith("/") ? key : `/${key}`;
              const content = await webcontainerInstance.fs.readFile(filePath, "utf-8");
              if (content) {
                return { path: normalized, content };
              }
            } catch {
              // try next
            }
          }
        }
      }

      return null;
    },
    [projectData, webcontainerInstance]
  );

  const resolveReactApp = useCallback(async () => {
    const appCandidates = [
      "workspace/src/App.jsx",
      "workspace/src/App.tsx",
      "src/App.jsx",
      "src/App.tsx",
    ];
    const appFile = await findFileContent(appCandidates);
    if (!appFile) return null;

    return {
      appPath: appFile.path,
      appContent: appFile.content,
      isTsx: appFile.path.endsWith(".tsx"),
    };
  }, [findFileContent]);

  const fetchSiteGraph = useCallback(async () => {
    if (!API || !email.value || !projectId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API}/site-graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, email: email.value }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.success) return;
      const nextGraph: SiteGraph = {
        pages: data.pages || [],
        links: data.links || [],
        orphanedLinks: data.orphanedLinks || [],
        orphanedPages: data.orphanedPages || [],
        embeds: data.embeds || { head: [], body: [] },
        forms: data.forms || [],
        pageRoot: data.pageRoot || "",
      };
      setSiteGraph(nextGraph);
      if (!selectedPage && nextGraph.pages?.length) {
        setSelectedPage(nextGraph.pages[0].path);
      }
    } catch (error) {
      console.warn("[PagesManager] Failed to fetch site graph:", error);
    } finally {
      setLoading(false);
    }
  }, [API, email.value, projectId, selectedPage]);

  useEffect(() => {
    fetchSiteGraph();
  }, [fetchSiteGraph]);

  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();
    const pages = siteGraph?.pages || [];
    if (!query) return pages;
    return pages.filter((page) =>
      `${page.title || ""} ${page.path}`.toLowerCase().includes(query)
    );
  }, [siteGraph, search]);

  const handleCreatePage = useCallback(
    async (rawPath?: string) => {
      if (!siteGraph) return;
      const target = normalizePagePath(rawPath || pageInput, siteGraph);
      const safeTarget = ensureUniquePagePath(target, siteGraph.pages || []);
      const slug = safeTarget
        .replace(/^pages\//, "")
        .replace(/^workspace\//, "")
        .replace(/\.html$/, "");
      const title = slug
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      const html = createBasicPageHtml({
        title,
        slug,
        embeds: siteGraph.embeds || { head: [], body: [] },
      });

      if (webcontainerInstance) {
        const dir = safeTarget.includes("/")
          ? safeTarget.substring(0, safeTarget.lastIndexOf("/"))
          : "";
        if (dir) {
          await webcontainerInstance.fs.mkdir(dir, { recursive: true }).catch(() => {});
        }
        await webcontainerInstance.fs.writeFile(safeTarget, html);
        dispatch(
          updateSpecificFile({
            filePath: safeTarget,
            content: html,
            createDirectories: true,
          })
        );
      }

      if (API && email.value) {
        await fetch(`${API}/updatefiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            email: email.value,
            filePath: `/${safeTarget}`,
            content: html,
            currentFile: JSON.stringify({
              name: safeTarget.split("/").pop(),
              path: `/${safeTarget}`,
            }),
          }),
        }).catch((error) =>
          console.warn("[PagesManager] Failed to save new page:", error)
        );
      }

      setPageInput("");
      setSelectedPage(safeTarget);
      dispatch(refreshPreview());
      fetchSiteGraph();
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("SB_NAVIGATE_PAGE", { detail: { path: safeTarget } })
        );
        dispatch(setProjectMode({ mode: "edit" }));
      }
    },
    [API, email.value, pageInput, projectId, siteGraph, webcontainerInstance, dispatch, fetchSiteGraph]
  );

  const handleOpenPage = useCallback((path: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("SB_NAVIGATE_PAGE", { detail: { path } })
      );
    }
    dispatch(setProjectMode({ mode: "edit" }));
  }, [dispatch]);

  const handleOpenCode = useCallback(
    async (path: string) => {
      const normalizedPath = path.replace(/^\/+/, "");
      const candidates = [
        normalizedPath,
        `/${normalizedPath}`,
        normalizedPath.replace(/^workspace\//, ""),
        `/${normalizedPath.replace(/^workspace\//, "")}`,
      ];

      let contents: string | undefined;
      if (projectData) {
        for (const key of candidates) {
          if (key in projectData) {
            contents = projectData[key] as string;
            break;
          }
        }
      }

      if (!contents && webcontainerInstance) {
        for (const key of candidates) {
          try {
            const filePath = key.startsWith("/") ? key : `/${key}`;
            contents = await webcontainerInstance.fs.readFile(filePath, "utf-8");
            if (contents) break;
          } catch {
            // try next candidate
          }
        }
      }

      dispatch(
        setCurrentFile({
          name: normalizedPath.split("/").pop() || normalizedPath,
          path: normalizedPath,
          contents: contents || "",
        })
      );
      dispatch(setProjectMode({ mode: "code" }));
    },
    [dispatch, projectData, webcontainerInstance]
  );

  const buildFormHtml = useCallback(() => {
    const formId = `form-${Date.now().toString(36)}`;
    const safeFormName = escapeAttribute(formName);
    const safeSuccess = escapeAttribute(formSuccessMessage);
    const buttonStyle = `background:${formAccent}; color:#fff; padding:12px 18px; border:none; border-radius:${formRadius}px; font-weight:600; cursor:pointer; width:100%; box-sizing:border-box;`;
    const inputStyle = `width:100%; padding:12px 14px; border-radius:${formRadius}px; border:1px solid ${inputBorder}; background:${inputBg}; color:${formText}; box-sizing:border-box;`;
    const labelStyle = `font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${formText}; opacity:0.7;`;
    const gridStyle =
      formLayout === "two-column"
        ? "display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:16px;"
        : "display:flex; flex-direction:column; gap:16px;";

    const fieldHtml = fields
      .map((field) => {
        const requiredAttr = field.required ? "required" : "";
        const placeholderAttr = field.placeholder
          ? `placeholder="${field.placeholder}"`
          : "";
        const nameAttr = `name="${toFieldName(field.label)}"`;

        if (field.type === "textarea") {
          return `<label style="display:flex; flex-direction:column; gap:6px;">
  <span style="${labelStyle}">${field.label}${field.required ? " *" : ""}</span>
  <textarea ${nameAttr} ${requiredAttr} ${placeholderAttr} style="${inputStyle} min-height:120px;"></textarea>
</label>`;
        }

        if (field.type === "select") {
          const options = (field.options || "Option 1,Option 2")
            .split(",")
            .map((opt) => opt.trim())
            .filter(Boolean)
            .map((opt) => `<option>${opt}</option>`)
            .join("");
          return `<label style="display:flex; flex-direction:column; gap:6px;">
  <span style="${labelStyle}">${field.label}${field.required ? " *" : ""}</span>
  <select ${nameAttr} ${requiredAttr} style="${inputStyle}">
    ${options}
  </select>
</label>`;
        }

        if (field.type === "checkbox") {
          return `<label style="display:flex; align-items:center; gap:10px;">
  <input type="checkbox" ${nameAttr} ${requiredAttr} style="width:18px; height:18px; accent-color:${formAccent};" />
  <span style="font-size:14px; color:${formText};">${field.label}</span>
</label>`;
        }

        return `<label style="display:flex; flex-direction:column; gap:6px;">
  <span style="${labelStyle}">${field.label}${field.required ? " *" : ""}</span>
  <input type="${field.type}" ${nameAttr} ${requiredAttr} ${placeholderAttr} style="${inputStyle}" />
</label>`;
      })
      .join("\n");

    return `
<section data-sb-block-id="${formId}" style="background:${formBg}; color:${formText}; padding:28px; border-radius:${formRadius + 4}px; border:1px solid ${inputBorder}; max-width:720px; width:100%; box-sizing:border-box; margin:0 auto;">
  <h2 style="margin:0 0 8px 0; font-size:22px;">${formName}</h2>
  <p style="margin:0 0 20px 0; color:${formText}; opacity:0.7; font-size:14px;">${formSuccessMessage}</p>
  <form data-sb-form-id="${formId}" data-sb-form-name="${safeFormName}" data-sb-form-success="${safeSuccess}" style="${gridStyle} box-sizing:border-box; width:100%;">
    ${fieldHtml}
    <button type="submit" style="${buttonStyle}">${formSubmitLabel}</button>
  </form>
</section>
    `.trim();
  }, [
    fields,
    formAccent,
    formRadius,
    formBg,
    formText,
    inputBg,
    inputBorder,
    formLayout,
    formName,
    formSubmitLabel,
    formSuccessMessage,
    escapeAttribute,
    toFieldName,
  ]);

  const buildFormComponent = useCallback(() => {
    const formId = `form-${Date.now().toString(36)}`;
    const safeFormName = escapeAttribute(formName);
    const safeSuccess = escapeAttribute(formSuccessMessage);

    const sectionStyle = JSON.stringify({
      background: formBg,
      color: formText,
      padding: "28px",
      borderRadius: `${formRadius + 4}px`,
      border: `1px solid ${inputBorder}`,
      maxWidth: "720px",
      width: "100%",
      boxSizing: "border-box",
      margin: "0 auto",
    });
    const titleStyle = JSON.stringify({
      margin: "0 0 8px 0",
      fontSize: "22px",
    });
    const subtitleStyle = JSON.stringify({
      margin: "0 0 20px 0",
      color: formText,
      opacity: 0.7,
      fontSize: "14px",
    });
    const formStyle = JSON.stringify(
      formLayout === "two-column"
        ? {
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "16px",
            width: "100%",
            boxSizing: "border-box",
          }
        : {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            width: "100%",
            boxSizing: "border-box",
          }
    );
    const labelWrapperStyle = JSON.stringify({
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });
    const labelTextStyle = JSON.stringify({
      fontSize: "12px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: formText,
      opacity: 0.7,
    });
    const inputStyle = JSON.stringify({
      width: "100%",
      padding: "12px 14px",
      borderRadius: `${formRadius}px`,
      border: `1px solid ${inputBorder}`,
      background: inputBg,
      color: formText,
      boxSizing: "border-box",
    });
    const buttonStyle = JSON.stringify({
      background: formAccent,
      color: "#fff",
      padding: "12px 18px",
      border: "none",
      borderRadius: `${formRadius}px`,
      fontWeight: 600,
      cursor: "pointer",
      width: "100%",
      boxSizing: "border-box",
    });
    const checkboxRowStyle = JSON.stringify({
      display: "flex",
      alignItems: "center",
      gap: "10px",
    });

    const fieldMarkup = fields
      .map((field) => {
        const requiredAttr = field.required ? "required" : "";
        const placeholderAttr = field.placeholder
          ? `placeholder="${field.placeholder}"`
          : "";
        const nameAttr = `name="${toFieldName(field.label)}"`;

        if (field.type === "textarea") {
          return `<label style={${labelWrapperStyle}}>
  <span style={${labelTextStyle}}>${field.label}${field.required ? " *" : ""}</span>
  <textarea ${nameAttr} ${requiredAttr} ${placeholderAttr} style={${inputStyle}} />
</label>`;
        }

        if (field.type === "select") {
          const options = (field.options || "Option 1,Option 2")
            .split(",")
            .map((opt) => opt.trim())
            .filter(Boolean)
            .map((opt) => `<option value="${opt}">${opt}</option>`)
            .join("\n");
          return `<label style={${labelWrapperStyle}}>
  <span style={${labelTextStyle}}>${field.label}${field.required ? " *" : ""}</span>
  <select ${nameAttr} ${requiredAttr} style={${inputStyle}}>
    ${options}
  </select>
</label>`;
        }

        if (field.type === "checkbox") {
          return `<label style={${checkboxRowStyle}}>
  <input type="checkbox" ${nameAttr} ${requiredAttr} style={{ width: "18px", height: "18px", accentColor: "${formAccent}" }} />
  <span style={{ fontSize: "14px", color: "${formText}" }}>${field.label}</span>
</label>`;
        }

        return `<label style={${labelWrapperStyle}}>
  <span style={${labelTextStyle}}>${field.label}${field.required ? " *" : ""}</span>
  <input type="${field.type}" ${nameAttr} ${requiredAttr} ${placeholderAttr} style={${inputStyle}} />
</label>`;
      })
      .join("\n");

    const componentCode = `import React from "react";

const SBFormBlock = () => {
  return (
    <section data-sb-block-id="${formId}" style={${sectionStyle}}>
      <h2 style={${titleStyle}}>${formName}</h2>
      <p style={${subtitleStyle}}>${formSuccessMessage}</p>
      <form data-sb-form-id="${formId}" data-sb-form-name="${safeFormName}" data-sb-form-success="${safeSuccess}" style={${formStyle}}>
        ${fieldMarkup}
        <button type="submit" style={${buttonStyle}}>${formSubmitLabel}</button>
      </form>
    </section>
  );
};

export default SBFormBlock;
`;

    return { componentCode, formId };
  }, [
    fields,
    escapeAttribute,
    formName,
    formSuccessMessage,
    formAccent,
    formBg,
    formText,
    formRadius,
    inputBg,
    inputBorder,
    formLayout,
    formSubmitLabel,
    toFieldName,
  ]);

  const injectFormComponentIntoApp = useCallback(
    (appCode: string, importPath: string) => {
      if (!appCode || appCode.includes("<SBFormBlock")) return appCode;

      const importLine = `import SBFormBlock from "${importPath}";`;
      let next = appCode;

      if (!next.includes(importLine)) {
        const importMatches = next.match(/import[\s\S]*?;[\t ]*(\r?\n)?/g);
        if (importMatches && importMatches.length > 0) {
          const lastImport = importMatches[importMatches.length - 1];
          const idx = next.lastIndexOf(lastImport);
          if (idx !== -1) {
            next =
              next.slice(0, idx + lastImport.length) +
              `\n${importLine}\n` +
              next.slice(idx + lastImport.length);
          }
        } else {
          next = `${importLine}\n${next}`;
        }
      }

      if (next.includes("<SBFormBlock")) return next;

      const fragmentClose = next.lastIndexOf("</>");
      if (fragmentClose !== -1) {
        return (
          next.slice(0, fragmentClose) +
          `\n      <SBFormBlock />\n` +
          next.slice(fragmentClose)
        );
      }

      const rootMatch = next.match(/return\s*\(\s*<([A-Za-z][\w:-]*)/);
      if (rootMatch && rootMatch[1]) {
        const rootTag = rootMatch[1];
        const closeTag = `</${rootTag}>`;
        const closeIndex = next.lastIndexOf(closeTag);
        if (closeIndex !== -1) {
          return (
            next.slice(0, closeIndex) +
            `\n      <SBFormBlock />\n` +
            next.slice(closeIndex)
          );
        }
      }

      const returnClose = next.lastIndexOf(");");
      if (returnClose !== -1) {
        return (
          next.slice(0, returnClose) +
          `\n      <SBFormBlock />\n` +
          next.slice(returnClose)
        );
      }

      return next;
    },
    []
  );

  const handleInsertForm = useCallback(async () => {
    if (!selectedPage || !siteGraph) return;
    const html = buildFormHtml();
    const targetPath = normalizePagePath(selectedPage, siteGraph);

    let existingHtml = "";
    if (projectData) {
      existingHtml =
        projectData[targetPath] ||
        projectData[`/${targetPath}`] ||
        projectData[targetPath.replace(/^workspace\//, "")] ||
        projectData[`/${targetPath.replace(/^workspace\//, "")}`] ||
        "";
    }

    if (!existingHtml && webcontainerInstance) {
      try {
        existingHtml = await webcontainerInstance.fs.readFile(targetPath, "utf-8");
      } catch {
        try {
          existingHtml = await webcontainerInstance.fs.readFile(
            `/${targetPath}`,
            "utf-8"
          );
        } catch {
          existingHtml = "";
        }
      }
    }

    const reactApp = await resolveReactApp();
    if (reactApp && targetPath.endsWith("index.html")) {
      const { componentCode } = buildFormComponent();
      const componentExt = reactApp.isTsx ? "tsx" : "jsx";
      const componentPath = reactApp.appPath.replace(
        /src\/App\.(jsx|tsx)$/i,
        `src/components/SBFormBlock.${componentExt}`
      );
      const importPath = "./components/SBFormBlock";
      const nextApp = injectFormComponentIntoApp(
        reactApp.appContent,
        importPath
      );

      const absoluteComponentPath = componentPath.startsWith("/")
        ? componentPath
        : `/${componentPath}`;
      const absoluteAppPath = reactApp.appPath.startsWith("/")
        ? reactApp.appPath
        : `/${reactApp.appPath}`;

      if (webcontainerInstance) {
        const componentDir = absoluteComponentPath.substring(
          0,
          absoluteComponentPath.lastIndexOf("/")
        );
        await webcontainerInstance.fs
          .mkdir(componentDir, { recursive: true })
          .catch(() => {});
        await webcontainerInstance.fs.writeFile(
          absoluteComponentPath,
          componentCode
        );
        await webcontainerInstance.fs.writeFile(absoluteAppPath, nextApp);
      }

      dispatch(
        updateSpecificFile({
          filePath: absoluteComponentPath,
          content: componentCode,
          createDirectories: true,
        })
      );
      dispatch(
        updateSpecificFile({
          filePath: absoluteAppPath,
          content: nextApp,
          createDirectories: true,
        })
      );

      if (API && email.value) {
        await fetch(`${API}/updatefiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            email: email.value,
            filePath: absoluteComponentPath,
            content: componentCode,
            currentFile: JSON.stringify({
              name: absoluteComponentPath.split("/").pop(),
              path: absoluteComponentPath,
            }),
          }),
        }).catch((error) =>
          console.warn("[PagesManager] Failed to save form component:", error)
        );

        await fetch(`${API}/updatefiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            email: email.value,
            filePath: absoluteAppPath,
            content: nextApp,
            currentFile: JSON.stringify({
              name: absoluteAppPath.split("/").pop(),
              path: absoluteAppPath,
            }),
          }),
        }).catch((error) =>
          console.warn("[PagesManager] Failed to save App update:", error)
        );
      }

      dispatch(refreshPreview());
      fetchSiteGraph();
      dispatch(setProjectMode({ mode: "edit" }));
      return;
    }

    if (!existingHtml) {
      console.warn("[PagesManager] Unable to locate HTML for", targetPath);
      return;
    }

    let updatedHtml = existingHtml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(existingHtml, "text/html");
      const temp = doc.createElement("div");
      temp.innerHTML = html.trim();
      const newBlock = temp.firstElementChild;
      if (newBlock) {
        if (!newBlock.getAttribute("data-sb-block-id")) {
          newBlock.setAttribute(
            "data-sb-block-id",
            `sb-block-${Date.now().toString(36)}`
          );
        }
        const container =
          doc.querySelector("main") ||
          doc.getElementById("root") ||
          doc.getElementById("__next") ||
          doc.body;
        container.appendChild(newBlock);
        const doctypeMatch = existingHtml.match(/<!doctype[^>]*>/i);
        const doctype = doctypeMatch ? doctypeMatch[0] : "<!doctype html>";
        updatedHtml = `${doctype}\n${doc.documentElement.outerHTML}`;
      }
    } catch (error) {
      console.warn("[PagesManager] DOM insert failed, appending raw HTML", error);
      updatedHtml = `${existingHtml}\n${html}`;
    }

    const absolutePath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;

    if (webcontainerInstance) {
      const dir = absolutePath.includes("/")
        ? absolutePath.substring(0, absolutePath.lastIndexOf("/"))
        : "";
      if (dir) {
        await webcontainerInstance.fs.mkdir(dir, { recursive: true }).catch(() => {});
      }
      await webcontainerInstance.fs.writeFile(absolutePath, updatedHtml);
    }

    dispatch(
      updateSpecificFile({
        filePath: absolutePath,
        content: updatedHtml,
        createDirectories: true,
      })
    );

    if (API && email.value) {
      await fetch(`${API}/updatefiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          email: email.value,
          filePath: absolutePath,
          content: updatedHtml,
          currentFile: JSON.stringify({
            name: targetPath.split("/").pop(),
            path: absolutePath,
          }),
        }),
      }).catch((error) =>
        console.warn("[PagesManager] Failed to save form insertion:", error)
      );
    }

    dispatch(refreshPreview());
    fetchSiteGraph();
    setSelectedPage(targetPath);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("SB_NAVIGATE_PAGE", { detail: { path: targetPath } })
      );
    }
    dispatch(setProjectMode({ mode: "edit" }));
  }, [
    selectedPage,
    siteGraph,
    buildFormHtml,
    buildFormComponent,
    resolveReactApp,
    injectFormComponentIntoApp,
    projectData,
    webcontainerInstance,
    dispatch,
    API,
    email.value,
    projectId,
    fetchSiteGraph,
  ]);

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...patch } : field))
    );
  };

  const moveField = (id: string, direction: "up" | "down") => {
    setFields((prev) => {
      const index = prev.findIndex((field) => field.id === id);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const updated = [...prev];
      const [item] = updated.splice(index, 1);
      updated.splice(nextIndex, 0, item);
      return updated;
    });
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((field) => field.id !== id));
  };

  return (
    <div className="h-full w-full p-6 overflow-y-auto text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold">Pages Manager</h2>
          <p className="text-xs text-[#a0a0a8]">
            Manage pages, orphaned links, and insert new sections like forms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSiteGraph}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
          >
            <LuRefreshCw /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-xl border border-[#2a2a2b] bg-[#141415] p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                placeholder="new-page.html"
                className="flex-1 min-w-[200px] rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs text-white"
              />
              <button
                onClick={() => handleCreatePage(pageInput)}
                className="inline-flex items-center gap-1 rounded-md bg-[#4a90e2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5ba0f2]"
              >
                <MdOutlineAdd /> New Page
              </button>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages..."
                className="flex-1 min-w-[160px] rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {(filteredPages || []).map((page) => {
                const isOrphan = siteGraph?.orphanedPages?.includes(page.path);
                return (
                  <div
                    key={page.path}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2a2a2b] bg-[#111116] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{page.title || page.path}</p>
                      <p className="text-[11px] text-[#7d7d84]">{page.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOrphan && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/40 text-yellow-300">
                          Orphaned
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenPage(page.path)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleOpenCode(page.path)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
                      >
                        Code
                      </button>
                    </div>
                  </div>
                );
              })}
              {!filteredPages.length && (
                <p className="text-xs text-[#7d7d84]">No pages found.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a2b] bg-[#141415] p-4">
            <div className="flex items-center gap-2 mb-3">
              <MdOutlineLayers className="text-[#4a90e2]" />
              <h3 className="text-sm font-semibold">Orphaned Links</h3>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {(siteGraph?.orphanedLinks || []).map((link, idx) => (
                <div
                  key={`${link.to}-${idx}`}
                  className="rounded-lg border border-[#2a2a2b] bg-[#111116] px-3 py-2"
                >
                  <p className="text-xs text-white/80">{link.href}</p>
                  <p className="text-[11px] text-[#7d7d84]">
                    From: {link.from}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleCreatePage(link.to)}
                      className="text-[11px] px-2 py-1 rounded-md bg-[#4a90e2] text-white hover:bg-[#5ba0f2]"
                    >
                      Create page
                    </button>
                    <button
                      onClick={() => handleOpenPage(link.from)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
                    >
                      Open source
                    </button>
                  </div>
                </div>
              ))}
              {(siteGraph?.orphanedLinks || []).length === 0 && (
                <p className="text-xs text-[#7d7d84]">No orphaned links.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a2b] bg-[#141415] p-4">
            <div className="flex items-center gap-2 mb-3">
              <MdOutlineLayers className="text-[#4a90e2]" />
              <h3 className="text-sm font-semibold">Orphaned Pages</h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {(siteGraph?.orphanedPages || []).map((page) => (
                <div
                  key={page}
                  className="rounded-lg border border-[#2a2a2b] bg-[#111116] px-3 py-2 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-medium">{page}</p>
                    <p className="text-[11px] text-[#7d7d84]">No inbound links</p>
                  </div>
                  <button
                    onClick={() => handleOpenPage(page)}
                    className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
                  >
                    Open
                  </button>
                </div>
              ))}
              {(siteGraph?.orphanedPages || []).length === 0 && (
                <p className="text-xs text-[#7d7d84]">No orphaned pages.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#2a2a2b] bg-[#141415] p-4">
            <h3 className="text-sm font-semibold mb-3">Form Builder</h3>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs"
              >
                {(siteGraph?.pages || []).map((page) => (
                  <option key={page.path} value={page.path}>
                    Insert into: {page.title || page.path}
                  </option>
                ))}
              </select>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs"
                placeholder="Form title"
              />
              <input
                value={formSubmitLabel}
                onChange={(e) => setFormSubmitLabel(e.target.value)}
                className="w-full rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs"
                placeholder="Button label"
              />
              <textarea
                value={formSuccessMessage}
                onChange={(e) => setFormSuccessMessage(e.target.value)}
                className="w-full min-h-[60px] rounded-lg border border-[#2a2a2b] bg-[#0f0f10] px-3 py-2 text-xs"
                placeholder="Short description"
              />
              <div className="grid grid-cols-2 gap-2 text-xs min-w-0">
                <label className="flex flex-col gap-1">
                  Accent
                  <input type="color" value={formAccent} onChange={(e) => setFormAccent(e.target.value)} className="h-8 w-full bg-transparent" />
                </label>
                <label className="flex flex-col gap-1">
                  Radius
                  <input
                    type="range"
                    min={4}
                    max={24}
                    value={formRadius}
                    onChange={(e) => setFormRadius(Number(e.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Background
                  <input type="color" value={formBg} onChange={(e) => setFormBg(e.target.value)} className="h-8 w-full bg-transparent" />
                </label>
                <label className="flex flex-col gap-1">
                  Text
                  <input type="color" value={formText} onChange={(e) => setFormText(e.target.value)} className="h-8 w-full bg-transparent" />
                </label>
                <label className="flex flex-col gap-1">
                  Input BG
                  <input type="color" value={inputBg} onChange={(e) => setInputBg(e.target.value)} className="h-8 w-full bg-transparent" />
                </label>
                <label className="flex flex-col gap-1">
                  Input Border
                  <input type="color" value={inputBorder} onChange={(e) => setInputBorder(e.target.value)} className="h-8 w-full bg-transparent" />
                </label>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setFormLayout("stacked")}
                  className={`px-2 py-1 rounded-md border ${formLayout === "stacked" ? "border-[#4a90e2] text-white" : "border-[#2a2a2b] text-[#9b9ba3]"}`}
                >
                  Stacked
                </button>
                <button
                  onClick={() => setFormLayout("two-column")}
                  className={`px-2 py-1 rounded-md border ${formLayout === "two-column" ? "border-[#4a90e2] text-white" : "border-[#2a2a2b] text-[#9b9ba3]"}`}
                >
                  Two-column
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Fields</p>
                  <button
                    onClick={() => setFields((prev) => [...prev, defaultField()])}
                    className="text-[11px] px-2 py-1 rounded-md border border-[#2a2a2b] hover:border-[#4a90e2]"
                  >
                    Add field
                  </button>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-[#2a2a2b] bg-[#111116] p-2 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{field.label}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveField(field.id, "up")} className="px-1 text-[#7d7d84] hover:text-white">↑</button>
                        <button onClick={() => moveField(field.id, "down")} className="px-1 text-[#7d7d84] hover:text-white">↓</button>
                        <button onClick={() => removeField(field.id)} className="px-1 text-[#7d7d84] hover:text-red-400">✕</button>
                      </div>
                    </div>
                    <input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      className="w-full rounded-md border border-[#2a2a2b] bg-[#0f0f10] px-2 py-1 text-xs"
                      placeholder="Label"
                    />
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.id, { type: e.target.value as FormField["type"] })
                      }
                      className="w-full rounded-md border border-[#2a2a2b] bg-[#0f0f10] px-2 py-1 text-xs"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                    </select>
                    <input
                      value={field.placeholder || ""}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      className="w-full rounded-md border border-[#2a2a2b] bg-[#0f0f10] px-2 py-1 text-xs"
                      placeholder="Placeholder"
                    />
                    {field.type === "select" && (
                      <input
                        value={field.options || ""}
                        onChange={(e) => updateField(field.id, { options: e.target.value })}
                        className="w-full rounded-md border border-[#2a2a2b] bg-[#0f0f10] px-2 py-1 text-xs"
                        placeholder="Option 1, Option 2"
                      />
                    )}
                    <label className="flex items-center gap-2 text-[11px] text-[#9b9ba3]">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>
              <button
                onClick={handleInsertForm}
                className="inline-flex items-center gap-2 rounded-md bg-[#4a90e2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5ba0f2]"
              >
                <MdOutlineOpenInNew /> Insert Form In Page
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a2b] bg-[#141415] p-4">
            <h3 className="text-sm font-semibold mb-3">Detected Forms</h3>
            {(siteGraph?.forms || []).length === 0 && (
              <p className="text-xs text-[#7d7d84]">No forms detected yet.</p>
            )}
            <div className="space-y-2">
              {(siteGraph?.forms || []).map((form) => (
                <div
                  key={form.id}
                  className="rounded-lg border border-[#2a2a2b] bg-[#111116] px-3 py-2"
                >
                  <p className="text-xs font-medium">{form.name || form.id}</p>
                  <p className="text-[11px] text-[#7d7d84]">{form.page}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-6 text-xs text-[#7d7d84]">Refreshing site graph…</div>
      )}
    </div>
  );
};

export default PagesManager;

/**
 * WYSIWYG Editor Script
 * This script is injected into the iframe to enable live editing of elements
 */

(function () {
  'use strict';

  let editMode = false;
  let inspectorMode = false;
  let selectedElement = null;
  let originalContent = null;
  let isEditing = false;
  let cachedSelectionRange = null;
  let delegatedEditClickHandler = null;
  let mutationObserver = null;
  let selectedBlockId = null;
  let mediumEditorInstance = null;
  let mediumEditorLoading = null;

  function queryBlockElementById(blockId) {
    if (!blockId) return null;
    try {
      if (typeof CSS !== 'undefined' && CSS.escape) {
        return document.querySelector(
          '[data-sb-block-id="' + CSS.escape(blockId) + '"]'
        );
      }
    } catch (e) {
      /* fall through */
    }
    return document.querySelector('[data-sb-block-id="' + blockId + '"]');
  }

  const MEDIUM_EDITOR_ASSETS = {
    js: "https://cdn.jsdelivr.net/npm/medium-editor@5.23.3/dist/js/medium-editor.min.js",
    css: [
      "https://cdn.jsdelivr.net/npm/medium-editor@5.23.3/dist/css/medium-editor.min.css",
      "https://cdn.jsdelivr.net/npm/medium-editor@5.23.3/dist/css/themes/default.min.css"
    ]
  };

  // Styles for edit mode
  const editModeStyles = `
    .wysiwyg-editable {
      position: relative;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }
    
    /* Only show dashed outline on hover to avoid overwhelming the view */
    .wysiwyg-editable:hover {
      outline: 2px dashed #4a90e2 !important;
      outline-offset: 2px !important;
      background-color: rgba(74, 144, 226, 0.05) !important;
      z-index: 10001 !important;
    }
    
    .wysiwyg-editing {
      outline: 2px solid #4a90e2 !important;
      background-color: rgba(74, 144, 226, 0.1) !important;
      z-index: 10002 !important;
    }
    
    .wysiwyg-image-editable {
      position: relative;
      cursor: pointer !important;
    }
    
    .wysiwyg-image-editable:hover {
      outline: 2px dashed #4a90e2 !important;
    }
    
    .wysiwyg-image-editable::after {
      content: '🖼️';
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(74, 144, 226, 0.9);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .wysiwyg-image-editable:hover::after {
      opacity: 1;
    }
    
    .wysiwyg-toolbar {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(20, 20, 21, 0.95);
      border: 1px solid #2a2a2b;
      border-radius: 8px;
      padding: 8px;
      z-index: 999999;
      display: flex;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .wysiwyg-toolbar button {
      background: #4a90e2;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
      font-weight: 500;
    }
    
    .wysiwyg-toolbar button:hover {
      background: #5ba0f2;
    }
    
    .wysiwyg-toolbar button:disabled {
      background: #2a2a2b;
      cursor: not-allowed;
      opacity: 0.5;
    }
    
    .wysiwyg-block-highlight {
      box-shadow: 0 0 0 2px #4a90e2;
      border-radius: 8px;
    }

    .wysiwyg-block-selected {
      box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.9), 0 0 0 6px rgba(74, 144, 226, 0.18);
      border-radius: 10px;
    }

    .medium-editor-toolbar {
      border-radius: 10px !important;
      border: 1px solid rgba(42, 42, 43, 0.85) !important;
      background: rgba(20, 20, 21, 0.96) !important;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35) !important;
    }

    .medium-editor-toolbar .medium-editor-action {
      background: transparent !important;
      color: #e5e7eb !important;
    }

    .medium-editor-toolbar .medium-editor-action:hover,
    .medium-editor-toolbar .medium-editor-action.medium-editor-button-active {
      color: #4a90e2 !important;
      background: rgba(74, 144, 226, 0.12) !important;
    }
  `;

  // Inject styles - with safety checks
  function injectStyles() {
    try {
      // Double check if styles already exist
      if (document.getElementById('wysiwyg-styles')) {
        return;
      }

      if (!document.head) {
        console.warn('[WYSIWYG] document.head not available yet');
        return;
      }

      // Check if head is still in the document
      if (!document.head.parentNode) {
        console.warn('[WYSIWYG] document.head is detached');
        return;
      }

      const style = document.createElement('style');
      style.id = 'wysiwyg-styles';
      style.textContent = editModeStyles;

      // Final check before appending
      if (document.head && document.head.parentNode && !document.getElementById('wysiwyg-styles')) {
        try {
          document.head.appendChild(style);
        } catch (appendError) {
          // If append fails, try insertBefore as fallback
          if (document.head.firstChild) {
            document.head.insertBefore(style, document.head.firstChild);
          } else {
            document.head.appendChild(style);
          }
        }
      }
    } catch (error) {
      console.warn('[WYSIWYG] Error injecting styles:', error);
      // Non-critical error, don't break the page
    }
  }

  function loadMediumEditor() {
    if (window.MediumEditor) return Promise.resolve();
    if (mediumEditorLoading) return mediumEditorLoading;

    mediumEditorLoading = new Promise((resolve, reject) => {
      try {
        MEDIUM_EDITOR_ASSETS.css.forEach((href, index) => {
          const id = `medium-editor-css-${index}`;
          if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
          }
        });

        if (!document.getElementById('medium-editor-js')) {
          const script = document.createElement('script');
          script.id = 'medium-editor-js';
          script.src = MEDIUM_EDITOR_ASSETS.js;
          script.onload = () => resolve();
          script.onerror = (err) => reject(err);
          document.head.appendChild(script);
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });

    return mediumEditorLoading;
  }

  function ensureMediumEditor(elements) {
    if (!elements || elements.length === 0) return;
    loadMediumEditor()
      .then(() => {
        if (!window.MediumEditor) return;
        if (mediumEditorInstance) {
          if (typeof mediumEditorInstance.addElements === 'function') {
            mediumEditorInstance.addElements(elements);
            return;
          }
          mediumEditorInstance.destroy();
          mediumEditorInstance = null;
        }
        mediumEditorInstance = new window.MediumEditor(elements, {
          toolbar: {
            buttons: [
              'bold',
              'italic',
              'underline',
              'anchor',
              'h2',
              'h3',
              'unorderedlist',
              'orderedlist',
              'quote'
            ],
          },
          placeholder: false,
          autoLink: true,
          imageDragging: false,
          targetBlank: true,
        });
      })
      .catch((error) => {
        console.warn('[WYSIWYG] Failed to load MediumEditor:', error);
      });
  }

  function refreshMediumEditor(elements) {
    if (!mediumEditorInstance || !elements || elements.length === 0) return;
    if (typeof mediumEditorInstance.addElements === 'function') {
      try {
        mediumEditorInstance.addElements(elements);
      } catch (error) {
        console.warn('[WYSIWYG] Failed to refresh MediumEditor elements:', error);
      }
    }
  }

  function destroyMediumEditor() {
    if (mediumEditorInstance && typeof mediumEditorInstance.destroy === 'function') {
      try {
        mediumEditorInstance.destroy();
      } catch (error) {
        console.warn('[WYSIWYG] Failed to destroy MediumEditor:', error);
      }
    }
    mediumEditorInstance = null;
  }

  // Create toolbar - with safety checks
  function createToolbar() {
    try {
      if (document.getElementById('wysiwyg-toolbar')) return;
      if (!document.body) {
        console.warn('[WYSIWYG] document.body not available yet');
        return;
      }

      const toolbar = document.createElement('div');
      toolbar.id = 'wysiwyg-toolbar';
      toolbar.className = 'wysiwyg-toolbar';
      toolbar.innerHTML = `
        <button id="wysiwyg-save" disabled>💾 Save</button>
        <button id="wysiwyg-cancel" disabled>✖ Cancel</button>
      `;

      // Ensure body exists and toolbar isn't already there
      if (document.body && !document.getElementById('wysiwyg-toolbar')) {
        document.body.appendChild(toolbar);
      }

      // Set up event listeners
      const saveBtn = document.getElementById('wysiwyg-save');
      const cancelBtn = document.getElementById('wysiwyg-cancel');

      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          saveChanges();
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          cancelEdit();
        });
      }
    } catch (error) {
      console.warn('[WYSIWYG] Error creating toolbar:', error);
    }
  }

  // Remove toolbar - with safety checks
  function removeToolbar() {
    try {
      const toolbar = document.getElementById('wysiwyg-toolbar');
      if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.removeChild(toolbar);
      } else if (toolbar) {
        toolbar.remove();
      }
    } catch (error) {
      console.warn('[WYSIWYG] Error removing toolbar:', error);
    }
  }

  // Get editable elements - REFINED to prefer specific text tags over generic containers
  function getEditableElements() {
    // Precise text elements
    const primaryTags = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'li', 'button', 'label', 'span',
      'strong', 'em', 'b', 'i', 'td', 'th'
    ];

    const elements = [];

    // We want to find EVERY text-bearing element
    primaryTags.forEach(tag => {
      const nodes = document.querySelectorAll(tag);
      nodes.forEach(node => {
        // Skip hidden elements, scripts, styles
        if (node.offsetWidth > 0 &&
          node.offsetHeight > 0 &&
          node.textContent.trim() &&
          !node.querySelector('script') &&
          !node.querySelector('style')) {
          elements.push(node);
        }
      });
    });

    // Also include DIVs but ONLY if they contain direct text nodes and aren't massive layout wrappers
    const divs = document.querySelectorAll('div');
    divs.forEach(div => {
      // Check if div has direct text content
      let hasDirectText = false;
      for (const child of div.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
          hasDirectText = true;
          break;
        }
      }

      // If it has direct text and isn't too large (likely a component part, not a layout section)
      if (hasDirectText && div.offsetWidth < 800) {
        elements.push(div);
      }
    });

    return elements;
  }

  // Get image elements
  function getImageElements() {
    const images = document.querySelectorAll('img');
    return Array.from(images).filter(img => {
      return img.offsetWidth > 0 && img.src;
    });
  }

  // Refresh editable elements (call this periodically or after DOM changes)
  function refreshEditableElements() {
    if (!editMode) return;

    const textElements = getEditableElements();
    const imageElements = getImageElements();

    // Make text elements editable
    textElements.forEach(el => {
      if (!el.classList.contains('wysiwyg-editable')) {
        el.classList.add('wysiwyg-editable');
      }
    });

    // Make images editable
    imageElements.forEach(img => {
      if (!img.classList.contains('wysiwyg-image-editable')) {
        img.classList.add('wysiwyg-image-editable');
      }
    });

    refreshMediumEditor(textElements);

    console.log('[WYSIWYG] Refreshed editable elements:', textElements.length, 'text,', imageElements.length, 'images');
  }

  // Enable edit mode
  function enableEditMode() {
    if (editMode) {
      console.log('[WYSIWYG] Edit mode already enabled, refreshing elements');
      refreshEditableElements();
      return;
    }
    // Disable inspector mode if active
    if (inspectorMode) {
      disableInspectorMode();
    }
    console.log('[WYSIWYG] Enabling edit mode');
    editMode = true;
    injectStyles();
    createToolbar();

    const textElements = getEditableElements();
    const imageElements = getImageElements();

    // Make text elements editable
    textElements.forEach(el => {
      el.classList.add('wysiwyg-editable');
    });

    // Make images editable
    imageElements.forEach(img => {
      img.classList.add('wysiwyg-image-editable');
    });

    console.log('[WYSIWYG] Marked', textElements.length, 'text elements and', imageElements.length, 'images as editable');

    ensureMediumEditor(textElements);

    // Delegated click handler (more reliable across rerenders)
    if (!delegatedEditClickHandler) {
      delegatedEditClickHandler = function (e) {
        if (!editMode) {
          console.log('[WYSIWYG] Delegated handler: editMode is false');
          return;
        }

        const target = e.target;
        if (!target || target === document.body || target === document.documentElement) {
          console.log('[WYSIWYG] Delegated handler: invalid target');
          return;
        }

        // Ignore clicks inside WYSIWYG UI
        if (
          target.closest('#wysiwyg-toolbar') ||
          target.closest('#wysiwyg-image-modal') ||
          target.closest('#wysiwyg-image-modal-backdrop')
        ) {
          console.log('[WYSIWYG] Delegated handler: click inside WYSIWYG UI, ignoring');
          return;
        }

        console.log('[WYSIWYG] Delegated handler: click on', target.tagName, target.className);

        // Image - check if target is img or inside an img
        let img = null;
        if (target.tagName && target.tagName.toLowerCase() === 'img') {
          img = target;
        } else if (target.closest) {
          img = target.closest('img');
        }

        if (img && img.tagName && img.tagName.toLowerCase() === 'img' && img.src) {
          console.log('[WYSIWYG] Delegated handler: detected image click');
          handleImageClickInternal(img, e);
          return;
        }

        // Text - check if target or parent has wysiwyg-editable class or is an editable element
        let textTarget = null;

        // First check if target itself is editable (by class or by element type)
        if (target.classList && target.classList.contains('wysiwyg-editable')) {
          textTarget = target;
        } else if (isEditableTextElement(target)) {
          // Target is editable even if it doesn't have the class yet
          textTarget = target;
          // Add the class if missing
          if (!target.classList.contains('wysiwyg-editable')) {
            target.classList.add('wysiwyg-editable');
          }
        } else if (target.closest) {
          // Check if target is inside an editable element
          const editableParent = target.closest('.wysiwyg-editable');
          if (editableParent) {
            textTarget = editableParent;
          } else {
            // Try to find any editable text element by walking up the tree
            textTarget = findEditableTextTarget(target);
            // If found, make sure it has the class
            if (textTarget && !textTarget.classList.contains('wysiwyg-editable')) {
              textTarget.classList.add('wysiwyg-editable');
            }
          }
        }

        if (textTarget) {
          console.log('[WYSIWYG] Delegated handler: detected text click on', textTarget.tagName, textTarget.className);
          handleTextElementClickInternal(textTarget, e);
        } else {
          console.log('[WYSIWYG] Delegated handler: no editable text target found for', target.tagName, target.className);
        }
      };
    }
    document.addEventListener('click', delegatedEditClickHandler, true);
    console.log('[WYSIWYG] Delegated click handler attached. Found', textElements.length, 'text elements and', imageElements.length, 'images');

    // Watch for dynamically added elements
    if (!mutationObserver) {
      mutationObserver = new MutationObserver((mutations) => {
        if (!editMode) return;

        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if it's a text element
              if (isEditableTextElement(node)) {
                node.classList.add('wysiwyg-editable');
                console.log('[WYSIWYG] Added editable class to new element:', node.tagName);
              }
              // Check if it's an image
              if (node.tagName && node.tagName.toLowerCase() === 'img' && node.src) {
                node.classList.add('wysiwyg-image-editable');
                console.log('[WYSIWYG] Added editable class to new image');
              }
              // Check children
              const textChildren = node.querySelectorAll ? node.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,li,button,label,span,strong,em,b,i,td,th,div') : [];
              textChildren.forEach(child => {
                if (isEditableTextElement(child) && !child.classList.contains('wysiwyg-editable')) {
                  child.classList.add('wysiwyg-editable');
                }
              });
              const imgChildren = node.querySelectorAll ? node.querySelectorAll('img') : [];
              imgChildren.forEach(img => {
                if (img.src && !img.classList.contains('wysiwyg-image-editable')) {
                  img.classList.add('wysiwyg-image-editable');
                }
              });
            }
          });
        });
      });
    }

    // Start observing
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('[WYSIWYG] MutationObserver started');

    // Refresh editable elements periodically to catch any missed elements
    const refreshInterval = setInterval(() => {
      if (editMode) {
        refreshEditableElements();
      } else {
        clearInterval(refreshInterval);
      }
    }, 2000);

    document.addEventListener('click', preventDefaultInEditMode, true);
  }

  // Disable edit mode
  function disableEditMode() {
    if (!editMode) return;
    console.log('[WYSIWYG] Disabling edit mode');
    editMode = false;
    isEditing = false;
    selectedElement = null;
    originalContent = null;
    clearBlockSelection();
    selectedBlockId = null;
    destroyMediumEditor();

    // Remove editable classes - with safety checks
    try {
      document.querySelectorAll('.wysiwyg-editable').forEach(el => {
        try {
          el.classList.remove('wysiwyg-editable', 'wysiwyg-editing');
          el.removeEventListener('click', handleTextElementClick, true);
          el.contentEditable = 'false';
        } catch (e) {
          // Element might have been removed, ignore
        }
      });

      document.querySelectorAll('.wysiwyg-image-editable').forEach(img => {
        try {
          img.classList.remove('wysiwyg-image-editable', 'wysiwyg-editing');
          img.removeEventListener('click', handleImageClick, true);
        } catch (e) {
          // Element might have been removed, ignore
        }
      });
    } catch (error) {
      console.warn('[WYSIWYG] Error removing editable classes:', error);
    }

    document.removeEventListener('click', preventDefaultInEditMode, true);
    if (delegatedEditClickHandler) {
      document.removeEventListener('click', delegatedEditClickHandler, true);
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      console.log('[WYSIWYG] MutationObserver stopped');
    }
    removeToolbar();
  }

  // Prevent default behavior in edit mode
  function preventDefaultInEditMode(e) {
    if (!editMode) return;

    const isWysiwygElement = e.target.closest('.wysiwyg-editable') ||
      e.target.closest('.wysiwyg-image-editable') ||
      e.target.closest('.wysiwyg-toolbar');

    if (isWysiwygElement) {
      // If it's a link or button, we must block its normal action while in edit mode
      const link = e.target.closest('a');
      const button = e.target.closest('button');
      const form = e.target.closest('form');

      if (link && !link.hasAttribute('data-original-href')) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (button && button.type === 'submit') {
        e.preventDefault();
        e.stopPropagation();
      }
      if (form) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  function isEditableTextElement(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (!el.tagName) return false;
    if (!el.textContent || !el.textContent.trim()) return false;
    if (el.closest && (el.closest('#wysiwyg-toolbar') || el.closest('#wysiwyg-image-modal'))) return false;

    const tag = el.tagName.toLowerCase();
    const allowed = new Set([
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'li', 'button', 'label', 'span',
      'strong', 'em', 'b', 'i', 'td', 'th', 'div'
    ]);
    if (!allowed.has(tag)) return false;

    // Avoid huge layout wrappers
    if (tag === 'div') {
      if (el.offsetWidth >= 900) return false;
      let hasDirectText = false;
      for (const child of el.childNodes || []) {
        if (child && child.nodeType === Node.TEXT_NODE && child.textContent && child.textContent.trim().length > 0) {
          hasDirectText = true;
          break;
        }
      }
      if (!hasDirectText) return false;
    }

    return true;
  }

  function findEditableTextTarget(node) {
    if (!node) return null;

    // First check if node itself is editable
    if (isEditableTextElement(node)) {
      return node;
    }

    // If node has closest method, use it
    if (node.closest) {
      const selector = 'h1,h2,h3,h4,h5,h6,p,a,li,button,label,span,strong,em,b,i,td,th,div';
      const candidate = node.closest(selector);
      if (candidate && isEditableTextElement(candidate)) {
        return candidate;
      }
    }

    // Fallback: walk up the DOM tree
    let current = node.parentElement;
    let depth = 0;
    while (current && depth < 10) { // Limit depth to avoid infinite loops
      if (isEditableTextElement(current)) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }

    return null;
  }

  function generateBlockId() {
    return `sb-block-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function ensureBlockId(el) {
    if (!el) return null;
    let id = el.getAttribute('data-sb-block-id');
    if (!id) {
      id = generateBlockId();
      el.setAttribute('data-sb-block-id', id);
    }
    return id;
  }

  function findBlockElement(el) {
    if (!el || !el.closest) return null;
    const withId = el.closest('[data-sb-block-id]');
    if (withId) return withId;
    return el.closest('section,article,header,footer,main,div');
  }

  function clearBlockSelection() {
    if (selectedBlockId) {
      const prev = queryBlockElementById(selectedBlockId);
      if (prev) prev.classList.remove('wysiwyg-block-selected');
    }
  }

  function getPagePath() {
    const bodyAttr = document.body?.getAttribute('data-sb-page');
    if (bodyAttr) return bodyAttr;
    const path = window.location?.pathname || '';
    const clean = path.replace(/^\/+/, '');
    return clean || 'index.html';
  }

  function sendBlockSelection(blockEl, blockId) {
    if (!window.parent || !blockEl) return;
    try {
      window.parent.postMessage({
        type: 'WYSIWYG_BLOCK_SELECTED',
        payload: {
          blockId,
          html: blockEl.outerHTML,
          selector: getElementSelector(blockEl),
          page: getPagePath()
        }
      }, '*');
    } catch (error) {
      console.warn('[WYSIWYG] Failed to send block selection', error);
    }
  }

  function selectBlockFromElement(el) {
    const blockEl = findBlockElement(el);
    if (!blockEl) return;
    const blockId = ensureBlockId(blockEl);
    if (!blockId) return;
    // Same block id after DOM replace (e.g. Apply): re-attach selection chrome without re-posting to parent.
    if (blockId === selectedBlockId) {
      clearBlockSelection();
      selectedBlockId = blockId;
      blockEl.classList.add('wysiwyg-block-selected');
      return;
    }

    clearBlockSelection();
    selectedBlockId = blockId;
    blockEl.classList.add('wysiwyg-block-selected');
    sendBlockSelection(blockEl, blockId);
  }

  // Handle text element click
  function handleTextElementClick(e) {
    return handleTextElementClickInternal(e.currentTarget, e);
  }

  function handleTextElementClickInternal(element, e) {
    if (!editMode || !element) {
      console.log('[WYSIWYG] handleTextElementClickInternal: editMode=', editMode, 'element=', !!element);
      return;
    }

    console.log('[WYSIWYG] handleTextElementClickInternal: starting edit on', element.tagName, element.className);

    // If we're already editing this element, allow normal cursor placement
    if (isEditing && selectedElement === element) {
      console.log('[WYSIWYG] Already editing this element');
      return;
    }

    // If we're editing a different element, cancel that first
    if (isEditing && selectedElement && selectedElement !== element) {
      console.log('[WYSIWYG] Canceling previous edit');
      cancelEdit();
    }

    // Prevent all default behaviors that might cause navigation / lost selection
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    selectedElement = element;
    originalContent = element.innerHTML;
    selectBlockFromElement(element);
    element.classList.add('wysiwyg-editing');
    console.log('[WYSIWYG] Element prepared for editing, contenteditable will be set');

    element.setAttribute('contenteditable', 'true');
    element.setAttribute('spellcheck', 'false');

    // Disable links safely while editing (avoid javascript: URLs)
    const links = element.querySelectorAll('a[href]');
    links.forEach(link => {
      try {
        link.style.pointerEvents = 'none';
        link.setAttribute('data-original-href', link.getAttribute('href') || '');
        link.removeAttribute('href');
      } catch (_) { }
    });

    // Focus + selection
    setTimeout(() => {
      try {
        element.focus();
        console.log('[WYSIWYG] Element focused, creating selection');
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        cachedSelectionRange = range.cloneRange();
        console.log('[WYSIWYG] Selection created and cached');
      } catch (err) {
        console.error('[WYSIWYG] Could not focus/select element:', err);
      }
    }, 10);

    isEditing = true;
    updateToolbar();

    element.removeEventListener('keydown', handleTextKeydown);
    element.addEventListener('keydown', handleTextKeydown, true);

    element.removeEventListener('blur', handleTextBlur);
    element.addEventListener('blur', handleTextBlur, { once: true });
  }

  // Handle text blur - save when clicking outside
  function handleTextBlur(e) {
    // Small delay to allow save button click to register
    setTimeout(() => {
      if (selectedElement && isEditing) {
        // Check if blur was caused by clicking save/cancel button
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.id === 'wysiwyg-save' ||
          activeElement.id === 'wysiwyg-cancel' ||
          activeElement.closest('#wysiwyg-toolbar')
        )) {
          return; // Don't auto-save if clicking toolbar
        }
        saveTextEdit();
      }
    }, 100);
  }

  // Handle text keydown
  function handleTextKeydown(e) {
    // Prevent any navigation or form submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (selectedElement) {
        selectedElement.blur();
        setTimeout(() => saveChanges(), 50);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
    }
    // Allow all other keys to work normally for editing
  }

  // Save text edit
  function saveTextEdit() {
    if (!selectedElement || !isEditing) return;

    // Restore links before getting content
    const links = selectedElement.querySelectorAll('a[data-original-href]');
    links.forEach(link => {
      link.href = link.getAttribute('data-original-href') || '#';
      link.removeAttribute('data-original-href');
      link.style.pointerEvents = '';
    });

    const newContent = selectedElement.innerHTML;
    const hasChanges = newContent !== originalContent;

    if (hasChanges) {
      console.log('[WYSIWYG] Saving text edit, sending to parent via postMessage');

      // Notify parent of the specific element change via postMessage
      // Use a debounced approach to avoid too many saves
      sendChangeToParent({
        type: 'TEXT_EDIT',
        element: {
          tag: selectedElement.tagName.toLowerCase(),
          selector: getElementSelector(selectedElement),
          id: selectedElement.id || '',
          oldContent: originalContent,
          newContent: newContent,
          html: selectedElement.outerHTML,
          // Include full HTML for cross-origin safety
          fullHtml: document.documentElement.outerHTML
        }
      });

      // Persist the full document state (debounced)
      clearTimeout(window.wysiwygSaveTimeout);
      window.wysiwygSaveTimeout = setTimeout(() => {
        triggerFullHtmlSave('TEXT_EDIT');
      }, 500);
    }

    // Cleanup UI state
    selectedElement.removeAttribute('contenteditable');
    selectedElement.classList.remove('wysiwyg-editing');
    selectedElement.removeEventListener('keydown', handleTextKeydown);
    selectedElement.removeEventListener('blur', handleTextBlur);

    const wasEditing = isEditing;
    const elementToSave = selectedElement;
    selectedElement = null;
    originalContent = null;
    isEditing = false;
    updateToolbar();

    // Show success feedback if changes were made
    if (hasChanges && wasEditing) {
      const saveBtn = document.getElementById('wysiwyg-save');
      if (saveBtn) {
        saveBtn.textContent = '✅ Saved';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save';
          saveBtn.style.background = '#4a90e2';
        }, 2000);
      }
    }
  }

  // Handle image click
  function handleImageClick(e) {
    return handleImageClickInternal(e.currentTarget, e);
  }

  function handleImageClickInternal(img, e) {
    if (!editMode) {
      console.log('[WYSIWYG] Edit mode not enabled');
      return;
    }
    if (!img) return;

    console.log('[WYSIWYG] Image clicked', img);

    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }

    // If already showing modal for this image, don't create another
    const existingModal = document.getElementById('wysiwyg-image-modal');
    if (existingModal) {
      console.log('[WYSIWYG] Modal already showing, removing old one');
      existingModal.remove();
    }

    // If editing a different element, cancel that first
    if (isEditing && selectedElement && selectedElement !== img) {
      cancelEdit();
    }

    selectedElement = img;
    originalContent = img.src;
    selectBlockFromElement(img);
    img.classList.add('wysiwyg-editing');

    isEditing = true;
    updateToolbar();

    // Create modal backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'wysiwyg-image-modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'wysiwyg-image-modal';
    modal.style.cssText = `
      position: relative;
      background: rgba(20, 20, 21, 0.98);
      border: 2px solid #4a90e2;
      border-radius: 12px;
      padding: 24px;
      z-index: 999999;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      font-family: system-ui, -apple-system, sans-serif;
      min-width: 320px;
      max-width: 90vw;
    `;
    modal.innerHTML = `
      <div style="color: white; margin-bottom: 16px; font-size: 18px; font-weight: 600;">
        🖼️ Swap Image
      </div>
      <div style="color: #b1b1b7; margin-bottom: 20px; font-size: 14px;">
        Choose a new image to replace this one
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="wysiwyg-image-select" style="
          background: #4a90e2;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        ">Choose Image</button>
        <button id="wysiwyg-image-cancel" style="
          background: transparent;
          color: #b1b1b7;
          border: 1px solid #2a2a2b;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        ">Cancel</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    console.log('[WYSIWYG] Modal created and appended');

    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    // Cleanup function
    const cleanup = () => {
      const modalEl = document.getElementById('wysiwyg-image-modal');
      const backdropEl = document.getElementById('wysiwyg-image-modal-backdrop');
      if (modalEl && modalEl.parentNode) modalEl.remove();
      if (backdropEl && backdropEl.parentNode) backdropEl.remove();
      if (input && input.parentNode) input.remove();
      if (img) img.classList.remove('wysiwyg-editing');
    };

    // Event handlers
    const handleImageSelect = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      console.log('[WYSIWYG] Image select button clicked');
      input.click();
    };

    const handleImageCancel = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      console.log('[WYSIWYG] Image cancel button clicked');
      cleanup();
      cancelEdit();
    };

    // Attach event listeners immediately
    const selectBtn = document.getElementById('wysiwyg-image-select');
    const cancelBtn = document.getElementById('wysiwyg-image-cancel');

    if (selectBtn && cancelBtn) {
      selectBtn.addEventListener('click', handleImageSelect, { once: false });
      cancelBtn.addEventListener('click', handleImageCancel, { once: false });

      // Close on backdrop click
      backdrop.addEventListener('click', (ev) => {
        if (ev.target === backdrop) {
          handleImageCancel(ev);
        }
      }, { once: false });

      // Handle file selection
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          console.log('[WYSIWYG] Image file selected:', file.name);
          const reader = new FileReader();
          reader.onload = (event) => {
            const newSrc = event.target.result;
            img.src = newSrc;

            // Send change to parent via postMessage
            sendChangeToParent({
              type: 'IMAGE_SWAP',
              element: {
                tag: 'img',
                selector: getElementSelector(img),
                id: img.id || '',
                oldSrc: originalContent,
                newSrc: newSrc,
                html: img.outerHTML,
                fullHtml: document.documentElement.outerHTML
              }
            });

            // Also trigger full HTML save
            triggerFullHtmlSave('IMAGE_SWAP');

            cleanup();
            selectedElement = null;
            originalContent = null;
            isEditing = false;
            updateToolbar();

            // Show success feedback
            const successMsg = document.createElement('div');
            successMsg.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #28a745;
              color: white;
              padding: 12px 20px;
              border-radius: 8px;
              z-index: 1000000;
              font-size: 14px;
              font-weight: 500;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            successMsg.textContent = '✅ Image updated successfully!';
            document.body.appendChild(successMsg);
            setTimeout(() => {
              if (successMsg.parentNode) successMsg.remove();
            }, 3000);
          };
          reader.onerror = (err) => {
            console.error('[WYSIWYG] Error reading image file:', err);
            cleanup();
            cancelEdit();
          };
          reader.readAsDataURL(file);
        } else {
          handleImageCancel(e);
        }
      }, { once: false });
    } else {
      console.error('[WYSIWYG] Could not find modal buttons');
      cleanup();
      cancelEdit();
    }
  }

  // Get element selector
  function getElementSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = Array.from(element.classList)
        .filter(c => typeof c === 'string' && !c.startsWith('wysiwyg-'))
        .join('.');
      if (classes) {
        selector += '.' + classes;
      }
    }

    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      if (index >= 0) {
        selector += `:nth-child(${index + 1})`;
      }
    }

    return selector;
  }

  // Send change to parent window
  function sendChangeToParent(data) {
    if (window.parent) {
      try {
        const message = {
          type: 'WYSIWYG_CHANGE',
          payload: data
        };
        console.log('[WYSIWYG] Sending message to parent:', message);
        window.parent.postMessage(message, '*');
      } catch (error) {
        console.error('[WYSIWYG] Error sending message to parent:', error);
      }
    } else {
      console.warn('[WYSIWYG] No parent window found');
    }
  }

  function triggerFullHtmlSave(type = 'TEXT_EDIT') {
    // Send full document state to parent (debounced to avoid too many saves)
    clearTimeout(window.wysiwygFullSaveTimeout);
    window.wysiwygFullSaveTimeout = setTimeout(() => {
      try {
        const fullHtml = document.documentElement.outerHTML;
        sendChangeToParent({
          type: 'PAGE_SAVE',
          element: {
            tag: 'html',
            selector: 'html',
            html: fullHtml,
            fullHtml: fullHtml
          }
        });
        console.log('[WYSIWYG] Full HTML save triggered');
      } catch (error) {
        console.error('[WYSIWYG] Error in triggerFullHtmlSave:', error);
      }
    }, 300);
  }

  // Send HTML to parent when requested (for cross-origin safety)
  function sendHtmlToParent() {
    const fullHtml = document.documentElement.outerHTML;
    if (window.parent) {
      window.parent.postMessage({
        type: 'WYSIWYG_HTML_RESPONSE',
        html: fullHtml
      }, '*');
      console.log('[WYSIWYG] Sent HTML to parent');
    }
  }

  // Save changes
  function saveChanges() {
    if (!selectedElement || !isEditing) {
      // If no element is selected but we're in edit mode, save the entire document
      if (editMode) {
        triggerFullHtmlSave('PAGE_SAVE');
        const saveBtn = document.getElementById('wysiwyg-save');
        if (saveBtn) {
          saveBtn.textContent = '✅ Saved';
          saveBtn.style.background = '#28a745';
          setTimeout(() => {
            saveBtn.textContent = '💾 Save';
            saveBtn.style.background = '#4a90e2';
            saveBtn.disabled = true;
          }, 2000);
        }
      }
      return;
    }

    const saveBtn = document.getElementById('wysiwyg-save');
    if (saveBtn) saveBtn.textContent = '⏳ Saving...';

    if (selectedElement.tagName.toLowerCase() === 'img') {
      // For images, the swap is already handled in handleImageClick
      // Just cleanup the state
      isEditing = false;
      selectedElement.classList.remove('wysiwyg-editing');
      selectedElement = null;
      updateToolbar();
    } else {
      saveTextEdit();
    }
  }

  // Cancel edit
  function cancelEdit() {
    if (!selectedElement) return;

    if (selectedElement.tagName.toLowerCase() === 'img') {
      selectedElement.classList.remove('wysiwyg-editing');
      if (originalContent) {
        selectedElement.src = originalContent;
      }
    } else {
      // Restore links before restoring content
      const links = selectedElement.querySelectorAll('a[data-original-href]');
      links.forEach(link => {
        link.href = link.getAttribute('data-original-href') || '#';
        link.removeAttribute('data-original-href');
        link.style.pointerEvents = '';
      });

      if (originalContent !== null) {
        selectedElement.innerHTML = originalContent;
      }
      selectedElement.removeAttribute('contenteditable');
      selectedElement.classList.remove('wysiwyg-editing');
      selectedElement.removeEventListener('keydown', handleTextKeydown);
      selectedElement.removeEventListener('blur', handleTextBlur);
    }

    selectedElement = null;
    originalContent = null;
    isEditing = false;
    updateToolbar();
  }

  // Update toolbar state
  function updateToolbar() {
    const saveBtn = document.getElementById('wysiwyg-save');
    const cancelBtn = document.getElementById('wysiwyg-cancel');

    if (saveBtn && cancelBtn) {
      const hasSelection = selectedElement !== null;
      saveBtn.disabled = !hasSelection;
      cancelBtn.disabled = !hasSelection;

      if (!isEditing && saveBtn.textContent === '⏳ Saving...') {
        saveBtn.textContent = '💾 Save';
      }
    }
  }

  // Inspector mode functionality
  function enableInspectorMode() {
    if (inspectorMode) return;
    // Disable edit mode if active
    if (editMode) {
      disableEditMode();
    }
    inspectorMode = true;
    document.body.style.cursor = 'crosshair';

    // Add click handler for inspector
    document.addEventListener('click', handleInspectorClick, true);

    // Add hover effect
    const style = document.createElement('style');
    style.id = 'inspector-styles';
    style.textContent = `
      * {
        cursor: crosshair !important;
      }
      *:hover {
        outline: 2px solid #4a90e2 !important;
        outline-offset: 2px !important;
        background-color: rgba(74, 144, 226, 0.1) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function disableInspectorMode() {
    inspectorMode = false;
    document.body.style.cursor = '';
    document.removeEventListener('click', handleInspectorClick, true);

    const style = document.getElementById('inspector-styles');
    if (style) {
      style.remove();
    }
  }

  function handleInspectorClick(e) {
    if (!inspectorMode) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    if (!element || element === document.body || element === document.documentElement) return;

    // Get element information
    const tagName = element.tagName.toLowerCase();
    const id = element.id || '';
    const className = element.className || '';
    const selector = id ? `#${id}` : className ? `.${className.split(' ')[0]}` : tagName;

    // Try to extract code information
    const outerHTML = element.outerHTML;
    const innerHTML = element.innerHTML;

    // Estimate line numbers (rough approximation)
    const bodyHTML = document.body.innerHTML;
    const elementIndex = bodyHTML.indexOf(outerHTML.substring(0, 50));
    const linesBefore = bodyHTML.substring(0, elementIndex).split('\n').length;

    // Send message to parent
    window.parent.postMessage({
      type: 'SUPERBLOCKS_INSPECTOR',
      msg: 'ELEMENT_CLICKED',
      filePath: 'pages/index.html', // Default, could be improved
      startLine: linesBefore,
      endLine: linesBefore + outerHTML.split('\n').length,
      code: outerHTML,
      selector: selector,
      tag: tagName
    }, '*');

    // Visual feedback
    element.style.outline = '3px solid #4a90e2';
    element.style.outlineOffset = '3px';
    setTimeout(() => {
      element.style.outline = '';
      element.style.outlineOffset = '';
    }, 500);
  }

  // Listen for messages from parent
  window.addEventListener('message', (event) => {
    // Handle inspector mode
    if (event.data && event.data.type === 'SUPERBLOCKS_INSPECTOR') {
      if (event.data.msg === 'ENABLE_INSPECTOR') {
        enableInspectorMode();
      } else if (event.data.msg === 'DISABLE_INSPECTOR') {
        disableInspectorMode();
      }
    }

    if (event.data && event.data.type === 'WYSIWYG_EDIT_MODE') {
      console.log('[WYSIWYG] Received WYSIWYG_EDIT_MODE message, enabled:', event.data.enabled);
      if (event.data.enabled) {
        enableEditMode();
      } else {
        disableEditMode();
      }
    }

    if (event.data && event.data.type === 'WYSIWYG_SAVED') {
      const saveBtn = document.getElementById('wysiwyg-save');
      if (saveBtn) {
        saveBtn.textContent = '✅ Saved';
        saveBtn.style.background = '#28a745';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save';
          saveBtn.style.background = '#4a90e2';
          updateToolbar();
        }, 2000);
      }
    }

    if (event.data && event.data.type === 'WYSIWYG_INSERT_BLOCK') {
      handleInsertBlock(event.data.payload);
    }

    if (event.data && event.data.type === 'WYSIWYG_UPDATE_BLOCK') {
      const { blockId, html } = event.data.payload || {};
      if (!blockId || !html) return;
      const existing = queryBlockElementById(blockId);
      if (!existing) return;

      const temp = document.createElement('div');
      temp.innerHTML = html.trim();
      const newBlock = temp.firstElementChild;
      if (!newBlock) return;

      if (!newBlock.getAttribute('data-sb-block-id')) {
        newBlock.setAttribute('data-sb-block-id', blockId);
      }

      existing.replaceWith(newBlock);
      if (editMode) {
        setTimeout(() => refreshEditableElements(), 50);
      }
      selectBlockFromElement(newBlock);
    }

    if (event.data && event.data.type === 'WYSIWYG_CLEAR_BLOCK') {
      clearBlockSelection();
      selectedBlockId = null;
    }

    // Handle HTML request from parent
    if (event.data && event.data.type === 'WYSIWYG_REQUEST_HTML') {
      sendHtmlToParent();
    }

    // Handle selection caching request
    if (event.data && event.data.type === 'WYSIWYG_CACHE_SELECTION') {
      cacheSelection();
    }

    if (event.data && event.data.type === 'WYSIWYG_FORMAT') {
      const { command, value } = event.data.payload || {};
      if (!command) {
        console.warn('[WYSIWYG] Format command missing');
        return;
      }

      console.log('[WYSIWYG] Format command received:', command, 'isEditing:', isEditing, 'hasSelection:', window.getSelection()?.rangeCount > 0);

      // Ensure iframe window has focus for execCommand to work
      window.focus();

      // Get current selection
      const selection = window.getSelection();
      let hasSelection = selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
      let targetElement = null;
      let rangeToUse = null;

      // Strategy 1: If we're actively editing an element, use that
      if (isEditing && selectedElement && (selectedElement.contentEditable === 'true' || selectedElement.getAttribute('contenteditable') === 'true')) {
        targetElement = selectedElement;
        targetElement.focus();

        // Restore or create selection
        if (cachedSelectionRange) {
          try {
            selection.removeAllRanges();
            selection.addRange(cachedSelectionRange);
            hasSelection = true;
            rangeToUse = cachedSelectionRange;
          } catch (e) {
            // Cached range invalid, create new selection
            const range = document.createRange();
            range.selectNodeContents(targetElement);
            selection.removeAllRanges();
            selection.addRange(range);
            hasSelection = true;
            rangeToUse = range;
          }
        } else if (!hasSelection) {
          // Select all if no selection
          const range = document.createRange();
          range.selectNodeContents(targetElement);
          selection.removeAllRanges();
          selection.addRange(range);
          hasSelection = true;
          rangeToUse = range;
        } else {
          rangeToUse = selection.getRangeAt(0);
        }
      }
      // Strategy 2: If there's a text selection anywhere, use it
      else if (hasSelection) {
        rangeToUse = selection.getRangeAt(0);
        const container = rangeToUse.commonAncestorContainer;
        targetElement = container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : container;

        // Restore cached selection if available
        if (cachedSelectionRange) {
          try {
            selection.removeAllRanges();
            selection.addRange(cachedSelectionRange);
            rangeToUse = cachedSelectionRange;
          } catch (e) {
            // Use current selection
          }
        }
      }
      // Strategy 3: If we're in edit mode and have a selected element, make it editable and select all
      else if (editMode && selectedElement) {
        targetElement = selectedElement;
        targetElement.setAttribute('contenteditable', 'true');
        targetElement.focus();

        const range = document.createRange();
        range.selectNodeContents(targetElement);
        selection.removeAllRanges();
        selection.addRange(range);
        hasSelection = true;
        rangeToUse = range;
      }
      // Strategy 4: Find the focused element or any editable element
      else if (editMode) {
        // Try to find focused element
        const focused = document.activeElement;
        if (focused && (focused.contentEditable === 'true' || focused.getAttribute('contenteditable') === 'true')) {
          targetElement = focused;
        } else {
          // Find any editable element
          const editableElements = document.querySelectorAll('.wysiwyg-editable, [contenteditable="true"]');
          if (editableElements.length > 0) {
            targetElement = editableElements[0];
          }
        }

        if (targetElement) {
          targetElement.focus();
          const range = document.createRange();
          range.selectNodeContents(targetElement);
          selection.removeAllRanges();
          selection.addRange(range);
          hasSelection = true;
          rangeToUse = range;
        }
      }

      // Apply format command if we have a valid selection
      if (hasSelection && rangeToUse) {
        try {
          // Ensure selection is active
          if (selection.rangeCount === 0 || selection.getRangeAt(0) !== rangeToUse) {
            selection.removeAllRanges();
            selection.addRange(rangeToUse);
          }

          // Apply format command
          const success = document.execCommand(command, false, value || null);
          console.log(`[WYSIWYG] Applied format: ${command}, success: ${success}`);

          // Cache the new selection
          if (selection.rangeCount > 0) {
            try {
              cachedSelectionRange = selection.getRangeAt(0).cloneRange();
            } catch (e) {
              // Ignore
            }
          }

          // Find the element to notify parent
          if (!targetElement && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            targetElement = container.nodeType === Node.TEXT_NODE
              ? container.parentElement
              : container;
          }

          // Notify parent of change
          if (targetElement && targetElement !== document.body && targetElement !== document.documentElement) {
            sendChangeToParent({
              type: 'TEXT_EDIT',
              element: {
                tag: targetElement.tagName.toLowerCase(),
                selector: getElementSelector(targetElement),
                id: targetElement.id || '',
                newContent: targetElement.innerHTML,
                html: targetElement.outerHTML,
                fullHtml: document.documentElement.outerHTML
              }
            });
          }
        } catch (e) {
          console.error(`[WYSIWYG] Format command failed: ${command}`, e);
        }
      } else {
        console.warn('[WYSIWYG] No valid selection for format command. isEditing:', isEditing, 'selectedElement:', !!selectedElement, 'hasSelection:', hasSelection);
      }
    }
  });

  // Handle block insertion
  function handleInsertBlock(payload) {
    console.log('[WYSIWYG] Handling block insertion', payload);
    const { html, position } = payload;
    if (!html) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html.trim();
    const newBlock = tempDiv.firstElementChild;

    if (!newBlock) {
      console.error('[WYSIWYG] Could not create block from HTML');
      return;
    }

    if (!newBlock.getAttribute('data-sb-block-id')) {
      newBlock.setAttribute('data-sb-block-id', generateBlockId());
    }

    // Find best insertion point
    const insertionPoint = document.querySelector('main') ||
      document.getElementById('root') ||
      document.getElementById('__next') ||
      document.querySelector('article') ||
      document.querySelector('section') ||
      document.body;

    console.log('[WYSIWYG] Inserting block into:', insertionPoint.tagName, insertionPoint.id ? `#${insertionPoint.id}` : '');

    if (position === 'append') {
      insertionPoint.appendChild(newBlock);
    } else {
      if (insertionPoint === document.body) {
        insertionPoint.insertBefore(newBlock, insertionPoint.firstChild);
      } else {
        insertionPoint.prepend(newBlock);
      }
    }

    // Scroll into view
    try {
      newBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { }

    selectBlockFromElement(newBlock);

    // Make content editable immediately
    if (editMode) {
      setTimeout(() => {
        const makeEditable = (el) => {
          const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'li', 'td', 'th', 'label'];
          if (textTags.includes(el.tagName.toLowerCase())) {
            el.classList.add('wysiwyg-editable');
            el.addEventListener('click', handleTextElementClick, true);
          }
          if (el.tagName.toLowerCase() === 'img') {
            el.classList.add('wysiwyg-image-editable');
            el.addEventListener('click', handleImageClick, true);
          }
          Array.from(el.children).forEach(makeEditable);
        };
        makeEditable(newBlock);
        console.log('[WYSIWYG] Block children made editable');
      }, 100);
    }

    // Notify parent ONLY of the new block
    setTimeout(() => {
      sendChangeToParent({
        type: 'BLOCK_INSERT',
        element: {
          tag: newBlock.tagName.toLowerCase(),
          selector: 'main > ' + newBlock.tagName.toLowerCase(), // approximate
          html: newBlock.outerHTML
        }
      });
    }, 100);
  }

  // Cache selection function
  function cacheSelection() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      try {
        cachedSelectionRange = selection.getRangeAt(0).cloneRange();
        console.log('[WYSIWYG] Selection cached');
      } catch (e) {
        // Ignore errors
      }
    }
  }

  function handleFormSubmit(e) {
    const form = e.target;
    if (!form || !form.getAttribute) return;
    const formId = form.getAttribute('data-sb-form-id');
    if (!formId) return;

    if (editMode) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const formName = form.getAttribute('data-sb-form-name') || formId;
    const successMessage =
      form.getAttribute('data-sb-form-success') ||
      'Thanks! Your submission was received.';
    const data = {};
    try {
      const formData = new FormData(form);
      formData.forEach((value, key) => {
        data[key] = typeof value === 'string' ? value : String(value);
      });
    } catch (error) {
      console.warn('[WYSIWYG] Failed to read form data', error);
    }

    if (window.parent) {
      window.parent.postMessage({
        type: 'SB_FORM_SUBMIT',
        payload: {
          formId,
          formName,
          page: getPagePath(),
          fields: data
        }
      }, '*');
    }

    // Inline success feedback
    try {
      let notice = form.querySelector('[data-sb-form-success-message]');
      if (!notice) {
        notice = document.createElement('div');
        notice.setAttribute('data-sb-form-success-message', 'true');
        notice.style.marginTop = '12px';
        notice.style.fontSize = '12px';
        notice.style.color = '#4a90e2';
        form.appendChild(notice);
      }
      notice.textContent = successMessage;
    } catch (err) {
      console.warn('[WYSIWYG] Could not render form success message', err);
    }
  }

  // Initialize on load - with delay to avoid conflicts with WebContainer
  function init() {
    // Wait for WebContainer to finish initializing
    // Check if WebContainer scripts are still loading
    const checkWebContainerReady = () => {
      // Wait longer to ensure WebContainer frame_start.js has completely finished
      // Check if frame_start.js is still manipulating the DOM
      let retries = 0;
      const maxRetries = 10;

      const tryInit = () => {
        try {
          // Check if document is stable (no active mutations)
          if (document.body && document.head) {
            injectStyles();

            // Set up selection caching
            document.addEventListener("selectionchange", cacheSelection);
            document.addEventListener("mouseup", cacheSelection, true);
            window.addEventListener("blur", cacheSelection, true);
            document.addEventListener("submit", handleFormSubmit, true);

            if (window.parent) {
              window.parent.postMessage({ type: 'WYSIWYG_SCRIPT_READY' }, '*');
            }
          } else if (retries < maxRetries) {
            retries++;
            setTimeout(tryInit, 200);
          } else {
            console.warn('[WYSIWYG] Document not ready after max retries');
            if (window.parent) {
              window.parent.postMessage({ type: 'WYSIWYG_SCRIPT_READY' }, '*');
            }
          }
        } catch (error) {
          console.warn('[WYSIWYG] Initialization error (non-critical):', error);
          if (retries < maxRetries) {
            retries++;
            setTimeout(tryInit, 200);
          } else {
            // Still notify parent that script is ready, even if some setup failed
            if (window.parent) {
              window.parent.postMessage({ type: 'WYSIWYG_SCRIPT_READY' }, '*');
            }
          }
        }
      };

      // Initial delay to let WebContainer finish
      setTimeout(tryInit, 800);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkWebContainerReady);
    } else {
      checkWebContainerReady();
    }
  }

  // Wrap in try-catch to prevent errors from breaking the page
  try {
    init();
  } catch (error) {
    console.error('[WYSIWYG] Fatal initialization error:', error);
    // Still try to notify parent
    if (window.parent) {
      window.parent.postMessage({ type: 'WYSIWYG_SCRIPT_READY' }, '*');
    }
  }
})();

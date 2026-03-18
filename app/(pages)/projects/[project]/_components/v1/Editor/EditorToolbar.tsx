"use client";

import React from "react";
import { Editor } from "@tiptap/react";
import {
    MdFormatBold,
    MdFormatItalic,
    MdFormatUnderlined,
    MdFormatStrikethrough,
    MdFormatListBulleted,
    MdFormatListNumbered,
    MdFormatAlignLeft,
    MdFormatAlignCenter,
    MdFormatAlignRight,
    MdFormatAlignJustify,
    MdCode,
    MdImage,
    MdLink,
    MdUndo,
    MdRedo,
    MdFormatQuote,
    MdOutlineLayers,
    MdCloudUpload,
} from "react-icons/md";
import { TbH1, TbH2, TbH3 } from "react-icons/tb";

interface EditorToolbarProps {
    editor: Editor | null;
}

const EditorToolbar = ({ editor }: EditorToolbarProps) => {
    if (!editor) return null;

    const addImage = () => {
        const url = window.prompt("URL");

        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === "string") {
                    editor.chain().focus().setImage({ src: result }).run();
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("URL", previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        // update link
        editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
    };

    const MenuButton = ({
        onClick,
        isActive,
        children,
        disabled = false,
        title,
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        disabled?: boolean;
        title?: string;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1.5 rounded-md transition-colors ${isActive ? "bg-[#3a3a3b] text-white" : "text-[#b1b1b1] hover:bg-[#2a2a2b] hover:text-white"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        >
            {children}
        </button>
    );

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-[#2a2a2b] bg-[#1a1a1c]">
            <div className="flex gap-1 pr-2 border-r border-[#2a2a2b]">
                <MenuButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Undo"
                >
                    <MdUndo size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Redo"
                >
                    <MdRedo size={18} />
                </MenuButton>
            </div>

            <div className="flex gap-1 px-2 border-r border-[#2a2a2b]">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    title="Bold"
                >
                    <MdFormatBold size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    title="Italic"
                >
                    <MdFormatItalic size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    isActive={editor.isActive("underline")}
                    title="Underline"
                >
                    <MdFormatUnderlined size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    isActive={editor.isActive("strike")}
                    title="Strikethrough"
                >
                    <MdFormatStrikethrough size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    isActive={editor.isActive("code")}
                    title="Code"
                >
                    <MdCode size={18} />
                </MenuButton>
            </div>

            <div className="flex gap-1 px-2 border-r border-[#2a2a2b]">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive("heading", { level: 1 })}
                    title="Heading 1"
                >
                    <TbH1 size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive("heading", { level: 2 })}
                    title="Heading 2"
                >
                    <TbH2 size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive("heading", { level: 3 })}
                    title="Heading 3"
                >
                    <TbH3 size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    isActive={editor.isActive("blockquote")}
                    title="Quote"
                >
                    <MdFormatQuote size={18} />
                </MenuButton>
            </div>

            <div className="flex gap-1 px-2 border-r border-[#2a2a2b]">
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign("left").run()}
                    isActive={editor.isActive({ textAlign: "left" })}
                    title="Align Left"
                >
                    <MdFormatAlignLeft size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign("center").run()}
                    isActive={editor.isActive({ textAlign: "center" })}
                    title="Align Center"
                >
                    <MdFormatAlignCenter size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign("right").run()}
                    isActive={editor.isActive({ textAlign: "right" })}
                    title="Align Right"
                >
                    <MdFormatAlignRight size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().setTextAlign("justify").run()}
                    isActive={editor.isActive({ textAlign: "justify" })}
                    title="Align Justify"
                >
                    <MdFormatAlignJustify size={18} />
                </MenuButton>
            </div>

            <div className="flex gap-1 px-2 border-r border-[#2a2a2b]">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive("bulletList")}
                    title="Bullet List"
                >
                    <MdFormatListBulleted size={18} />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive("orderedList")}
                    title="Ordered List"
                >
                    <MdFormatListNumbered size={18} />
                </MenuButton>
            </div>

            <div className="flex gap-1 pl-2">
                <MenuButton onClick={setLink} isActive={editor.isActive("link")} title="Link">
                    <MdLink size={18} />
                </MenuButton>
                <div className="flex gap-1">
                    <MenuButton onClick={addImage} title="Add Image via URL">
                        <MdImage size={18} />
                    </MenuButton>
                    <MenuButton onClick={() => fileInputRef.current?.click()} title="Upload Image">
                        <MdCloudUpload size={18} />
                    </MenuButton>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                </div>
                <MenuButton
                    onClick={() => {
                        const node = editor.state.selection.$from.node();
                        if (node.type.name === 'image') {
                            const newUrl = window.prompt("New Image URL", node.attrs.src);
                            if (newUrl) {
                                editor.chain().focus().setImage({ src: newUrl }).run();
                            }
                        } else if (node.type.name === 'paragraph' && editor.isActive('image')) {
                            // Tiptap image selection handling can be tricky
                            fileInputRef.current?.click();
                        } else {
                            // If no image is selected, just suggest upload
                            fileInputRef.current?.click();
                        }
                    }}
                    title="Swap Image"
                >
                    <MdOutlineLayers size={18} />
                </MenuButton>
            </div>
        </div>
    );
};

export default EditorToolbar;

'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Extension } from '@tiptap/react';
import { Mark } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Quote, List, ListOrdered,
  Link2, Heading2, Undo, Redo, EyeOff, FileCode,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

/* ── Custom Spoiler mark ── */
const Spoiler = Mark.create({
  name: 'spoiler',
  parseHTML() {
    return [{ tag: 'span[data-spoiler]' }];
  },
  renderHTML() {
    return ['span', { 'data-spoiler': '', class: 'spoiler' }, 0];
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => this.editor.commands.toggleMark('spoiler'),
    };
  },
});

/* ── Toolbar button ── */
function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-neon-purple/20 text-neon-purple'
          : 'text-text-muted hover:text-text-primary hover:bg-dark-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

/* ── Toolbar ── */
function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border-default bg-dark-800/50">
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Pogrubienie (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Kursywa (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Przekreślenie"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border-default mx-1" />

      <ToolbarBtn
        onClick={setLink}
        active={editor.isActive('link')}
        title="Link (Ctrl+K)"
      >
        <Link2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Kod inline"
      >
        <Code className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Blok kodu"
      >
        <FileCode className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleMark('spoiler').run()}
        active={editor.isActive('spoiler')}
        title="Spoiler (Ctrl+Shift+S)"
      >
        <EyeOff className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border-default mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Nagłówek"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Cytat"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Lista"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Lista numerowana"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <div className="w-px h-4 bg-border-default mx-1" />

      <ToolbarBtn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Cofnij"
      >
        <Undo className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Ponów"
      >
        <Redo className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  );
}

/* ── Main Editor Component ── */
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({ content, onChange, placeholder = 'Napisz coś...', minHeight = '120px' }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-neon-cyan hover:underline cursor-pointer', target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Spoiler,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor outline-none px-3 py-2 text-sm text-text-primary',
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external content changes (e.g. reset form)
  useEffect(() => {
    if (editor && content === '' && editor.getHTML() !== '<p></p>') {
      editor.commands.clearContent();
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="bg-dark-800 border border-border-default rounded-lg overflow-hidden focus-within:border-neon-purple/50 transition-colors">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/* ── Rich content renderer ── */
export function RichContent({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`prose-post ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

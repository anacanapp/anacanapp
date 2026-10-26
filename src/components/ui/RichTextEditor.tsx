import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon,
  Image as ImageIcon, Undo, Redo, Quote, Minus, Code, Upload } from
'lucide-react';
import { useEffect, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";

// Simple markdown to HTML converter for legacy content
const markdownToHtml = (md: string): string => {
  let html = md;
  // Headings (### before ## before #)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Unordered list items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Wrap remaining plain lines in <p> tags
  html = html.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|li|blockquote|hr|p|div|pre|code|img)/.test(trimmed)) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');
  // Clean up empty lines
  html = html.replace(/\n{2,}/g, '\n');
  return html;
};

const isMarkdown = (text: string): boolean => {
  if (text.trim().startsWith('<') && /<[a-z][\s\S]*>/i.test(text)) return false;
  return /(\*\*|^#{1,3} |^- |^\d+\. |^> |^---$|\[.+\]\(.+\))/m.test(text);
};

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MenuButton = ({ onClick, active, disabled, children, title





}: {onClick: () => void;active?: boolean;disabled?: boolean;children: React.ReactNode;title?: string;}) =>
<button
  type="button"
  onClick={onClick}
  disabled={disabled}
  title={title}
  className={cn(
    'p-1.5 rounded-md transition-colors',
    active ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    disabled && 'opacity-40 cursor-not-allowed'
  )}>
  
    {children}
  </button>;


const RichTextEditor = ({ content, onChange, placeholder = tr("richtexteditor_mezmun_yazin_bdbcfa", "M\u0259zmun yaz\u0131n..."), disabled, className }: RichTextEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert markdown to HTML if needed
  const processedContent = useMemo(() => {
    if (!content) return '';
    if (isMarkdown(content)) return markdownToHtml(content);
    return content;
  }, [content]);

  const editor = useEditor({
    extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] }
    }),
    Underline,
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
    Image.configure({ inline: false, allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder })],

    content: processedContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      const newContent = isMarkdown(content) ? markdownToHtml(content) : content;
      editor.commands.setContent(newContent);
    }
  }, [content]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = prompt('Link URL daxil edin:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith('image/')) {
      toast.error(tr("richtexteditor_yalniz_sekil_fayllari_yukleye__ed2541", "Yaln\u0131z \u015F\u0259kil fayllar\u0131 y\xFCkl\u0259y\u0259 bil\u0259rsiniz"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tr("richtexteditor_sekil_5mb_dan_boyuk_ola_bilmez_3e4e99", "\u015E\u0259kil 5MB-dan b\xF6y\xFCk ola bilm\u0259z"));
      return;
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `editor/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

      const { error } = await supabase.storage.
      from('assets').
      upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage.
      from('assets').
      getPublicUrl(fileName);

      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      toast.success(tr("richtexteditor_sekil_yuklendi_474bd5", "\u015E\u0259kil y\xFCkl\u0259ndi"));
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error(tr("richtexteditor_sekil_yuklenerken_xeta_bas_ver_16a2d0", "\u015E\u0259kil y\xFCkl\u0259n\u0259rk\u0259n x\u0259ta ba\u015F verdi"));
    }
  }, [editor]);

  const onImageButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
      e.target.value = '';
    }
  }, [handleImageUpload]);

  if (!editor) return null;

  const s = 14;

  return (
    <div className={cn('border border-input rounded-lg overflow-hidden bg-background', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden" />
      
      

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-muted/30">
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title={tr("richtexteditor_qalin_c4d6bc", "Qalın")}>
          <Bold size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title={tr("richtexteditor_kursiv", 'Kursiv')}>
          <Italic size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title={tr("richtexteditor_altixetli_c40fd6", "Altıxətli")}>
          <UnderlineIcon size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title={tr("richtexteditor_ustuxetli_f3d1e5", "Üstüxətli")}>
          <Strikethrough size={s} />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title={tr("richtexteditor_basliq_1_4e0712", "Başlıq 1")}>
          <Heading1 size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title={tr("richtexteditor_basliq_2_2e5cb2", "Başlıq 2")}>
          <Heading2 size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title={tr("richtexteditor_basliq_3_36375a", "Başlıq 3")}>
          <Heading3 size={s} />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title={tr("richtexteditor_siyahi_f04aac", "Siyahı")}>
          <List size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title={tr("richtexteditor_nomreli_siyahi_0adbc6", "Nömrəli siyahı")}>
          <ListOrdered size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title={tr("richtexteditor_sitat", 'Sitat')}>
          <Quote size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title={tr("richtexteditor_kod", 'Kod')}>
          <Code size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title={tr("richtexteditor_xett_c1e83c", "Xətt")}>
          <Minus size={s} />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'start' })} title={tr("richtexteditor_sola", 'Sola')}>
          <AlignLeft size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title={tr("richtexteditor_ortaya", 'Ortaya')}>
          <AlignCenter size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'end' })} title={tr("richtexteditor_saga_804f56", "Sağa")}>
          <AlignRight size={s} />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={addLink} active={editor.isActive('link')} title="Link">
          <LinkIcon size={s} />
        </MenuButton>
        <MenuButton onClick={onImageButtonClick} title={tr("richtexteditor_sekil_yukle_0577d2", "Şəkil yüklə")}>
          <Upload size={s} />
        </MenuButton>

        <div className="w-px h-5 bg-border mx-1" />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title={tr("richtexteditor_geri_al", 'Geri al')}>
          <Undo size={s} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title={tr("richtexteditor_i_reli_3bc432", "İrəli")}>
          <Redo size={s} />
        </MenuButton>
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className={cn(
          'p-4 min-h-[200px] focus-within:outline-none',
          '[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]',
          // Placeholder
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          // Headings
          '[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h1]:mt-4',
          '[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3',
          '[&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-3',
          // Lists
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-6 [&_.ProseMirror_ul]:mb-3',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-6 [&_.ProseMirror_ol]:mb-3',
          '[&_.ProseMirror_li]:mb-1',
          // Blockquote
          '[&_.ProseMirror_blockquote]:border-s-4 [&_.ProseMirror_blockquote]:border-primary/30',
          '[&_.ProseMirror_blockquote]:ps-4 [&_.ProseMirror_blockquote]:italic',
          '[&_.ProseMirror_blockquote]:text-muted-foreground [&_.ProseMirror_blockquote]:my-3',
          // Code block
          '[&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:p-3',
          '[&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm [&_.ProseMirror_pre]:my-3',
          '[&_.ProseMirror_pre]:overflow-x-auto',
          '[&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:px-1.5',
          '[&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-sm',
          // Horizontal rule
          '[&_.ProseMirror_hr]:border-border [&_.ProseMirror_hr]:my-4',
          // Paragraph
          '[&_.ProseMirror_p]:mb-2',
          // Images
          '[&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-3',
          // Links
          '[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline'
        )} />
      
    </div>);

};

export default RichTextEditor;
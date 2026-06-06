import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link, Image, Trash2, 
  RotateCcw, RotateCw, Type, Palette, 
  Table, HelpCircle, FileText, CheckCircle
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder = "Type your notes here..." }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  
  // Custom states for tracking formatting status
  const [textColor, setTextColor] = useState('#000000');
  const [backColor, setBackColor] = useState('#ffffff');
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);

  // Sync initial value only if changed externally (to prevent cursor jumping)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
      updateCounts();
    }
  }, [value]);

  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const chars = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setCharCount(chars);
    setWordCount(words);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    updateCounts();
  };

  const formatSelection = (command: string, arg: string = '') => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleLink = () => {
    const url = window.prompt("Enter the puzzle/resource link URL (e.g. https://google.com):");
    if (url) formatSelection('createLink', url);
  };

  const handleImage = () => {
    const url = window.prompt("Enter Image URL (e.g. https://images.unsplash.com/...):");
    if (url) formatSelection('insertImage', url);
  };

  const handleTable = () => {
    const rows = window.prompt("Enter number of Rows:", "3");
    const cols = window.prompt("Enter number of Columns:", "3");
    if (!rows || !cols) return;
    
    let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:15px 0;" border="1" cellpadding="8">';
    for (let r = 0; r < parseInt(rows); r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < parseInt(cols); c++) {
        tableHtml += '<td style="border:1px solid #d1d5db; min-width:50px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p>&nbsp;</p>';
    formatSelection('insertHTML', tableHtml);
  };

  const standardColors = [
    '#000000', '#4b5563', '#dc2626', '#ea580c', 
    '#d97706', '#16a34a', '#059669', '#2563eb', 
    '#4f46e5', '#7c3aed', '#db2777'
  ];

  const highlightColors = [
    '#ffffff', '#f3f4f6', '#fee2e2', '#ffedd5', 
    '#fef3c7', '#dcfce7', '#ecfdf5', '#dbeafe', 
    '#e0e7ff', '#f3e8ff', '#fce7f3'
  ];

  return (
    <div className="border border-slate-200 rounded-3xl overflow-hidden bg-slate-50 flex flex-col shadow-sm max-w-full font-sans">
      
      {/* MS Word Inspired Modern Toolbar Container */}
      <div className="bg-white border-b border-slate-200 p-2.5 flex flex-wrap gap-1.5 items-center justify-start sticky top-0 z-40">
        
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-2">
          <button 
            type="button"
            onClick={() => formatSelection('undo')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('redo')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Text style Dropdown / Formatting */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
          <select 
            onChange={(e) => formatSelection('formatBlock', e.target.value)}
            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
            title="Paragraph Format"
            defaultValue="P"
          >
            <option value="P">Normal Paragraph</option>
            <option value="H1">Topic Title (H1)</option>
            <option value="H2">Sub-Topic (H2)</option>
            <option value="H3">Header 3 (H3)</option>
            <option value="BLOCKQUOTE">Quote Block</option>
            <option value="PRE">Code / Formula Block</option>
          </select>

          <select 
            onChange={(e) => formatSelection('fontName', e.target.value)}
            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
            title="Font Face Style"
            defaultValue="Inter"
          >
            <option value="Inter, sans-serif">Standard Inter</option>
            <option value="Space Grotesk, sans-serif">Space Grotesk</option>
            <option value="Times New Roman, serif">Times New Roman</option>
            <option value="Courier New, monospace">Courier Code</option>
            <option value="Georgia, serif">Georgia Editorial</option>
          </select>

          <select 
            onChange={(e) => formatSelection('fontSize', e.target.value)}
            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none w-14"
            title="Font Size"
            defaultValue="3"
          >
            <option value="1">10px</option>
            <option value="2">12px</option>
            <option value="3">14px</option>
            <option value="4">16px</option>
            <option value="5">18px</option>
            <option value="6">24px</option>
            <option value="7">32px</option>
          </select>
        </div>

        {/* Font Weight/Style togglers */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-2">
          <button 
            type="button"
            onClick={() => formatSelection('bold')}
            className="p-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg font-bold transition-all"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('italic')}
            className="p-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg font-bold transition-all"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('underline')}
            className="p-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg font-bold transition-all"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('strikeThrough')}
            className="p-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg font-bold transition-all"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-2">
          <button 
            type="button"
            onClick={() => formatSelection('justifyLeft')}
            className="p-1.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-all"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('justifyCenter')}
            className="p-1.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-all"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('justifyRight')}
            className="p-1.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-all"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('justifyFull')}
            className="p-1.5 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-all"
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Lists & Lists controls */}
        <div className="flex items-center gap-0.5 border-r border-slate-200 pr-2">
          <button 
            type="button"
            onClick={() => formatSelection('insertUnorderedList')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => formatSelection('insertOrderedList')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        {/* Document Colors dropdowns */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2 relative">
          
          {/* Text Color Selection widget */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => { setShowColorDropdown(!showColorDropdown); setShowHighlightDropdown(false); }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 font-semibold text-slate-700"
              title="Change Text Color"
            >
              <span className="text-xs">A</span>
              <div className="w-3 h-3 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: textColor }} />
            </button>
            {showColorDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-250 shadow-xl rounded-2xl p-2.5 grid grid-cols-4 gap-1.5 z-50 w-36">
                {standardColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setTextColor(c);
                      formatSelection('foreColor', c);
                      setShowColorDropdown(false);
                    }}
                    className="w-6 h-6 rounded-full border border-slate-200 transition-transform hover:scale-110 active:scale-95 text-[0px]"
                    style={{ backgroundColor: c }}
                  >
                    Select color {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Highlight colors selection */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => { setShowHighlightDropdown(!showHighlightDropdown); setShowColorDropdown(false); }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-slate-700"
              title="Text Highlighter"
            >
              <Palette className="w-3.5 h-3.5" />
              <div className="w-3 h-3 rounded-md border border-slate-300 shrink-0" style={{ backgroundColor: backColor }} />
            </button>
            {showHighlightDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-250 shadow-xl rounded-2xl p-2.5 grid grid-cols-4 gap-1.5 z-50 w-36">
                {highlightColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setBackColor(c);
                      formatSelection('hiliteColor', c);
                      setShowHighlightDropdown(false);
                    }}
                    className="w-6 h-6 rounded-full border border-slate-200 transition-transform hover:scale-110 active:scale-95 text-[0px]"
                    style={{ backgroundColor: c }}
                  >
                    Highlight with {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Objects (Tables, Links, Images, clear syntax formatting) */}
        <div className="flex items-center gap-0.5">
          <button 
            type="button"
            onClick={handleTable}
            className="p-1.5 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 rounded-lg transition-all"
            title="Insert Word Table"
          >
            <Table className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleLink}
            className="p-1.5 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg transition-all"
            title="Insert Web Link"
          >
            <Link className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={handleImage}
            className="p-1.5 hover:bg-purple-50 text-slate-700 hover:text-purple-600 rounded-lg transition-all"
            title="Insert Notebook Image URL"
          >
            <Image className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => {
              formatSelection('removeFormat');
              // Also format selection as paragraphs
              formatSelection('formatBlock', 'P');
            }}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all font-bold text-xs"
            title="Clear All Text Formatting"
          >
            Clear Style
          </button>
        </div>

      </div>

      {/* Editor Main Content Area - A realistic Word layout paper layout sheet */}
      <div className="bg-slate-100/50 p-4 sm:p-8 flex justify-center flex-grow min-h-[350px]">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 max-w-[850px] w-full p-8 md:p-12 min-h-[300px] flex flex-col relative">
          
          <div 
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            className="flex-grow focus:outline-none font-sans text-sm text-slate-800 leading-relaxed max-w-none prose prose-purple selection:bg-purple-200"
            style={{ minHeight: '220px' }}
          />

          {/* Overlay Placeholder if empty */}
          {(!editorRef.current || !editorRef.current.innerHTML || editorRef.current.innerHTML === '<br>') && (
            <div className="absolute top-8 left-8 md:top-12 md:left-12 text-slate-400 select-none pointer-events-none text-sm font-sans italic">
              {placeholder}
            </div>
          )}

        </div>
      </div>

      {/* Bottom Status Panel */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-slate-600">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Words: <strong className="font-semibold text-slate-700">{wordCount}</strong>
          </span>
          <span>Chars: <strong className="font-semibold text-slate-700">{charCount}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Professional Text-processor is active</span>
        </div>
      </div>

    </div>
  );
}

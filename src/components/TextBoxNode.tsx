import React, { useState, useRef, useEffect } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useDiagramStore, DEFAULT_TEXT_BOX_STYLE } from '../store/diagramStore';
import type { TextBoxStyle } from '../core/types';

export const TextBoxNode = ({ id, selected, data }: NodeProps) => {
  const text = (data.text as string) || '';
  const rawStyle = (data.style as TextBoxStyle) || {};
  const style = { ...DEFAULT_TEXT_BOX_STYLE, ...rawStyle };

  const updateTextBoxText = useDiagramStore((state) => state.updateTextBoxText);

  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setTempText(text);
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    updateTextBoxText(id, tempText.trim() || text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Stop propagation for ALL keys during editing to prevent canvas shortcuts
    // (Delete, Backspace, arrow keys, etc.)
    e.stopPropagation();

    if (e.key === 'Escape') {
      setTempText(text);
      setIsEditing(false);
    }
  };

  const textStyle: React.CSSProperties = {
    fontSize: `${style.fontSize}px`,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: style.textAlign,
    color: style.color,
  };

  return (
    <div
      className={`text-box-node ${selected ? 'text-box-selected' : ''} ${isEditing ? 'text-box-editing' : ''}`}
    >
      {isEditing ? (
        // noDrag class prevents React Flow from initiating drag on the textarea
        <textarea
          ref={textareaRef}
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={handleFinishEditing}
          onKeyDown={handleKeyDown}
          className="text-box-input nopan nodrag"
          style={textStyle}
        />
      ) : (
        <div
          className="text-box-content"
          onDoubleClick={handleStartEditing}
          style={textStyle}
          title="Double-click to edit"
        >
          {text || 'Double-click to edit...'}
        </div>
      )}
    </div>
  );
};

export default TextBoxNode;

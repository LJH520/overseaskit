import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import ImageEditorCore from 'tui-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import './ImageEditor.css';
import heartSticker from './stickers/heart.svg';
import noteSticker from './stickers/note.svg';
import smileSticker from './stickers/smile.svg';
import sparkSticker from './stickers/spark.svg';
import starSticker from './stickers/star.svg';
import talkSticker from './stickers/talk.svg';

type DrawShape = 'free' | 'line' | 'circle' | 'rect';
type SubPanel = 'text' | 'draw' | 'stickers' | 'filter' | 'textEdit' | null;

type Sticker = {
  name: string;
  url: string;
};

type FilterOptions =
  | { blur: number }
  | { noise: number }
  | { blocksize: number };

type FilterDefinition = {
  key: string;
  label: string;
  options?: FilterOptions;
};

const DEFAULT_STICKERS: Sticker[] = [
  { name: 'star', url: starSticker },
  { name: 'heart', url: heartSticker },
  { name: 'smile', url: smileSticker },
  { name: 'spark', url: sparkSticker },
  { name: 'note', url: noteSticker },
  { name: 'talk', url: talkSticker },
  {
    name: 'talk1',
    url: 'https://cdn-icons-png.flaticon.com/512/5272/5272912.png',
  },
];

const DEFAULT_COLORS = [
  '#ffffff',
  '#ff4444',
  '#ffcc00',
  '#44cc44',
  '#4488ff',
  '#cc44ff',
  '#000000',
];

const DEFAULT_FILTERS: FilterDefinition[] = [
  { key: 'Grayscale', label: '黑白' },
  { key: 'Sepia', label: '复古' },
  { key: 'Invert', label: '反色' },
  { key: 'Blur', label: '模糊', options: { blur: 0.1 } },
  { key: 'Sharpen', label: '锐化' },
  { key: 'Emboss', label: '浮雕' },
  { key: 'Noise', label: '噪点', options: { noise: 100 } },
  { key: 'Pixelate', label: '像素化', options: { blocksize: 4 } },
];

const DRAW_SHAPES: ReadonlyArray<readonly [DrawShape, string]> = [
  ['free', '手画'],
  ['line', '直线'],
  ['circle', '圆形'],
  ['rect', '矩形'],
];

const TEXT_COLOR_DEFAULT = '#ffffff';
const DRAW_COLOR_DEFAULT = '#ff4444';
const TEXT_WEIGHT_DEFAULT = 400;
const DRAW_WIDTH_DEFAULT = 3;

export interface ImageEditorProps {
  className?: string;
  style?: CSSProperties;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  saveFileName?: string;
  resetAfterSave?: boolean;
  onSave?: (dataUrl: string) => void;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export default function ImageEditor(props: ImageEditorProps) {
  const {
    className,
    style,
    width = '100%',
    height = '100%',
    saveFileName = 'edited-image.png',
    resetAfterSave = false,
    onSave,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ImageEditorCore | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detachCanvasListenerRef = useRef<(() => void) | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [subPanel, setSubPanel] = useState<SubPanel>(null);
  const [textColor, setTextColor] = useState(TEXT_COLOR_DEFAULT);
  const [textWeight, setTextWeight] = useState(TEXT_WEIGHT_DEFAULT);
  const [drawColor, setDrawColor] = useState(DRAW_COLOR_DEFAULT);
  const [drawShape, setDrawShape] = useState<DrawShape>('free');
  const [drawWidth, setDrawWidth] = useState(DRAW_WIDTH_DEFAULT);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
  const [editTextColor, setEditTextColor] = useState(TEXT_COLOR_DEFAULT);
  const [editTextWeight, setEditTextWeight] = useState(TEXT_WEIGHT_DEFAULT);

  const clearEditorState = useCallback(() => {
    setHasImage(false);
    setIsCropping(false);
    setSubPanel(null);
    setActiveFilters(new Set());
    setUndoCount(0);
    setRedoCount(0);
    setSelectedTextId(null);
    setTextColor(TEXT_COLOR_DEFAULT);
    setTextWeight(TEXT_WEIGHT_DEFAULT);
    setEditTextColor(TEXT_COLOR_DEFAULT);
    setEditTextWeight(TEXT_WEIGHT_DEFAULT);
    setDrawColor(DRAW_COLOR_DEFAULT);
    setDrawShape('free');
    setDrawWidth(DRAW_WIDTH_DEFAULT);
  }, []);

  const createEditor = useCallback((el: HTMLDivElement) => {
    const editor = new ImageEditorCore(el, {
      cssMaxWidth: el.clientWidth,
      cssMaxHeight: el.clientHeight,
      selectionStyle: {
        cornerSize: 30,
        rotatingPointOffset: 70,
      },
      usageStatistics: false,
    });

    editor.on('undoStackChanged', (length: number) => setUndoCount(length));
    editor.on('redoStackChanged', (length: number) => setRedoCount(length));
    editor.on(
      'objectActivated',
      (obj: {
        type?: string;
        id?: number;
        fill?: string;
        fontWeight?: string | number;
      }) => {
        if (obj.type === 'i-text' && typeof obj.id === 'number') {
          setSelectedTextId(obj.id);
          setEditTextColor(obj.fill || TEXT_COLOR_DEFAULT);
          setEditTextWeight(Number(obj.fontWeight) || TEXT_WEIGHT_DEFAULT);
          setSubPanel('textEdit');
          return;
        }

        setSelectedTextId(null);
        setSubPanel((prev) => (prev === 'textEdit' ? null : prev));
      },
    );
    editor.on('selectionCleared', () => {
      setSelectedTextId(null);
      setSubPanel((prev) => (prev === 'textEdit' ? null : prev));
    });

    return editor;
  }, []);

  const bindCanvasSelectionListener = useCallback((editor: ImageEditorCore) => {
    const canvas = (
      editor as ImageEditorCore & {
        _graphics?: {
          getCanvas?: () => {
            on: (eventName: string, handler: () => void) => void;
            off: (eventName: string, handler: () => void) => void;
          };
        };
      }
    )._graphics?.getCanvas?.();

    if (!canvas) {
      return () => undefined;
    }

    const handleDeselect = () => {
      setSelectedTextId(null);
      setSubPanel((prev) => (prev === 'textEdit' ? null : prev));
    };

    canvas.on('selection:cleared', handleDeselect);

    return () => {
      canvas.off('selection:cleared', handleDeselect);
    };
  }, []);

  const recreateEditor = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return null;
    }

    detachCanvasListenerRef.current?.();
    detachCanvasListenerRef.current = null;
    editorRef.current?.destroy();

    const editor = createEditor(el);
    editorRef.current = editor;
    detachCanvasListenerRef.current = bindCanvasSelectionListener(editor);

    return editor;
  }, [bindCanvasSelectionListener, createEditor]);

  useEffect(() => {
    if (!recreateEditor()) {
      return;
    }

    return () => {
      detachCanvasListenerRef.current?.();
      detachCanvasListenerRef.current = null;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [recreateEditor]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !editorRef.current) {
        return;
      }

      void editorRef.current.loadImageFromFile(file).then(() => {
        setHasImage(true);
        setIsCropping(false);
        setActiveFilters(new Set());
        setSubPanel(null);
        editorRef.current?.stopDrawingMode();
      });

      event.target.value = '';
    },
    [],
  );

  const handleReset = useCallback(() => {
    recreateEditor();
    clearEditorState();
  }, [clearEditorState, recreateEditor]);

  const handleUndo = useCallback(() => {
    void editorRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    void editorRef.current?.redo();
  }, []);

  const handleStartCrop = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.startDrawingMode('CROPPER');
    setIsCropping(true);
    setSubPanel(null);
  }, []);

  const handleConfirmCrop = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const rect = editor.getCropzoneRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    void editor.crop(rect).then(() => {
      editor.stopDrawingMode();
      setIsCropping(false);
    });
  }, []);

  const handleCancelCrop = useCallback(() => {
    editorRef.current?.stopDrawingMode();
    setIsCropping(false);
  }, []);

  const handleRotate = useCallback(() => {
    if (!editorRef.current) {
      return;
    }

    void editorRef.current.rotate(90);
  }, []);

  const fixTextOrigin = useCallback((id: number) => {
    const canvas = (
      editorRef.current as ImageEditorCore & {
        _graphics?: {
          getCanvas?: () => {
            getObjects: () => Array<{
              __fe_id?: number;
              originX?: string;
              getPointByOrigin: (
                originX: string,
                originY: string,
              ) => { x: number; y: number };
              set: (nextProps: Record<string, number | string>) => void;
              setCoords: () => void;
            }>;
            renderAll: () => void;
          };
        };
      }
    )._graphics?.getCanvas?.();

    if (!canvas) {
      return;
    }

    const textObject = canvas.getObjects().find((item) => item.__fe_id === id);
    if (!textObject || textObject.originX === 'center') {
      return;
    }

    const center = textObject.getPointByOrigin('center', 'center');
    textObject.set({
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
    });
    textObject.setCoords();
    canvas.renderAll();
  }, []);

  const handleAddText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const size = editor.getCanvasSize();
    void editor
      .addText('编辑文本', {
        styles: {
          fill: textColor,
          fontSize: 80,
          fontFamily: 'sans-serif',
          fontWeight: String(textWeight),
        },
        position: {
          x: size.width / 2,
          y: size.height / 2,
        },
      })
      .then((objectProps) => {
        if (typeof objectProps.id === 'number') {
          fixTextOrigin(objectProps.id);
        }
      });

    setSubPanel(null);
  }, [fixTextOrigin, textColor, textWeight]);

  const handleEditTextColor = useCallback(
    (color: string) => {
      setEditTextColor(color);
      if (selectedTextId !== null && editorRef.current) {
        void editorRef.current.changeTextStyle(selectedTextId, { fill: color });
      }
    },
    [selectedTextId],
  );

  const handleEditTextWeight = useCallback(
    (weight: number) => {
      setEditTextWeight(weight);
      if (selectedTextId !== null && editorRef.current) {
        void editorRef.current.changeTextStyle(selectedTextId, {
          fontWeight: String(weight),
        });
      }
    },
    [selectedTextId],
  );

  const startDraw = useCallback(
    (shape: DrawShape, color: string, lineWidth: number) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.stopDrawingMode();

      if (shape === 'free') {
        editor.startDrawingMode('FREE_DRAWING', { width: lineWidth, color });
        return;
      }

      if (shape === 'line') {
        editor.startDrawingMode('LINE_DRAWING', { width: lineWidth, color });
        return;
      }

      editor.setDrawingShape(shape, {
        fill: 'transparent',
        stroke: color,
        strokeWidth: lineWidth,
      });
      editor.startDrawingMode('SHAPE');
    },
    [],
  );

  const handleSelectDrawShape = useCallback(
    (shape: DrawShape) => {
      setDrawShape(shape);
      startDraw(shape, drawColor, drawWidth);
    },
    [drawColor, drawWidth, startDraw],
  );

  const handleSelectDrawColor = useCallback(
    (color: string) => {
      setDrawColor(color);
      startDraw(drawShape, color, drawWidth);
    },
    [drawShape, drawWidth, startDraw],
  );

  const handleDrawWidthChange = useCallback(
    (lineWidth: number) => {
      setDrawWidth(lineWidth);
      startDraw(drawShape, drawColor, lineWidth);
    },
    [drawColor, drawShape, startDraw],
  );

  const toggleSubPanel = useCallback(
    (panel: SubPanel) => {
      setSubPanel((prev) => {
        const next = prev === panel ? null : panel;
        if (next !== 'draw') {
          editorRef.current?.stopDrawingMode();
        }
        if (next === 'draw') {
          startDraw(drawShape, drawColor, drawWidth);
        }
        return next;
      });
    },
    [drawColor, drawShape, drawWidth, startDraw],
  );

  const handleAddSticker = useCallback((url: string) => {
    if (!editorRef.current) {
      return;
    }

    void editorRef.current.addImageObject(url);
    setSubPanel(null);
  }, []);

  const handleToggleFilter = useCallback(
    (key: string, options?: FilterOptions) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      if (activeFilters.has(key)) {
        void editor.removeFilter(key);
        setActiveFilters((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      void editor.applyFilter(key, options);
      setActiveFilters((prev) => new Set(prev).add(key));
    },
    [activeFilters],
  );

  const handleSave = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const dataURL = editor.toDataURL({ format: 'png', quality: 1 });

    if (onSave) {
      onSave(dataURL);
    } else if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'save', data: dataURL }),
      );
    } else {
      const link = document.createElement('a');
      link.download = saveFileName;
      link.href = dataURL;
      link.click();
    }

    if (resetAfterSave) {
      handleReset();
    }
  }, [handleReset, onSave, resetAfterSave, saveFileName]);

  const rootStyle: CSSProperties = {
    width,
    height,
    ...style,
  };

  return (
    <div
      className={joinClassNames('os-image-editor', className)}
      style={rootStyle}
    >
      <div className="os-image-editor__canvas-area">
        <div className="os-image-editor__canvas-host" ref={containerRef} />

        {hasImage && (undoCount > 0 || redoCount > 0) && (
          <div className="os-image-editor__history-bar">
            <button
              className="os-image-editor__history-button"
              type="button"
              onClick={handleUndo}
              disabled={undoCount === 0}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" />
                <path d="M7 14l-4-4 4-4" />
              </svg>
              <span>撤销</span>
            </button>
            <button
              className="os-image-editor__history-button"
              type="button"
              onClick={handleRedo}
              disabled={redoCount === 0}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h4" />
                <path d="M17 14l4-4-4-4" />
              </svg>
              <span>重做</span>
            </button>
          </div>
        )}

        {!hasImage && (
          <div
            className="os-image-editor__empty"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>点击导入图片</span>
          </div>
        )}

        {subPanel === 'text' && (
          <div className="os-image-editor__sub-panel">
            <div className="os-image-editor__color-row">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  className={joinClassNames(
                    'os-image-editor__color-dot',
                    textColor === color ? 'is-active' : undefined,
                  )}
                  type="button"
                  style={{ background: color }}
                  onClick={() => setTextColor(color)}
                />
              ))}
            </div>
            <div className="os-image-editor__slider-row">
              <span className="os-image-editor__slider-label">粗细</span>
              <input
                type="range"
                className="os-image-editor__slider"
                min={100}
                max={900}
                step={100}
                value={textWeight}
                onChange={(event) => setTextWeight(Number(event.target.value))}
              />
              <span className="os-image-editor__slider-value">
                {textWeight}
              </span>
            </div>
            <button
              className="os-image-editor__sub-panel-action"
              type="button"
              onClick={handleAddText}
            >
              添加文字
            </button>
          </div>
        )}

        {subPanel === 'textEdit' && selectedTextId !== null && (
          <div className="os-image-editor__sub-panel">
            <div className="os-image-editor__sub-panel-title">编辑文字</div>
            <div className="os-image-editor__color-row">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  className={joinClassNames(
                    'os-image-editor__color-dot',
                    editTextColor === color ? 'is-active' : undefined,
                  )}
                  type="button"
                  style={{ background: color }}
                  onClick={() => handleEditTextColor(color)}
                />
              ))}
            </div>
            <div className="os-image-editor__slider-row">
              <span className="os-image-editor__slider-label">粗细</span>
              <input
                type="range"
                className="os-image-editor__slider"
                min={100}
                max={900}
                step={100}
                value={editTextWeight}
                onChange={(event) =>
                  handleEditTextWeight(Number(event.target.value))
                }
              />
              <span className="os-image-editor__slider-value">
                {editTextWeight}
              </span>
            </div>
          </div>
        )}

        {subPanel === 'draw' && (
          <div className="os-image-editor__sub-panel">
            <div className="os-image-editor__shape-row">
              {DRAW_SHAPES.map(([key, label]) => (
                <button
                  key={key}
                  className={joinClassNames(
                    'os-image-editor__shape-button',
                    drawShape === key ? 'is-active' : undefined,
                  )}
                  type="button"
                  onClick={() => handleSelectDrawShape(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="os-image-editor__color-row">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  className={joinClassNames(
                    'os-image-editor__color-dot',
                    drawColor === color ? 'is-active' : undefined,
                  )}
                  type="button"
                  style={{ background: color }}
                  onClick={() => handleSelectDrawColor(color)}
                />
              ))}
            </div>
            <div className="os-image-editor__slider-row">
              <span className="os-image-editor__slider-label">粗细</span>
              <input
                type="range"
                className="os-image-editor__slider"
                min={1}
                max={20}
                step={1}
                value={drawWidth}
                onChange={(event) =>
                  handleDrawWidthChange(Number(event.target.value))
                }
              />
              <span className="os-image-editor__slider-value">
                {drawWidth}px
              </span>
            </div>
          </div>
        )}

        {subPanel === 'stickers' && (
          <div className="os-image-editor__sticker-panel">
            {DEFAULT_STICKERS.map((sticker) => (
              <button
                key={sticker.name}
                className="os-image-editor__sticker-item"
                type="button"
                onClick={() => handleAddSticker(sticker.url)}
              >
                <img
                  className="os-image-editor__sticker-image"
                  src={sticker.url}
                  alt={sticker.name}
                  width={36}
                  height={36}
                />
              </button>
            ))}
          </div>
        )}

        {subPanel === 'filter' && (
          <div className="os-image-editor__sub-panel">
            <div className="os-image-editor__filter-grid">
              {DEFAULT_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  className={joinClassNames(
                    'os-image-editor__filter-button',
                    activeFilters.has(filter.key) ? 'is-active' : undefined,
                  )}
                  type="button"
                  onClick={() => handleToggleFilter(filter.key, filter.options)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="os-image-editor__toolbar">
        {isCropping ? (
          <>
            <button
              className="os-image-editor__tool-button is-confirm"
              type="button"
              onClick={handleConfirmCrop}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
              <span>确认</span>
            </button>
            <button
              className="os-image-editor__tool-button is-cancel"
              type="button"
              onClick={handleCancelCrop}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span>取消</span>
            </button>
          </>
        ) : (
          <>
            <button
              className={joinClassNames(
                'os-image-editor__tool-button',
                hasImage ? 'is-cancel' : undefined,
              )}
              type="button"
              onClick={
                hasImage ? handleReset : () => fileInputRef.current?.click()
              }
            >
              {hasImage ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              )}
              <span>{hasImage ? '重置' : '导入'}</span>
            </button>
            <button
              className="os-image-editor__tool-button"
              type="button"
              onClick={handleStartCrop}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 2v14a2 2 0 002 2h14M2 6h4M18 22v-4" />
              </svg>
              <span>裁剪</span>
            </button>
            <button
              className="os-image-editor__tool-button"
              type="button"
              onClick={handleRotate}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <span>旋转</span>
            </button>
            <button
              className={joinClassNames(
                'os-image-editor__tool-button',
                subPanel === 'text' ? 'is-active' : undefined,
              )}
              type="button"
              onClick={() => toggleSubPanel('text')}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7V4h16v3M9 20h6M12 4v16" />
              </svg>
              <span>文字</span>
            </button>
            <button
              className={joinClassNames(
                'os-image-editor__tool-button',
                subPanel === 'draw' ? 'is-active' : undefined,
              )}
              type="button"
              onClick={() => toggleSubPanel('draw')}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
              <span>画线</span>
            </button>
            <button
              className={joinClassNames(
                'os-image-editor__tool-button',
                subPanel === 'stickers' ? 'is-active' : undefined,
              )}
              type="button"
              onClick={() => toggleSubPanel('stickers')}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <span>贴纸</span>
            </button>
            <button
              className={joinClassNames(
                'os-image-editor__tool-button',
                subPanel === 'filter' ? 'is-active' : undefined,
              )}
              type="button"
              onClick={() => toggleSubPanel('filter')}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>滤镜</span>
            </button>
            <button
              className="os-image-editor__tool-button is-save"
              type="button"
              onClick={handleSave}
              disabled={!hasImage}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>保存</span>
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImport}
      />
    </div>
  );
}

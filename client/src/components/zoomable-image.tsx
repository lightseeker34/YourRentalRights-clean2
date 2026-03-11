import { useEffect, useRef, useState, type ReactNode } from "react";

type ZoomableImageProps = {
  children: ReactNode;
};

export function ZoomableImage({ children }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    if (scale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
  }, [scale]);

  const clampScale = (next: number) => Math.max(1, Math.min(4, next));

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent touch-none select-none">
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/45 px-2 py-1 text-white">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
          onClick={() => setScale((s) => clampScale(s / 1.25))}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="text-xs opacity-80"
          onClick={() => {
            setScale(1);
            setTranslate({ x: 0, y: 0 });
          }}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
          onClick={() => setScale((s) => clampScale(s * 1.25))}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div
        className="flex h-full w-full items-center justify-center"
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          setScale((s) => clampScale(s * (e.deltaY > 0 ? 0.9 : 1.1)));
        }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pointers.current.size === 2) {
            const [a, b] = Array.from(pointers.current.values());
            pinchStartDistance.current = distance(a, b);
            pinchStartScale.current = scale;
            dragStart.current = null;
          } else if (pointers.current.size === 1 && scale > 1) {
            dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pointers.current.size === 2) {
            const [a, b] = Array.from(pointers.current.values());
            const start = pinchStartDistance.current;
            if (!start) return;
            const nextDistance = distance(a, b);
            setScale(clampScale(pinchStartScale.current * (nextDistance / start)));
            return;
          }

          if (dragStart.current && scale > 1) {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinchStartDistance.current = null;
          if (pointers.current.size === 0) dragStart.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) pinchStartDistance.current = null;
          if (pointers.current.size === 0) dragStart.current = null;
        }}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: pointers.current.size ? "none" : "transform 120ms ease-out",
            willChange: "transform",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

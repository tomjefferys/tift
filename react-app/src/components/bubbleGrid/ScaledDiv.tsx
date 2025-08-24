import { useLayoutEffect, useRef, useState, useContext, ReactNode } from 'react';
import { LayoutReadyContext } from './LayoutReadyContext';

interface ScaledTextProps {
  _id : string;
  children: ReactNode;
  maxWidth?: string | number;
  maxHeight?: string | number;
}

export const ScaledDiv = ({ _id, children, maxWidth, maxHeight } : ScaledTextProps) =>{
  const layoutReady = useContext(LayoutReadyContext);

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = innerRef.current;
    const outer = outerRef.current;
    if (!el || !outer) {
      return;
    }

    const parent = outer.parentElement;
    if (!parent) return;

    const updateScale = () => {
      const parent = outer.parentElement;
      if (!parent) return;
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
        return;
      }

      const parentRect = parent.getBoundingClientRect();
      const elWidth = el.scrollWidth;
      if (parentRect.width > 0  && elWidth > 0) {
        const xScale = parentRect.width / elWidth;
        setScale(xScale < 1 ? xScale : 1);
      } 
    }

    // Delay measurement until after paint
    requestAnimationFrame(() => {
     requestAnimationFrame(() => { 
        requestAnimationFrame(updateScale)})
    });

    // Observer parent resize
    const resizeObserver = new ResizeObserver(() => {
        updateScale();
    });
    resizeObserver.observe(parent);
    resizeObserver.observe(outer);

    // Listen for scroll events
    const scrollableAncestors: HTMLElement[] = [];
    let ancestor: HTMLElement | null = outer.parentElement
    while(ancestor) {
      ancestor.addEventListener('scroll', updateScale, { passive: true });
      scrollableAncestors.push(ancestor);
      ancestor = ancestor.parentElement;
    }

    return () => {
      resizeObserver.disconnect();
      scrollableAncestors.forEach(ancestor => {
        ancestor.removeEventListener('scroll', updateScale);
      });
    }

  }, [layoutReady, children, maxWidth, maxHeight]);

  return (
    <div
      ref={outerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth,
        maxHeight,
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      <div
        ref={innerRef}
        style={{
          display: 'inline-block',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          width: 'auto',
          height: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
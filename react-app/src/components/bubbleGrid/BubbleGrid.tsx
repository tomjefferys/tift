/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useReducer, CSSProperties, useLayoutEffect, useMemo } from 'react';
import { getTransform } from './transformBuilder';
import { useBubbleGridMouse } from './bubbleGridMouseHook';

// Are we running in a test environment, if so always show the grid
const ALWAYS_SHOW = import.meta.env.MODE === 'test';

export interface Item {
    item: React.ReactNode;
    style?: React.CSSProperties;
}   

export interface Content {
    content : (Item | undefined)[][];
}

export const BubbleGrid = ({ content } : Content) => {
    // Generate a unique ID for this instance
    const instanceId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

    // Detect if we are on Mobile Safari (for scroll bar fix)
    const isMobileSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const [scrollPosition, setScrollPosition] = useState({ scrollTop: 0, scrollLeft: 0 });

    // State to track if the component has loaded, so we don't show the content before it's ready
    const [isLoaded, setIsLoaded] = useState(false);

    // Refs to store the container and the outer divs
    // The outer divs are not scaled or translated so can be relied on to get the correct size and location
    const containerRef = useRef<HTMLDivElement>(null);
    const outerDivs = useRef<DOMRect[][]>([]);
    const contentRefs = useRef<(HTMLDivElement | null)[][]>([]);

    // Keep track of request animation frame for scroll handling to avoid duplicate rAFs
    const rafRef = useRef<number | null>(null);

    const handleScroll = useCallback(() => {
        if (!rafRef.current) { // Only request a new frame if one is not already requested
            rafRef.current = requestAnimationFrame(() => {
                if (containerRef.current) {
                    setScrollPosition({
                        scrollTop: containerRef.current.scrollTop,
                        scrollLeft: containerRef.current.scrollLeft
                    });
                    forceUpdate();
                }
                rafRef.current = null;
            });
        }
    }, []);

    // Update on every scroll events
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => {
                container.removeEventListener('scroll', handleScroll);
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                }
            };
        }
    }, [handleScroll]);

    // Centre the scroll position and reveal the grid. Only needed when the container's own
    // size actually changes - initial mount, an inactive (display:none) tab becoming active,
    // or a real window resize - not on every word tap. Ordinary content updates are handled
    // by the cell-transform effect below, which already re-runs whenever `content` changes;
    // skipping the hide/recentre/reveal dance for those keeps word selection snappy and lets
    // the transform transition (see definedCellStyle) animate the change smoothly instead.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        // ResizeObserver only fires once layout has actually settled, so there's no need to
        // separately poll for a "stable" size on top of it - and it naturally never fires for
        // a display:none container, so this can't spin the way a busy rAF loop could.
        const resizeObserver = new ResizeObserver(() => {
            const containerRect = container.getBoundingClientRect();
            if (containerRect.width === 0 || containerRect.height === 0) {
                // Not visible yet (e.g. an inactive tab) - wait for the next notification.
                return;
            }

            const scrollTop = Math.max(container.scrollHeight / 2 - containerRect.height / 2, 0);
            const scrollLeft = Math.max(container.scrollWidth / 2 - containerRect.width / 2, 0);
            container.scrollTop = scrollTop;
            container.scrollLeft = scrollLeft;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Wait two frames to ensure the browser has painted the scroll position
                    // before revealing (a no-op if this isn't the first reveal).
                    setIsLoaded(true);
                    forceUpdate();
                });
            });
        });
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    // Tracks whether the pending cell-transform pass (below) was triggered by new `content`
    // rather than only a scroll update, so that effect knows whether to animate the move
    // (content changed - want a smooth, noticeable transition) or snap instantly (scrolling -
    // must track the pointer/gesture exactly, an animated lag here reads as unresponsive).
    const contentChangedRef = useRef(true);
    const isFirstContentRef = useRef(true);

    // When the words themselves change (not just scrolling), re-centre the scroll position -
    // the grid supports free two-way scrolling, so the user may have scrolled to an edge and
    // would otherwise miss new/changed words appearing off-screen - and briefly pulse the grid
    // so the update is noticeable even when a cell's on-screen position doesn't move.
    useLayoutEffect(() => {
        contentChangedRef.current = true;

        if (isFirstContentRef.current) {
            // Initial load is already handled by the mount/resize-driven reveal effect below.
            isFirstContentRef.current = false;
            return;
        }

        const container = containerRef.current;
        if (!container) {
            return;
        }

        const containerRect = container.getBoundingClientRect();
        if (containerRect.width > 0 && containerRect.height > 0) {
            container.scrollTop = Math.max(container.scrollHeight / 2 - containerRect.height / 2, 0);
            container.scrollLeft = Math.max(container.scrollWidth / 2 - containerRect.width / 2, 0);
        }

        container.classList.remove('bubble-grid--updated');
        void container.offsetWidth; // Force reflow so the animation restarts every time.
        container.classList.add('bubble-grid--updated');
    }, [content]);

    useLayoutEffect(() => {
        if (!isLoaded || !containerRef.current) return;

        const isContentUpdate = contentChangedRef.current;
        contentChangedRef.current = false;

        // Read the container rect once; it's the same for every cell.
        const containerRect = containerRef.current.getBoundingClientRect();

        // Phase 1: gather all reads and computed values before making any DOM writes.
        // Interleaving reads (getBoundingClientRect/scrollWidth) with writes (style.transform)
        // inside the loop forces a synchronous layout on every iteration - batching avoids that.
        type Update = { cellDiv: HTMLElement; transform: string; contentDiv: HTMLDivElement | null; scale: number };
        const updates: Update[] = [];

        content.forEach((row, rowIndex) => {
            row.forEach((_, colIndex) => {
                const cellDiv = document.querySelector(`[data-cell="${instanceId}-${rowIndex}-${colIndex}"]`);
                if (cellDiv && cellDiv instanceof HTMLElement && outerDivs.current[rowIndex] && outerDivs.current[rowIndex][colIndex]) {
                    const cellRect = outerDivs.current[rowIndex][colIndex];
                    const transform = getTransform(containerRect, cellRect);

                    const contentDiv = contentRefs.current[rowIndex]?.[colIndex] ?? null;
                    let scale = 1;
                    if (contentDiv) {
                        const contentScrollWidth = contentDiv.scrollWidth;
                        scale = Math.min(cellRect.width / contentScrollWidth, 1);
                    }

                    updates.push({ cellDiv, transform, contentDiv, scale });
                }
            });
        });

        // Phase 2: apply all writes together. Only animate the move when the words changed -
        // scroll-driven repositioning/rescaling snaps instantly so it tracks the gesture
        // exactly instead of visibly lagging behind a fast scroll.
        const transition = isContentUpdate ? 'transform 0.15s ease-out' : 'none';
        updates.forEach(({ cellDiv, transform, contentDiv, scale }) => {
            cellDiv.style.transition = transition;
            cellDiv.style.transform = transform + ' translate3d(0,0,0)'; // Force GPU acceleration
            if (contentDiv) {
                contentDiv.style.transition = transition;
                contentDiv.style.transform = `scale3d(${scale}, ${scale}, 1)`; // Force GPU acceleration
            }
        });
    }, [isLoaded, content, scrollPosition, instanceId]);

    // Set the outer div ref to get the size and location of the element,
    // the outer div is not scaled or translated so can be relied on to get the correct size and location
    const setOuterDivRef = (el: HTMLDivElement | null, row: number, column : number) => {
        // Check if the element is not null and is visible
        // offsetParent is null if the element is not visible (e.g. display: none
        if (el && el.offsetParent !== null) {
            if (!outerDivs.current[row]) {
                outerDivs.current[row] = [];
            }
            outerDivs.current[row][column] = el.getBoundingClientRect();
        }
    };

    const {
        handleMouseDown,
        mouseState
    } = useBubbleGridMouse(containerRef);

    const getCellStyle = (item? : Item ) : CSSProperties => {
        const style = {...baseStyle}
        if (item) {
            Object.assign(style, definedCellStyle);
            if (item.style) {
                Object.assign(style, item.style);
            }
        }
        return style;
    };

    const definedCellStyle = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0px',
        margin: '0px',
        position: 'relative',
        willChange: 'transform',
        borderRadius: '50%',
        overflow: 'hidden', // Clip content inside the div
        maxWidth: '200px',
        transformOrigin: 'center',
        // `transition` is set imperatively in the cell-transform effect above (transform.15s
        // for content updates, 'none' while scrolling) rather than statically here.
    }

    const baseStyle = {
        minWidth: '100px',
    };

    return (
        <div 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            role="grid"
            style={{ 
                height: '100%',
                width: '100%',
                position: 'relative',
                overflowX: 'auto',
                overflowY: 'auto',
                display: 'grid',
                opacity: isLoaded || ALWAYS_SHOW ? 1 : 0,
                transition: 'opacity 0.2s',
                padding: '0vh 15vw',
                boxSizing: 'border-box',
                cursor: mouseState === "dragging" ? 'grabbing' : 'grab', // Change cursor during dragging
                ...(isMobileSafari && {
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }),
            }}>
            {content.map((row, rowIndex) => (
                <div key={rowIndex} 
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `repeat(${row.length}, minmax(auto, 100px))`,
                        marginLeft: rowIndex % 2 === 1 && outerDivs.current[rowIndex]
                            ? `${outerDivs.current[rowIndex][0]?.width / 2}px`
                        : '0',
                        marginRight: rowIndex % 2 === 0 && outerDivs.current[rowIndex]
                            ? `${outerDivs.current[rowIndex][0]?.width / 2}px`
                        : '0',
                    marginTop: rowIndex === 0 ? '2vh' : '0',
                        marginBottom: rowIndex === content.length - 1 ? '2vh' : '0',
                        willChange: 'transform',
                        visibility: (isLoaded || ALWAYS_SHOW) ? 'visible' : 'hidden',
                        }}>

                    {row.map((item, index) => (
                        <div key = {`${rowIndex}-${index}_outer`}
                            ref = {(el) => setOuterDivRef(el, rowIndex, index)}>
                            <div
                                key={`${rowIndex}-${index}`} 
                                data-cell={`${instanceId}-${rowIndex}-${index}`}
                                style={getCellStyle(item)}
                            >
                                <div ref={el => {
                                    contentRefs.current[rowIndex] = contentRefs.current[rowIndex] || [];
                                    contentRefs.current[rowIndex][index] = el;
                                }} className="content">
                                    {item?.item}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default BubbleGrid;
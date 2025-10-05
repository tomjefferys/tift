/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useReducer, CSSProperties, useLayoutEffect } from 'react';
import { getTransform } from './transformBuilder';
import { useBubbleGridMouse } from './bubbleGridMouseHook';

// Are we running in a test environment, if so always show the grid
const ALWAYS_SHOW = process.env.NODE_ENV === 'test';

export interface Item {
    item: React.ReactNode;
    style?: React.CSSProperties;
}   

export interface Content {
    content : (Item | undefined)[][];
}

const NUM_COLS = 10;

// Debounce function to limit the rate at which a function can fire
// eslint -disable-next-line
const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

export const BubbleGrid = ({ content } : Content) => {

    const [, forceUpdate] = useReducer(x => x + 1, 0);

    const [scrollPosition, setScrollPosition] = useState({ scrollTop: 0, scrollLeft: 0 });

    // State to track if the component has loaded, so we don't show the content before it's ready
    const [isLoaded, setIsLoaded] = useState(false);

    // Refs to store the container and the outer divs
    // The outer divs are not scaled or translated so can be relied on to get the correct size and location
    const containerRef = useRef<HTMLDivElement>(null);
    const outerDivs = useRef<DOMRect[][]>([]);
    const contentRefs = useRef<(HTMLDivElement | null)[][]>([]);

    const debouncedHandleScroll = useCallback(debounce(() => {
        if (containerRef.current) {
            setScrollPosition({
                scrollTop: containerRef.current.scrollTop,
                scrollLeft: containerRef.current.scrollLeft
            });
            forceUpdate();
        }
    }, 1000/60), []);

    // Make sure we reset isLoaded as soon as the content changes
    useLayoutEffect(() => {
        setIsLoaded(false);
    }, [content]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', debouncedHandleScroll);
            return () => {
                container.removeEventListener('scroll', debouncedHandleScroll);
            };
        }
    }, [debouncedHandleScroll]);

    // Set the initial scroll position to the middle of the container on load
    useEffect(() => {
        setIsLoaded(false);

        const container = containerRef.current;
        if (!container) {
            return;
        }
        
        let lastWidth = 0;
        let lastHeight = 0;
        let stableFrames = 0;
        const STABLE_FRAME_COUNT = 5;

        // Don't set the initial scroll position until the container has a stable size
        // This seems to be the only way to avoid the initial scroll position being set before the container is fully rendered
        const pollForStableSize = () => {
            const containerRect = container.getBoundingClientRect();
            if (containerRect.width === lastWidth 
                    && containerRect.height === lastHeight
                    && containerRect.width > 0 
                    && containerRect.height > 0) {
                stableFrames++;
            } else {
                stableFrames = 0;
                lastWidth = containerRect.width;
                lastHeight = containerRect.height;
            }

            if (stableFrames >= STABLE_FRAME_COUNT) {
                // Size is stable, set the initial scroll position
                const scrollTop = Math.max(container.scrollHeight / 2 - containerRect.height / 2, 0);
                const scrollLeft = Math.max(container.scrollWidth / 2 - containerRect.width / 2, 0);
                container.scrollTop = scrollTop;
                container.scrollLeft = scrollLeft;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Wait for two frames to ensure the browser has painted the scroll position
                        setIsLoaded(true);
                        forceUpdate();
                    });
                });
            } else {
                requestAnimationFrame(pollForStableSize);
            }
        };

        pollForStableSize();
        
        return () => {
            // No cleanup needed
        };
    }, [content]);

    useLayoutEffect(() => {
        if (!isLoaded) return;
        // Only run after all refs are set
        content.forEach((row, rowIndex) => {
            row.forEach((_, colIndex) => {
                const cellDiv = document.querySelector(`[data-cell="${rowIndex}-${colIndex}"]`);
                if (cellDiv && cellDiv instanceof HTMLElement && outerDivs.current[rowIndex] && outerDivs.current[rowIndex][colIndex] && containerRef.current) {
                    const containerRect = containerRef.current.getBoundingClientRect();
                    const cellRect = outerDivs.current[rowIndex][colIndex];
                    const transform = getTransform(containerRect, cellRect);
                    cellDiv.style.transform = transform;
                    
                    // Scale the content if it doesn't fit
                    const contentDiv = contentRefs.current[rowIndex][colIndex];
                    if (contentDiv) {
                        const contentScrollWidth = contentDiv.scrollWidth;
                        const cellWidth = cellRect.width;
                        const scale = Math.min(cellWidth / contentScrollWidth, 1);
                        contentDiv.style.transform = `scale(${scale})`;
                    }
                }
            });
        });
    }, [isLoaded, content, scrollPosition]);

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
        padding: '10px',
        margin: '1px',
        position: 'relative',
        willChange: 'transform',
        borderRadius: '50%',
        overflow: 'hidden', // Clip content inside the div
        maxWidth: '200px',
        transformOrigin: 'center',
    }

    const baseStyle = {
        minWidth: '100px'
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
            }}>
            {content.map((row, rowIndex) => (
                <div key={rowIndex} 
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: `repeat(${NUM_COLS}, minmax(auto, 100px))`,
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
                                data-cell={`${rowIndex}-${index}`}
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
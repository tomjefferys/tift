/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useReducer, CSSProperties } from 'react';
import { getTransform } from './transformBuilder';

// Are we running in a test environment, if so always show the grid
const ALWAYS_SHOW = process.env.NODE_ENV === 'test';

type MouseState = "mouseDown" | "dragging" | "mouseUp" | "mouseUpAfterDrag";

export interface Item {
    item: React.ReactNode;
    style?: React.CSSProperties;
}   

export interface Content {
    content : (Item | undefined)[][];
}

const NUM_COLS = 10;

const isUp = (state: MouseState) => state === "mouseUp" || state === "mouseUpAfterDrag";

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

    // State to track if the component has loaded, so we don't show the content before it's ready
    const [isLoaded, setIsLoaded] = useState(false);

    // State to track if the user is dragging the mouse
    const [mouseState, setMouseState] = useState<MouseState>("mouseUp");

    const [startMousePosition, setStartMousePosition] = useState({ x: 0, y: 0 });
    const [startScrollPosition, setStartScrollPosition] = useState({ scrollTop: 0, scrollLeft: 0 });

    // Keep track of mouse intertia
    const velocityRef = useRef({ x: 0, y: 0 });
    const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
    const inertiaRef = useRef<number | null>(null);

    // Refs to store the container and the outer divs
    // The outer divs are not scaled or translated so can be relied on to get the correct size and location
    const containerRef = useRef<HTMLDivElement>(null);
    const outerDivs = useRef<DOMRect[][]>([]);

    const debouncedHandleScroll = useCallback(debounce(() => {
        if (containerRef.current) {
            forceUpdate();
        }
    }, 1000/60), []);

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


    const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {

        if (isUp(mouseState)) {
            setMouseState("mouseDown");
        } else {
            return;
        }

        // Prevent default scrolling behaviour from being triggered
        event.preventDefault();
        event.stopPropagation();

        // Stop any inertia effect
        if (inertiaRef.current) {
            cancelAnimationFrame(inertiaRef.current);
            inertiaRef.current = null;
        }
        velocityRef.current = { x: 0, y: 0 };

        setStartMousePosition({ x: event.clientX, y: event.clientY });
        const scrollTop = containerRef.current?.scrollTop || 0;
        const scrollLeft = containerRef.current?.scrollLeft || 0;
        setStartScrollPosition({ scrollTop, scrollLeft });
    }, []);
    
    const handleClick = useCallback((event: MouseEvent) => {

        // Prevent default behavior to avoid text selection
        event.preventDefault();

        if (mouseState === "dragging") {
            event.stopImmediatePropagation();
        }

        // Stop propagation for the click after dragging
        // This bit is essential to stop the click event from propagating
        // to the child element when dragging
        if (mouseState === "mouseUpAfterDrag") {
            event.stopImmediatePropagation();
        }
    }, [mouseState]);

    const handleMouseUp = useCallback((event: MouseEvent) => {
        if (!isUp(mouseState)) {
            const newState = mouseState === "dragging" ? "mouseUpAfterDrag" : "mouseUp";
            setMouseState(newState);
        } 
        
        event.preventDefault();
        if (mouseState === "dragging") {
            event.stopImmediatePropagation();
        }
        // Stop propagation for the mouseup after dragging
        if (mouseState === "mouseUpAfterDrag") {
            event.stopImmediatePropagation();
        }

        // Start inertia effect
        if (velocityRef.current.x !== 0 || velocityRef.current.y !== 0) {
            inertiaRef.current = requestAnimationFrame(applyInertia);
        }
    }, [mouseState]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!isUp(mouseState) && containerRef.current) {
            setMouseState("dragging");

            // Prevent default behavior to avoid text selection
            // and default scrolling behavior
            event.preventDefault();
            event.stopPropagation();

            const containerRect = containerRef.current.getBoundingClientRect();
            const isMouseOut = event.clientY < containerRect.top 
                                || event.clientY > containerRect.bottom;

            const x = Math.min(
                        Math.max(event.clientX, containerRect.left), 
                        containerRect.right);
            
            const y = Math.min(
                        Math.max(event.clientY, containerRect.top),
                        containerRect.bottom);

            if (!isMouseOut) {
                const dx = x - startMousePosition.x;
                const dy = y - startMousePosition.y;
                containerRef.current.scrollLeft = startScrollPosition.scrollLeft - dx;
                containerRef.current.scrollTop = startScrollPosition.scrollTop - dy;
            }

            // Calculate the velocity based on the mouse movement
            let deltaX = event.clientX - lastMousePosition.x;
            let deltaY = event.clientY - lastMousePosition.y;

            const MAX_VELOCITY = 20; // Maximum velocity

            // Don't allow the velocity to be too high
            if (Math.abs(deltaX) > MAX_VELOCITY) {
                deltaX = Math.sign(deltaX) * MAX_VELOCITY;
            }

            if (Math.abs(deltaY) > MAX_VELOCITY) {
                deltaY = Math.sign(deltaY) * MAX_VELOCITY;
            }

            // Do we need to think about the time between events?
            velocityRef.current = { x: deltaX, y: deltaY };

            setLastMousePosition({ x, y });

        }
    }, [mouseState, lastMousePosition, startMousePosition, startScrollPosition]);
    
    const applyInertia = () => {
        if (containerRef.current) {
            const { x, y } = velocityRef.current

            // Apply deceleration
            const newVelocity = {
                x: x * 0.95,
                y: y * 0.95,
            };

            // Update scroll position based on velocity
            containerRef.current.scrollLeft -= newVelocity.x;
            containerRef.current.scrollTop -= newVelocity.y;

            // Stop inertia when velocity is very low
            if (Math.abs(newVelocity.x) < 0.1 && Math.abs(newVelocity.y) < 0.1) {
                velocityRef.current = { x: 0, y: 0 };
                if (inertiaRef.current) {
                    cancelAnimationFrame(inertiaRef.current);
                    inertiaRef.current = null;
                }
            } else {
                velocityRef.current = newVelocity;
                inertiaRef.current = requestAnimationFrame(applyInertia);
            }
        }
    };

    useEffect(() => {
        if (mouseState === "mouseDown" || mouseState === "dragging") {
            document.addEventListener('mousemove', handleMouseMove, true);
            document.addEventListener('mouseup', handleMouseUp, true);
            document.addEventListener('click', handleClick, true);
        } else if (mouseState === "mouseUpAfterDrag") {
            // Maintain the event listeners for a short time after dragging
            // to allow for click events to be captured and propagation to be stopped
            document.addEventListener('mouseup', handleMouseUp, true);
            document.addEventListener('click', handleClick, true);
        } else {
            // Remove the event listeners when dragging ends
            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
            document.removeEventListener('click', handleClick, true);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('mouseup', handleMouseUp, true);
            document.removeEventListener('click', handleClick, true);
        };
    }, [mouseState, handleMouseMove, handleMouseUp, handleClick]);

    // Calculate the transform for each element based on its position in the container
    // and the scroll position of the container
    const calculateTransform = (rowIndex: number, index: number) : string => {
        if (!outerDivs.current || !outerDivs.current[rowIndex] || !outerDivs.current[rowIndex][index] || !containerRef.current) {
            return '';
        }
        const containerRect = containerRef.current.getBoundingClientRect();
        const cellRect = outerDivs.current[rowIndex][index];
        return getTransform(containerRect, cellRect);
    }

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
        border: '1px solid white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',  
        padding: '10px',
        margin: '1px',
        position: 'relative',
        willChange: 'transform',
        borderRadius: '50%',
        overflow: 'hidden', // Clip content inside the div
        boxShadow: '0 0 5px rgba(0, 0, 0, 0.2)', // Add subtle shadow
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
                padding: '0vh 15vw',
                border: '1px solid white',
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
                                style={getCellStyle(item)}
                                data-foo="bar"
                                ref={(el) => {
                                    if (el) {
                                        const transform = calculateTransform(rowIndex, index);
                                        el.style.transform = transform;
                                    }
                                }}
                            >
                                {item?.item}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default BubbleGrid;
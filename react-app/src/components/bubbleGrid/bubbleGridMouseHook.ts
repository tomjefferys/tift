import { useState, useRef, useCallback, useEffect } from 'react';

const MINIMUM_DRAG_DISTANCE = 5;

type MouseState = "mouseDown" | "dragging" | "mouseUp" | "mouseUpAfterDrag";

const isUp = (state: MouseState) => state === "mouseUp" || state === "mouseUpAfterDrag";

export function useBubbleGridMouse(containerRef: React.RefObject<HTMLDivElement | null>) {
    // State to track if the user is dragging the mouse
    const [mouseState, setMouseState] = useState<MouseState>("mouseUp");

    const [startMousePosition, setStartMousePosition] = useState({ x: 0, y: 0 });
    const [startScrollPosition, setStartScrollPosition] = useState({ scrollTop: 0, scrollLeft: 0 });

    // Keep track of mouse intertia
    const velocityRef = useRef({ x: 0, y: 0 });
    const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
    const inertiaRef = useRef<number | null>(null);

    const getDistance : (event : MouseEvent) => number = (event) => {
        const dx = event.clientX - startMousePosition.x;
        const dy = event.clientY - startMousePosition.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

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

        const distance = getDistance(event);
        if (distance < MINIMUM_DRAG_DISTANCE) {
            return;
        }

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
        
        // Check how far the mouse has moved since start
        const distance = getDistance(event);
        if (distance < MINIMUM_DRAG_DISTANCE) {
            return;
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

    return {
        handleMouseDown,
        mouseState,
    }
}
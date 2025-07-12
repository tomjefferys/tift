
interface Vector {
    x: number;
    y: number;
}

const CONTAINER_HEIGHT_MULTIPLIER = 1.25;
const CONTAINER_WIDTH_MULTIPLIER = 1.25;

export const getTransform = (container: DOMRect, cell: DOMRect): string => {
    const centreDelta = getRatioFromCentre(container, cell);
    const scale = getScale(centreDelta);
    const totalScale = scale.x * scale.y;
    const { x, y } = getTranslation(centreDelta, scale, container, cell);
    // Translate must come before scale, or the translation amounts will be scaled
    return `translateZ(0) translate(${x}px, ${y}px) scale(${totalScale})`;
}

const getRatioFromCentre = (container: DOMRect, cell: DOMRect): Vector => {

    //console.log("getRatioFromCentre", container, cell);

    // Get the centre of the container and the element
    const containerCentre = {
        x: container.left + container.width / 2,
        y: container.top + container.height / 2,
    };
    const elementCentre = {
        x: cell.left + cell.width / 2,
        y: cell.top + cell.height / 2,
    };

    // Increase the height of the container, so elements off the top and bottom are scaled and potentially shown
    const height = container.height * CONTAINER_HEIGHT_MULTIPLIER;

    // Calculate the vertical scale based on the distance from the centre of the container
    const verticalDistance = containerCentre.y - elementCentre.y;
    const y = verticalDistance / (height / 2);

    const width = container.width * CONTAINER_WIDTH_MULTIPLIER;

    const horizontalDistance = containerCentre.x - elementCentre.x;
    const x = horizontalDistance / (width / 2);
    return { x, y };
}


const getScale = (ratioFromCentre: Vector): Vector => {
    const SHRINK_AREA = 0.5;  // The area where the element will shrink, defined as a fraction the distance from the centre.

    const { x, y } = ratioFromCentre;
    let yScale = 1;
    if (Math.abs(y) > (1 - SHRINK_AREA)) {
        const dY = Math.abs(y) - (1 - SHRINK_AREA);
        yScale = 1 - dY / SHRINK_AREA;
    }
    //console.log("yScale", yScale, "y", y, "dY", Math.abs(y) - (1 - SHRINK_AREA));
    yScale = Math.max(0, yScale);

    let xScale = 1;
    if (Math.abs(x) > (1 - SHRINK_AREA)) {
        const dX = Math.abs(x) - (1 - SHRINK_AREA);
        xScale = 1 - dX / SHRINK_AREA;
    }
    //console.log("xScale", xScale, "x", x, "dX", Math.abs(x) - (1 - SHRINK_AREA));
    xScale = Math.max(0, xScale);
    return { x: xScale, y: yScale};
};

const getTranslation = (centreDelta: Vector, scale: Vector, container: DOMRect, cell: DOMRect): Vector => {
    // Calculate the translation based on the scale
    const MARGIN_SIZE = 2;
    const height = cell.height + MARGIN_SIZE;
    const width = cell.width + MARGIN_SIZE;

    const translateYFraction = 1 - scale.y;
    const translateYMagnitude = (height * translateYFraction) / 2;
    let y = (Math.sign(centreDelta.y)) * translateYMagnitude;

    const translateXFraction = 1 - scale.x;
    const translateXMagnitude = (width * translateXFraction) / 2;
    let x = (Math.sign(centreDelta.x)) * translateXMagnitude;

    // Calculate the vertical translation to keep elements in adjacent rows close
    // Calculate the difference between the spacing of the rows and the optimal spacing.
    const hRadius = height / 2;
    const optimalVerticalDistance = Math.sqrt(3) * hRadius;

    const verticalAdjustment = height - optimalVerticalDistance;
    if (Math.abs(centreDelta.y) < 2) {
        const distanceFormCentre = centreDelta.y * (container.height / 2);
        const adjustmentRatio = distanceFormCentre / height;
        const dy = adjustmentRatio * verticalAdjustment;
        y += dy;
    }

    // Calculate additional translation to handle contiguous rows/columns being scaled
    // If the centre + height is outside the shrink area then both this element, and the next closest
    // to the center wil be scaled, so we need to adjust the translation further

    // How many widths past the scaling boundary are we?
    // Calculate width as a fraction of the container size
    const SHRINK_AREA = 0.5;
    const widthRatio = (width / ((container.width / 2) * CONTAINER_WIDTH_MULTIPLIER));  // Divide by 2 as comparing this to the distance from the centre
    const dxFromShrinkArea = Math.abs(centreDelta.x) - (1 - SHRINK_AREA);
    if (dxFromShrinkArea > 0) {
        const widthsFromShrinkArea = dxFromShrinkArea / widthRatio;
        if (widthsFromShrinkArea > 1) {
            // Need to increase the translation to cope with double shrinkage
            x += x * (widthsFromShrinkArea - 1);
        }
    }

    const heightRatio = (height / ((container.height / 2) * CONTAINER_HEIGHT_MULTIPLIER));
    const dyFromShrinkArea = Math.abs(centreDelta.y) - (1 - SHRINK_AREA);
    if (dyFromShrinkArea > 0) {
        const heightsFromShrinkArea = dyFromShrinkArea / heightRatio;
        if (heightsFromShrinkArea > 1) {
            // Need to increase the translation to cope with double shrinkage
            y += y * (heightsFromShrinkArea - 1);
        }
    }

    return { x, y };
};

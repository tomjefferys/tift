import { Axial, HexMap } from "../../util/hex";
import * as BubbleGrid from "../bubbleGrid/BubbleGrid";

interface BubbleOptionsGridProps {
    labels : string[];
    onSelect : (index : number) => void;
}

const CELL_STYLE : React.CSSProperties = {
    border : `1px solid var(--bubble-border-color)`,
    minHeight : "60px",
    maxHeight : "60px",
};

// Lays a flat list of option labels out in the same hex-spiral, "Apple Watch
// style" arrangement Controls.tsx's WordBubbles uses for in-game word-tap
// commands (HexMap.fromSpiral + fillHex to pad out small option sets so they
// don't look lopsided) - but content-agnostic (plain labelled buttons, not
// tift-types Word objects), so it can be reused for the editor's bubble
// wizard as well.
const BubbleOptionsGrid = ({ labels, onSelect } : BubbleOptionsGridProps) => {
    const cells = labels.map((label, index) => (
        <button key={index} type="button" className="word-button bubble-option-button"
                onClick={() => onSelect(index)}>
            {label}
        </button>
    ));

    const items : BubbleGrid.Item[] = cells.map(cell => ({ item : cell, style : CELL_STYLE }));
    const hexMap = HexMap.fromSpiral(Axial.ZERO, items);

    // Pad out with blank cells so a small option set doesn't look sparse -
    // same reasoning as WordBubbles (Controls.tsx).
    const blankCell = { item : <div />, style : CELL_STYLE };
    const populatedRadius = hexMap.getRadius(Axial.ZERO);
    const fillRadius = populatedRadius < 3 ? populatedRadius + 1 : populatedRadius;
    hexMap.fillHex(Axial.ZERO, fillRadius, blankCell);

    const rows = hexMap.toArray();
    return <BubbleGrid.BubbleGrid content={rows} />;
};

export default BubbleOptionsGrid;

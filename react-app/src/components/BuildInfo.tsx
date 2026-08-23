const BuildInfo = () => (
    <div
        data-testid="build-info"
        style={{
            position: 'fixed',
            bottom: 2,
            right: 4,
            fontSize: '10px',
            fontFamily: 'monospace',
            color: 'rgba(128, 128, 128, 0.6)',
            pointerEvents: 'none',
            zIndex: 9999,
            userSelect: 'none',
        }}
    >
        {__BUILD_VERSION__} · {__BUILD_TIME__}
    </div>
);

export default BuildInfo;

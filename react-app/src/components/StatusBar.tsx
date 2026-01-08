interface Status {
    status : string;
}

const StatusBar = ({ status } : Status) => (
    <div className="status-bar">
        <h2 className="status-heading" data-testid="status">{status}</h2>
    </div>
);

export default StatusBar;
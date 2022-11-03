
interface Status {
    status : string;
}

const StatusBar = ({ status } : Status) => (
    <div><b>{status}</b></div>
);

export default StatusBar;
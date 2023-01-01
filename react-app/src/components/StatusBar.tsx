import { Box, Heading } from "@chakra-ui/react";

interface Status {
    status : string;
}

const StatusBar = ({ status } : Status) => (
    <Box bg="blue.600" boxShadow="md" p="1" textAlign={"center"}><Heading size="md">{status}</Heading></Box>
);

export default StatusBar;
import { Box, Heading } from "@chakra-ui/react";

interface Status {
    status : string;
}

const StatusBar = ({ status } : Status) => (
    <Box w="100%" bg="blue.600" boxShadow="md" p="1" textAlign={"center"}>
        <Heading size="md" data-testid="status">{status}</Heading>
    </Box>
);

export default StatusBar;
import Tift from './components/Tift';
import { ChakraProvider } from '@chakra-ui/react'
import Div100vh from 'react-div-100vh';
import { extendTheme, theme as defaultTheme } from "@chakra-ui/react";


const lightBg = defaultTheme.semanticTokens.colors['chakra-body-bg']._light;
const darkBg = defaultTheme.semanticTokens.colors['chakra-body-bg']._dark;

// Define dark/light sensitive background colours to make hover effect invisible on touch devices
const theme = extendTheme({
  semanticTokens: {
    colors: {
      hoverbg: {
        _light: lightBg, 
        _dark: darkBg, 
      }
    }
  },
})


function App() {
  return (
    <ChakraProvider theme={theme}>
      <Div100vh>
        <Tift/>
      </Div100vh>
    </ChakraProvider>
  );
}

export default App;
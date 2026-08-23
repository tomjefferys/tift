import { useState } from 'react';
import Tift from './components/Tift';
import BuildInfo from './components/BuildInfo';
import Div100vh from 'react-div-100vh';
import { resolveShowBuildInfo } from './util/buildInfoVisibility';


function App() {
  const [showBuildInfo] = useState(resolveShowBuildInfo);
  return (
    <Div100vh>
      <Tift/>
      {showBuildInfo && <BuildInfo/>}
    </Div100vh>
  );
}

export default App;
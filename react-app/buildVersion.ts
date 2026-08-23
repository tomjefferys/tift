import { execSync } from 'child_process';

const gitCommand = (command: string): string => {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

export const getBuildDefines = (): Record<string, string> => {
  const commitHash = gitCommand('git rev-parse --short HEAD') || 'unknown';
  const isDirty = gitCommand('git status --porcelain') !== '';
  const buildVersion = `${commitHash}${isDirty ? '-dirty' : ''}`;
  const buildTime = new Date().toISOString();

  return {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  };
};

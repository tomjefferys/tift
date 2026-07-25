import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as reactutils from './util/reactutils';

// Mock localStorage properly for tests
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  const mock = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };

  return mock;
})();

// A second, distinct game to import, separate from the "adventure.yaml"
// test fixture mocked in setupTests.ts
const IMPORTED_GAME_DATA = `
---
game: Desert Game
author: Test Author
version: 1.0.0
gameId: Desert5678
options:
  - useDefaultVerbs
---
room: dunes
description: Endless sand dunes
tags: [start]
exits:
  east: oasis
---
room: oasis
description: A small oasis with palm trees
exits:
  west: dunes
---
item: canteen
description: a metal canteen
location: dunes
tags:
  - carryable
---
`;

// Mock file operations for import/export testing
let capturedExports: { filename: string; content: string }[] = [];

const mockDownloadTextFile = vi.fn((filename: string, content: string) => {
  capturedExports.push({ filename, content });
});

const mockPromptForTextFile = vi.fn((_title: string, _allowedExtensions: string[]) => {
  return Promise.resolve(IMPORTED_GAME_DATA);
});

vi.spyOn(reactutils, 'downloadTextFile').mockImplementation(mockDownloadTextFile);
vi.spyOn(reactutils, 'promptForTextFile').mockImplementation(mockPromptForTextFile);

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  capturedExports = [];
  mockDownloadTextFile.mockClear();
  mockPromptForTextFile.mockImplementation(() => Promise.resolve(IMPORTED_GAME_DATA));
});

function getButton(name: string, role = "button"): HTMLElement {
  return screen.getByRole(role, { name });
}

async function openGameManager(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('game manager'));
  await act(() => user.click(getButton('game manager')));
}

test('game manager shows import and cancel when no games are saved', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  await openGameManager(user);

  await waitFor(() => getButton('import game'));
  await waitFor(() => getButton('cancel'));

  const gameButtons = screen.queryAllByRole('button', { name: /Desert Game/ });
  expect(gameButtons).toHaveLength(0);
});

test('can cancel out of game manager', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);

  await waitFor(() => getButton('cancel'));
  await act(() => user.click(getButton('cancel')));

  await waitFor(() => screen.getByText(/cancelled/));

  // Should still be in the original game, unaffected
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });
});

test('can import a game and it loads immediately', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);

  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));

  await waitFor(() => expect(mockPromptForTextFile).toHaveBeenCalledTimes(1));
  await waitFor(() => screen.getByText(/Game "Desert Game" imported\./));
  await waitFor(() => screen.getByText(/Game loaded\./));

  // The newly imported game should now be running
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });
});

test('imported game is saved to the library and can be reloaded later', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));
  await waitFor(() => screen.getByText(/Game loaded\./));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });

  // Move away from the start room so we can tell a fresh load apart from "still there"
  await waitFor(() => getButton('Game', 'tab'));
  await act(() => user.click(getButton('Game', 'tab')));
  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));
  await waitFor(() => getButton('east'));
  await act(() => user.click(getButton('east')));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('oasis');
  });

  // Reopen the game manager - the saved game should be listed
  await openGameManager(user);
  await waitFor(() => {
    const savedGame = screen.getByRole('button', { name: 'Desert Game' });
    expect(savedGame).toBeInTheDocument();
  });

  const savedGame = screen.getByRole('button', { name: 'Desert Game' });
  await act(() => user.click(savedGame));

  await waitFor(() => getButton('load'));
  await act(() => user.click(getButton('load')));

  await waitFor(() => screen.getAllByText(/Game loaded/));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });
});

test('can export a saved game', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));
  await waitFor(() => screen.getByText(/Game loaded\./));

  await openGameManager(user);
  const savedGame = await waitFor(() => screen.getByRole('button', { name: 'Desert Game' }));
  await act(() => user.click(savedGame));

  await waitFor(() => getButton('export'));
  await act(() => user.click(getButton('export')));

  await waitFor(() => {
    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1);
    expect(capturedExports).toHaveLength(1);
  });

  const exported = capturedExports[0];
  expect(exported.filename).toMatch(/\.yaml$/);
  expect(exported.content).toContain('game: Desert Game');
  expect(exported.content).toContain('gameId: Desert5678');
});

test('can delete a saved game', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));
  await waitFor(() => screen.getByText(/Game loaded\./));

  await openGameManager(user);
  const savedGame = await waitFor(() => screen.getByRole('button', { name: 'Desert Game' }));
  await act(() => user.click(savedGame));

  await waitFor(() => getButton('delete'));
  await act(() => user.click(getButton('delete')));

  await waitFor(() => screen.getByText(/Game deleted\./));

  await openGameManager(user);
  const remaining = screen.queryAllByRole('button', { name: 'Desert Game' });
  expect(remaining).toHaveLength(0);
});

test('can switch back to the default game after importing another one', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));
  await waitFor(() => screen.getByText(/Game loaded\./));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });

  // Switch back to the default game
  await openGameManager(user);
  await waitFor(() => getButton('default game'));
  await act(() => user.click(getButton('default game')));

  await waitFor(() => screen.getAllByText(/Game loaded/));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // The imported game should still be in the library, untouched
  await openGameManager(user);
  await waitFor(() => {
    const savedGame = screen.getByRole('button', { name: 'Desert Game' });
    expect(savedGame).toBeInTheDocument();
  });
});

test('import handles failures gracefully and returns to the game', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};

  mockPromptForTextFile.mockImplementationOnce(() => Promise.reject(new Error('File selection cancelled')));

  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));

  await waitFor(() => screen.getAllByText(/Failed to import game/));

  // Back to the normal game interface, original game untouched
  await waitFor(() => getButton('go'));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });
});

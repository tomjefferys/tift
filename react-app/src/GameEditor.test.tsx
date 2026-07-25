import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

// A distinct game to import and then edit, separate from the "adventure.yaml"
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
`;

// Same game, but with an edited room description - a valid edit
const EDITED_GAME_DATA = IMPORTED_GAME_DATA.replace(
  "description: Endless sand dunes",
  "description: Endless shifting dunes, freshly edited"
);

// Same game, but with a syntax error (unterminated string) - an invalid edit
const BROKEN_GAME_DATA = IMPORTED_GAME_DATA.replace(
  "exits:\n  east: oasis",
  "exits:\n  east: oasis\nafterTurn(): print(\"Hello)"
);

const mockPromptForTextFile = vi.fn((_title: string, _allowedExtensions: string[]) => {
  return Promise.resolve(IMPORTED_GAME_DATA);
});

vi.spyOn(reactutils, 'promptForTextFile').mockImplementation(mockPromptForTextFile);

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
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

async function importDesertGame(user: ReturnType<typeof userEvent.setup>) {
  await openGameManager(user);
  await waitFor(() => getButton('import game'));
  await act(() => user.click(getButton('import game')));
  await waitFor(() => screen.getByText(/Game loaded\./));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });
}

async function openEditorForDesertGame(user: ReturnType<typeof userEvent.setup>) {
  await openGameManager(user);
  const savedGame = await waitFor(() => screen.getByRole('button', { name: 'Desert Game' }));
  await act(() => user.click(savedGame));

  await waitFor(() => getButton('edit'));
  await act(() => user.click(getButton('edit')));

  return await waitFor(() => screen.getByLabelText('game yaml editor')) as HTMLTextAreaElement;
}

test('editing a saved game opens a full-screen editor with its current YAML', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);

  const textarea = await openEditorForDesertGame(user);
  expect(textarea.value).toContain('game: Desert Game');
  expect(textarea.value).toContain('Endless sand dunes');
});

test('saving invalid YAML shows a validation error and keeps the editor open', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  const textarea = await openEditorForDesertGame(user);

  fireEvent.change(textarea, { target: { value: BROKEN_GAME_DATA } });
  await act(() => user.click(getButton('save')));

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

  // Editor should still be open, with the (unsaved) broken text intact
  expect(screen.getByLabelText('game yaml editor')).toBeInTheDocument();
});

test('saving valid YAML persists the change, closes the editor and reloads the game', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  const textarea = await openEditorForDesertGame(user);

  fireEvent.change(textarea, { target: { value: EDITED_GAME_DATA } });
  await act(() => user.click(getButton('save')));

  await waitFor(() => screen.getByText(/Game saved\./));

  // Editor should be closed, and back in the normal play UI
  expect(screen.queryByLabelText('game yaml editor')).not.toBeInTheDocument();

  // The game should have reloaded with the edited content (autolook prints
  // the new room description on start)
  await waitFor(() => screen.getByText(/Endless shifting dunes, freshly edited/));

  // Re-opening the editor should show the persisted, edited text
  const reopened = await openEditorForDesertGame(user);
  expect(reopened.value).toContain('Endless shifting dunes, freshly edited');
});

test('cancelling the editor discards changes', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  const textarea = await openEditorForDesertGame(user);

  fireEvent.change(textarea, { target: { value: EDITED_GAME_DATA } });
  await act(() => user.click(getButton('cancel')));

  expect(screen.queryByLabelText('game yaml editor')).not.toBeInTheDocument();

  // The running game should be untouched
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });

  // Re-opening the editor should show the original, un-edited text
  const reopened = await openEditorForDesertGame(user);
  expect(reopened.value).toContain('Endless sand dunes');
  expect(reopened.value).not.toContain('freshly edited');
});

test('typing in the editor does not leak into the game as a command', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  const textarea = await openEditorForDesertGame(user);

  // "go east" is a valid, executable command in the imported game (dunes ->
  // oasis). Typing it into the editor's textarea must not also be picked up
  // by the app's global bubble-keyboard-shortcut handler.
  await act(() => user.type(textarea, 'go east '));
  expect(textarea.value).toContain('go east ');

  await act(() => user.click(getButton('cancel')));

  // The game should still be sitting in "dunes", not have silently
  // navigated to "oasis" because of the typed keystrokes.
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });
});

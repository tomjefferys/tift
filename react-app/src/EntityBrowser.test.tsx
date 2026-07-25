import { render, screen, waitFor, act, within } from '@testing-library/react';
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

// A distinct game to import and then browse/edit the entities of
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

async function openEntityBrowserForDesertGame(user: ReturnType<typeof userEvent.setup>) {
  await openGameManager(user);
  const savedGame = await waitFor(() => screen.getByRole('button', { name: 'Desert Game' }));
  await act(() => user.click(savedGame));

  await waitFor(() => getButton('entities'));
  await act(() => user.click(getButton('entities')));

  await waitFor(() => screen.getByText(/Entities:/));
}

test('entities browser lists the game\'s existing rooms and items', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  expect(getButton('dunes')).toBeInTheDocument();
  expect(getButton('oasis')).toBeInTheDocument();
  expect(getButton('canteen')).toBeInTheDocument();
});

test('adding a new room persists after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add room')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'spring'));
  await act(() => user.click(getButton('save')));

  // Back on the room/item list, the new room should be there
  await waitFor(() => expect(getButton('spring')).toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  // Re-open the browser - the new room should have persisted to the library
  await openEntityBrowserForDesertGame(user);
  expect(getButton('spring')).toBeInTheDocument();
});

test('editing a room description takes effect after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('dunes')));
  await waitFor(() => screen.getByLabelText('description'));
  const description = screen.getByLabelText('description') as HTMLTextAreaElement;
  await act(() => user.clear(description));
  await act(() => user.type(description, 'Endless shifting dunes, freshly edited'));
  await act(() => user.click(getButton('save')));

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  // autolook should print the updated description for the (still) starting room
  await waitFor(() => screen.getByText(/Endless shifting dunes, freshly edited/));
});

test('rejects a new entity id that is already in use', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add item')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'canteen'));
  await act(() => user.click(getButton('save')));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already in use/));

  // Still on the form, no duplicate was created
  expect(screen.getByLabelText('id')).toBeInTheDocument();
});

test('deleting a room removes it after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('oasis')));
  await waitFor(() => getButton('delete'));
  await act(() => user.click(getButton('delete')));

  await waitFor(() => expect(screen.queryByRole('button', { name: 'oasis' })).not.toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  await openEntityBrowserForDesertGame(user);
  expect(screen.queryByRole('button', { name: 'oasis' })).not.toBeInTheDocument();
  expect(getButton('dunes')).toBeInTheDocument();
});

test('cancelling the browser discards all pending entity edits', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add room')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'spring'));
  await act(() => user.click(getButton('save')));
  await waitFor(() => expect(getButton('spring')).toBeInTheDocument());

  await act(() => user.click(getButton('cancel')));

  // Back in the normal game, untouched
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('dunes');
  });

  // Re-opening should show the original rooms only - the pending "spring"
  // room was never saved
  await openEntityBrowserForDesertGame(user);
  expect(screen.queryByRole('button', { name: 'spring' })).not.toBeInTheDocument();
});

test('adding a new transitive verb persists after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add verb')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'dig'));
  await act(() => user.click(getButton('save')));

  await waitFor(() => expect(getButton('dig')).toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  await openEntityBrowserForDesertGame(user);
  expect(getButton('dig')).toBeInTheDocument();
});

test('editing a verb\'s attributes and transitivity persists after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add verb')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'stir'));
  await act(() => user.click(getButton('intransitive')));
  const attributesInput = screen.getByPlaceholderText('eg. with');
  await act(() => user.type(attributesInput, 'with'));
  const attributesField = attributesInput.closest('.form-field') as HTMLElement;
  await act(() => user.click(within(attributesField).getByRole('button', { name: 'add' })));
  await waitFor(() => screen.getByText('with'));
  await act(() => user.click(getButton('save')));
  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  await openEntityBrowserForDesertGame(user);
  await act(() => user.click(getButton('stir')));
  await waitFor(() => screen.getByText('with'));
  expect(getButton('intransitive')).toHaveAttribute('aria-pressed', 'true');
});

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
item: lamp
description: a brass lamp
location: dunes
before:
  examine(this): setTag(this, 'seen')
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

// Grabs the most recently mounted element matching selector - used to scope
// queries into a specific ExpressionEditor row when several with identically
// labelled controls (eg "call", "raw", "add argument") can be on screen at
// once (a matcher's arguments and a rule's commands both use "add argument").
function lastOf(selector: string): HTMLElement {
  const all = document.querySelectorAll<HTMLElement>(selector);
  return all[all.length - 1];
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

test('adding a before clause to an item takes effect on examine after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('canteen')));
  await waitFor(() => screen.getByLabelText('id'));

  // Expand the (initially empty) "before" action block and add a clause
  await act(() => user.click(getButton('before (0)')));
  await act(() => user.click(getButton('add before clause')));

  await waitFor(() => screen.getByLabelText('verb'));
  await act(() => user.type(screen.getByLabelText('verb'), 'examine'));
  // The default new argument is `this` - exactly what we want for examine(this)
  await act(() => user.click(getButton('add argument')));

  await act(() => user.click(getButton('add command')));
  const commandRow = lastOf('.rule-value-list-item');
  await act(() => user.click(within(commandRow).getByRole('button', { name: 'call' })));
  await act(() => user.click(within(commandRow).getByRole('button', { name: 'add argument' })));
  const argRow = lastOf('.expression-arg-row');
  await act(() => user.type(within(argRow).getByLabelText('literal value'), "It has a leather strap"));

  await act(() => user.click(getButton('done')));
  await act(() => user.click(getButton('save')));
  await waitFor(() => expect(getButton('canteen')).toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  // Play: examine the canteen and confirm the new before-clause fired
  await waitFor(() => getButton('examine'));
  await act(() => user.click(getButton('examine')));
  await waitFor(() => getButton('canteen'));
  await act(() => user.click(getButton('canteen')));

  await waitFor(() => screen.getByText(/It has a leather strap/));
});

test('adding an actions clause to a new verb persists after save & close', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add verb')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'dig'));

  await act(() => user.click(getButton('actions (0)')));
  await act(() => user.click(getButton('add actions clause')));

  await waitFor(() => screen.getByLabelText('verb'));
  await act(() => user.type(screen.getByLabelText('verb'), 'dig'));
  await act(() => user.click(getButton('add argument')));

  await act(() => user.click(getButton('add command')));
  const commandRow = lastOf('.rule-value-list-item');
  await act(() => user.click(within(commandRow).getByRole('button', { name: 'call' })));
  await act(() => user.click(within(commandRow).getByRole('button', { name: 'add argument' })));
  const argRow = lastOf('.expression-arg-row');
  await act(() => user.type(within(argRow).getByLabelText('literal value'), "You dig a hole"));

  await act(() => user.click(getButton('done')));
  await act(() => user.click(getButton('save')));
  await waitFor(() => expect(getButton('dig')).toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  // Re-open the browser - the persisted actions clause should still be there.
  // The "actions" block starts expanded already since it's non-empty.
  await openEntityBrowserForDesertGame(user);
  await act(() => user.click(getButton('dig')));
  await waitFor(() => getButton('dig(this)'));
});

test('the engine\'s built-in verbs are offered as matcher suggestions, even for a game with no custom verbs', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  // The desert game defines no custom verbs at all - the suggestions must
  // be coming from the engine's built-in verb list (defaultverbs.ts).
  await act(() => user.click(getButton('canteen')));
  await act(() => user.click(getButton('before (0)')));
  await act(() => user.click(getButton('add before clause')));

  await waitFor(() => screen.getByLabelText('verb'));
  expect(getButton('examine')).toBeInTheDocument();
  expect(getButton('get')).toBeInTheDocument();
  expect(getButton('push')).toBeInTheDocument();
});

test('switching a rule to raw and editing its JSON actually persists the edit', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  await act(() => user.click(getButton('add verb')));
  await waitFor(() => screen.getByLabelText('id'));
  await act(() => user.type(screen.getByLabelText('id'), 'whistle'));

  await act(() => user.click(getButton('actions (0)')));
  await act(() => user.click(getButton('add actions clause')));

  await waitFor(() => screen.getByLabelText('verb'));
  await act(() => user.type(screen.getByLabelText('verb'), 'whistle'));
  await act(() => user.click(getButton('add argument')));

  // Switch the rule type from the default "commands" to "raw" and edit its
  // underlying JSON directly - this used to silently fail to save.
  await act(() => user.click(getButton('raw')));
  const rawInput = screen.getByLabelText(/raw \(unrecognised/) as HTMLTextAreaElement;
  await act(() => user.clear(rawInput));
  await act(() => user.type(rawInput, '"print(\'You whistle a merry tune\')"'));
  await waitFor(() => expect(rawInput).toHaveValue("\"print('You whistle a merry tune')\""));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  await act(() => user.click(getButton('done')));
  await act(() => user.click(getButton('save')));
  await waitFor(() => expect(getButton('whistle')).toBeInTheDocument());

  await act(() => user.click(getButton('save & close')));
  await waitFor(() => screen.getByText(/Game saved\./));

  // Re-open: the raw-edited JSON string round-trips as a plain command,
  // parsed back into a structured call (fn "print", one string argument)
  // rather than staying raw text.
  await openEntityBrowserForDesertGame(user);
  await act(() => user.click(getButton('whistle')));
  await waitFor(() => getButton('whistle(this)'));
  await act(() => user.click(getButton('whistle(this)')));
  await waitFor(() => expect(screen.getByLabelText('function')).toHaveValue('print'));
  expect(screen.getByDisplayValue('You whistle a merry tune')).toBeInTheDocument();
});

test('an existing command already authored in YAML renders as a structured call, not raw', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await importDesertGame(user);
  await openEntityBrowserForDesertGame(user);

  // "lamp" is imported with a `before: examine(this) => setTag(this, 'seen')`
  // clause already in its YAML - opening it should parse the command
  // straight into ExpressionEditor's structured "call" mode.
  await act(() => user.click(getButton('lamp')));
  // The "before" block starts expanded already since it's non-empty (one
  // clause already in the imported YAML) - no toggle click needed here.
  await waitFor(() => getButton('examine(this)'));
  await act(() => user.click(getButton('examine(this)')));

  await waitFor(() => expect(screen.getByLabelText('function')).toHaveValue('setTag'));
  expect(screen.getByDisplayValue('seen')).toBeInTheDocument();
  // Not shown as a raw fallback anywhere in the rule editor.
  expect(screen.queryByLabelText(/raw \(unrecognised/)).not.toBeInTheDocument();
});

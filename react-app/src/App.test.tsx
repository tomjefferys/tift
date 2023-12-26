import React from 'react';
import { render, screen, waitFor, cleanup, act, waitForElementToBeRemoved, findByRole, getByTestId } from '@testing-library/react';
import { rest } from 'msw'
import {setupServer} from 'msw/node'
import App from './App';
import userEvent from '@testing-library/user-event';
import * as fs from "fs";

const TEST_DATA = `
---
game: Test Game
options:
  - useDefaultVerbs
---
room: cave
desc: A dark dank cave
tags: [start]
exits:
  south: forest
---
room: forest
desc: A dense verdant forest
exits:
  north: cave
---
item: ball
desc: a round ball
location: cave
tags:
  - carryable
after:
  drop(this):
    do: print('boing boing')
---
`

const server = setupServer(
  rest.get('/adventure.yaml', (req, res, ctx) => {
    return res(ctx.body(TEST_DATA));
  }),
  rest.get('/properties.yaml', (req, res, ctx) => {
    const data = fs.readFileSync("public/properties.yaml", "utf8");
    return res(ctx.body(data));
  }),
  rest.get('/stdlib.yaml', (req, res, ctx) => {
    const data = fs.readFileSync("public/stdlib.yaml", "utf8");
    return res(ctx.body(data));
  })
)

beforeAll(() => server.listen())
beforeEach(() => window.localStorage.clear())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('renders starting room status', async () => {
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  const linkElement = screen.getAllByText('cave');
  expect(linkElement[0]).toBeInTheDocument();
});

test('can change location', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  expect(screen.getByTestId('status')).toHaveTextContent('cave');

  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));

  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');
});

test('can get item', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('clear'));
  await act(() => user.click(getButton('clear')));

  await waitFor(() => getButton('inventory'));
  await act(() => user.click(getButton('inventory')));

  await waitFor(() => screen.getByText('ball'));

  await waitFor(() => getButton('drop'));
  await act(() => user.click(getButton('drop')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => screen.getByText('boing boing'));
})

test('can change location with keyboard', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => getButton('go'));

  await user.keyboard('go ');

  await waitFor(() => getButton('south'));
  await waitFor(() => screen.getAllByText('cave'));

  await user.keyboard('south{Enter}');

  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');
})

test('keyboard autocomplete', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => getButton('go'));

  await user.keyboard('go ');

  await waitFor(() => getButton('south'));
  await waitFor(() => screen.getAllByText('cave'));

  await user.keyboard('s ');
  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');
})

test.skip('undo/redo', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Confirm undo and redo disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'))

  await new Promise(process.nextTick);

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));
  await waitFor(() => screen.getByTestId('__option(undo)__'));
  await waitFor(() => screen.getByTestId('__option(redo)__'));

  expect(getButton('undo')).toBeDisabled();
  expect(getButton('redo')).toBeDisabled();

  // Perform action, and wait to complete
  await act(() => user.click(getButton('Game', 'tab')));
  await user.keyboard('go south{Enter}');
  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');

  // Confirm undo is enabled, and redo is disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeEnabled();
  expect(getButton('redo')).toBeDisabled();

  await user.click(getButton('undo'));

  // Confirm action undo is now disabled, and redo is enabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeDisabled();
  expect(getButton('redo')).toBeEnabled();

  expect(screen.getByTestId('status')).toHaveTextContent('cave');

  // Now try redoing
  await act(() => user.click(getButton('redo')));

  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeEnabled();
  expect(getButton('redo')).toBeDisabled();

  expect(screen.getByTestId('status')).toHaveTextContent('forest');
});

function getButton(name : string, role = "button") : HTMLElement {
  return screen.getByRole(role, { name });
}

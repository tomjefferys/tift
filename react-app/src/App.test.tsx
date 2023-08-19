import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { rest } from 'msw'
import {setupServer} from 'msw/node'
import App from './App';
import userEvent from '@testing-library/user-event';
import * as fs from "fs";

const TEST_DATA = `
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
  rest.get('/defaults.yaml', (req, res, ctx) => {
    const data = fs.readFileSync("public/properties.yaml", "utf8");
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
  await user.click(getButton('go'));

  await waitFor(() => getButton('south'));
  await user.click(getButton('south'));

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
  await user.click(getButton('get'));

  await waitFor(() => getButton('ball'));
  await user.click(getButton('ball'));

  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('clear'));
  await user.click(getButton('clear'));

  await waitFor(() => getButton('inventory'));
  await user.click(getButton('inventory'));

  await waitFor(() => screen.getByText('ball'));

  await waitFor(() => getButton('drop'));
  await user.click(getButton('drop'));

  await waitFor(() => getButton('ball'));
  await user.click(getButton('ball'));

  await waitFor(() => screen.getByText('boing boing'));

})

test('can change location with keyboard', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => getButton('go'));

  user.keyboard('go ');

  await waitFor(() => getButton('south'));
  await waitFor(() => screen.getAllByText('cave'));

  user.keyboard('south{Enter}');

  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');
})

test('keyboard autocomplete', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => getButton('go'));

  user.keyboard('go ');

  await waitFor(() => getButton('south'));
  await waitFor(() => screen.getAllByText('cave'));

  user.keyboard('s ');
  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');
})

test('undo/redo', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Confirm undo and redo disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeDisabled();
  expect(getButton('redo')).toBeDisabled();

  // Perform action, and wait to complete
  await user.click(getButton('Game', 'tab'));
  user.keyboard('go south{Enter}');
  await waitFor(() => screen.getAllByText('forest'));
  expect(screen.getByTestId('status')).toHaveTextContent('forest');

  // Confirm undo is enabled, and redo is disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeEnabled();
  expect(getButton('redo')).toBeDisabled();

  user.click(getButton('undo'));

  // Confirm action undo is now disabled, and redo is enabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeDisabled();
  expect(getButton('redo')).toBeEnabled();

  expect(screen.getByTestId('status')).toHaveTextContent('cave');

  // Now try redoing
  user.click(getButton('redo'));

  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));

  await waitFor(() => getButton('undo'));
  await waitFor(() => getButton('redo'));

  expect(getButton('undo')).toBeEnabled();
  expect(getButton('redo')).toBeDisabled();

  expect(screen.getByTestId('status')).toHaveTextContent('forest');
});

function getButton(name : string, role = "button") : HTMLElement {
  return screen.getByRole(role, { name });
}

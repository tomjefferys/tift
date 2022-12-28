import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw'
import {setupServer} from 'msw/node'
import App from './App';

const TEST_DATA = `
---
room: cave
desc: A dark dank cave
tags: [start]
`

const server = setupServer(
  rest.get('/adventure.yaml', (req, res, ctx) => {
    return res(ctx.body(TEST_DATA));
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('renders starting room status', async () => {
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  const linkElement = screen.getAllByText('cave');
  expect(linkElement[0]).toBeInTheDocument();
});

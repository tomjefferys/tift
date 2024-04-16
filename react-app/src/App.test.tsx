import React from 'react';
import { render, screen, waitFor, cleanup, act, waitForElementToBeRemoved, findByRole, getByTestId, findAllByTestId, fireEvent } from '@testing-library/react';
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
item: box
desc: a large box
location: cave
tags:
  - pushable
  - container
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

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });
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

  await waitFor(() => {
    const balls = screen.getAllByText('ball');
    expect(balls).toHaveLength(2); // text output, and inventory button
  })

  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));
 
  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('drop'));
  await act(() => user.click(getButton('drop')));

  await waitFor(() => screen.getByText('boing boing'));
})

test('Test backspace', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  // Confirm no backspace button yet
  let backspaceButton = screen.queryByRole('button', { name : 'backspace' } );
  expect(backspaceButton).toBeNull();

  await waitFor(() => getButton('get'));
  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  // Check we now have a backspace button
  await waitFor(() => getButton('backspace'));

  // Click backspace
  await act(() => user.click(getButton('backspace')));
  await waitFor(() => getButton('get'));
  await waitFor(() => getButton('go'));

  const ballButton = screen.queryByRole('button', { name : 'ball' } );
  expect(ballButton).toBeNull();

  backspaceButton = screen.queryByRole('button', { name : 'backspace' } );
  expect(backspaceButton).toBeNull();
});

test('Test backspace only deletes single word', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('box'));

  // Confirm no backspace button yet
  await waitFor(() => {
    const backspaceButton = screen.queryByRole('button', { name : 'backspace' } );
    expect(backspaceButton).toBeNull();
  });

  await waitFor(() => getButton('push'));
  await act(() => user.click(getButton('push')));

  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toContain("push");
  })

  await waitFor(() => getButton('box'));
  await waitFor(() => getButton('backspace'));

  // Click backspace
  await act(() => user.click(getButton('backspace')));
  await waitFor(() => getButton('push'));

  // There should be no command
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).not.toContain("push");
  })

  // There should be no backspace
  await waitFor(() => {
    const backspaceButton = screen.queryByRole('button', { name : 'backspace' } );
    expect(backspaceButton).toBeNull();
  })

  await act(() => user.click(getButton('push')));
  await waitFor(() => getButton('box'));
  await act(() => user.click(getButton('box')));

  await waitFor(() => getButton('south'));
  await waitFor(() => getButton('backspace'));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toMatch(/push\s+box/);
  })

  // Click backspace
  await act(() => user.click(getButton('backspace')));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toContain("push");
    expect(command.textContent).not.toMatch(/push\s+box/);
  })

  await waitFor(() => getButton('box'));
  await waitFor(() => getButton('backspace'));
  await act(() => user.click(getButton('backspace')));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).not.toContain("push");
  })

  await waitFor(() => {
    const backspaceButton = screen.queryByRole('button', { name : 'backspace' } );
    expect(backspaceButton).toBeNull();
  })

});

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

test('undo/redo', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Confirm undo and redo disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'))

  await new Promise(process.nextTick);

  await waitFor(() => {
    const button = getButton('undo');
    expect(button).toBeDisabled();
  });

  await waitFor(() => {
    const button = getButton('redo');
    expect(button).toBeDisabled();
  });

  // Perform action, and wait to complete
  await user.click(getButton('Game', 'tab'));
  await user.keyboard('go south{Enter}');

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Confirm undo is enabled, and redo is disabled
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'));
  
  await waitFor(() => {
    const button = getButton('undo');
    expect(button).toBeEnabled();
  });
  await waitFor(() => {
    const button = getButton('redo');
    expect(button).toBeDisabled();
  });

  await act(() => user.click(getButton('undo')));

  // Confirm action undo is now disabled, and redo is enabled
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => {
    const button = getButton('undo');
    expect(button).toBeDisabled();
  });
  await waitFor(() => {
    const button = getButton('redo');
    expect(button).toBeEnabled();
  });

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Now try redoing
  await act(() => user.click(getButton('redo')));

  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => {
    const button = getButton('undo');
    expect(button).toBeEnabled();
  });
  await waitFor(() => {
    const button = getButton('redo');
    expect(button).toBeDisabled();
  });

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });
});

test('Can use inventory item', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('examine'));
  await waitFor(() => getButton('drop'));
  await waitFor(() => getButton('backspace'));
  
  // Check that go and drop aren't available
  const goButton = screen.queryByRole('button', { name : 'go' } );
  expect(goButton).toBeNull();

  await act(() => user.click(getButton('examine')));
  await waitFor(() => screen.getByText('a round ball'));
});

test('Inventory item verb still available for other contexts', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  // Examine should be available
  await waitFor(() => getButton('examine'));

  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  // Examine should be available as an inventory verb
  await waitFor(() => getButton('examine'));
})

test('Can use inventory item with keyboard', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await user.keyboard('ball ');

  await waitFor(() => getButton('examine'));
  await waitFor(() => getButton('drop'));
  await waitFor(() => getButton('backspace'));

  const goButton = screen.queryByRole('button', { name : 'go' } );
  expect(goButton).toBeNull();

  await user.keyboard('examine{Enter}');
  
  await waitFor(() => screen.getByText('a round ball'));
}); 

test('Can use inventory item with keyboard autocomplete', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await user.keyboard('ba ');

  await waitFor(() => getButton('examine'));
  await waitFor(() => getButton('drop'));

  const goButton = screen.queryByRole('button', { name : 'go' } );
  expect(goButton).toBeNull();

  await user.keyboard('e ');
  
  await waitFor(() => screen.getByText('a round ball'));
});

test("Test backspace works correctly when using inventory item", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));
  await waitFor(() => screen.getAllByText('ball'));

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  // Clear
  await waitFor(() => getButton('Options', 'tab'));
  await user.click(getButton('Options', 'tab'))
  await waitFor(() => getButton('clear'));
  await act(() => user.click(getButton('clear')));

  // Select ball from inventory
  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('put'));
  await waitFor(() => getButton('backspace'));

  await act(() => user.click(getButton('put')));

  // Select 'put', then 'in'
  await waitFor(() => getButton('in'));
  await waitFor(() => getButton('backspace'));

  await act(() => user.click(getButton('in')));

  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toMatch(/put\s+ball\s+in/);
  })

  await waitFor(() => getButton('box'));
  await waitFor(() => getButton('backspace'));

  // Check backspace removes 'in'
  await act(() => user.click(getButton('backspace')));

  await waitFor(() => getButton('in'));
  await waitFor(() => getButton('backspace'));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toMatch(/put\s+ball/);
    expect(command.textContent).not.toMatch(/put\s+ball\s+in/);
  })

  // check backspace removes 'ball'
  await act(() => user.click(getButton('backspace')));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toContain("put");
    expect(command.textContent).not.toMatch(/put\s+ball/);
  })

  // Check we can still select 'ball'
  await waitFor(() => getButton('ball'));
  await waitFor(() => getButton('backspace'));
  
  await act(() => user.click(getButton('ball')));
  await waitFor(() => getButton('in'));
  await waitFor(() => getButton('backspace'));
  await waitFor(() => {
    const command = screen.getByTestId('command');
    expect(command.textContent).toMatch(/put\s+ball/);
    expect(command.textContent).not.toMatch(/put\s+ball\s+in/);
  })
});

test("Test can change colour scheme", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // FIXME, the test fails without the next two lines, but they shouldn't be needed
  await waitFor(() => getButton('wait'));
  await act(() => user.click(getButton('wait')));
 
  // Click Options tab
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  // Check for colours button
  await waitFor(() => getButton('colours'));
  await act(() => user.click(getButton('colours')));

  // Check light/dark buttons appear
  await waitFor(() => getButton('light'));
  await waitFor(() => getButton('dark'));

  // Select dark theme
  await act(() => user.click(getButton('dark')));
  
  // Check game buttons appear
  await waitFor(() => getButton('go'));
  await waitFor(() => getButton('get'));

  // Click Options tab
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  // Check for colours button
  await waitFor(() => getButton('colours'));
  await act(() => user.click(getButton('colours')));

  // Check light/dark buttons appear
  await waitFor(() => getButton('light'));
  await waitFor(() => getButton('dark'));

  // Select light theme
  await act(() => user.click(getButton('light')));

  // Check game buttons appear
  await waitFor(() => getButton('go'));
  await waitFor(() => getButton('get'));
});

test("Test can restart game", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // get the ball
  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  // go south
  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Restart and cancel
  // Click Options tab
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('restart'));
  await act(() => user.click(getButton('restart')));

  // Wait for restart/cancel
  await waitFor(() => getButton('restart'));
  await waitFor(() => getButton('cancel'));

  // Select cancel
  await act(() => user.click(getButton('cancel')));

  // Confirm no restart
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Click Options tab
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('restart'));
  await act(() => user.click(getButton('restart')));

  // Wait for restart/cancel
  await waitFor(() => getButton('restart'));
  await waitFor(() => getButton('cancel'));
  
  // Select restart
  await act(() => user.click(getButton('restart')));

  // Confirm restart
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // check we can get the ball again
  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

});


function getButton(name : string, role = "button") : HTMLElement {
  return screen.getByRole(role, { name });
}

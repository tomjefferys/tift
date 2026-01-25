import React from 'react';
import { render, screen, waitFor, cleanup, act, waitForElementToBeRemoved, findByRole, getByTestId, findAllByTestId, fireEvent } from '@testing-library/react';
import App from './App';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mock CompressionStream and DecompressionStream for test environment
global.CompressionStream = class MockCompressionStream {
  readable: ReadableStream;
  writable: WritableStream;
  
  constructor() {
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        // Mock compression - just pass through data with minimal changes
        controller.enqueue(chunk);
      }
    });
    this.readable = readable;
    this.writable = writable;
  }
} as any;

global.DecompressionStream = class MockDecompressionStream {
  readable: ReadableStream;
  writable: WritableStream;
  
  constructor() {
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        // Mock decompression - just pass through data
        controller.enqueue(chunk);
      }
    });
    this.readable = readable;
    this.writable = writable;
  }
} as any;

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock navigator.storage API for tests
Object.defineProperty(window.navigator, 'storage', {
  value: {
    persist: async () => Promise.resolve(true),
    persisted: async () => Promise.resolve(true),
    estimate: async () => Promise.resolve({ quota: 1000000, usage: 0 })
  },
  writable: true
});

beforeEach(() => {
  window.localStorage.clear();
  // Reset any mocks
  vi.clearAllMocks();
})

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

  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('clear'));
  await act(() => user.click(getButton('clear')));

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

test("Test get info", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('info'));
  await act(() => user.click(getButton('info')));

  await waitFor(() => screen.getByText("name: Test Game"));
  await waitFor(() => screen.getByText("author: Presto Turnip"));
  await waitFor(() => screen.getByText("game version: 1.0.0"));
  await waitFor(() => screen.getByText("game id: Test1234"));
  await waitFor(() => screen.getByText("foo: bar"));
});

test("Test bookmark and load bookmark", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  // Start in cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Get the ball and go south to forest
  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Verify we have the ball in inventory
  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));
  
  await waitFor(() => getButton('ball'));

  // Create a bookmark at this point (forest with ball)
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Select "new bookmark" option
  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  // Wait for bookmark success message
  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

  // Go back to game and make more changes - drop the ball and go north
  await waitFor(() => getButton('Game', 'tab'));
  await act(() => user.click(getButton('Game', 'tab')));

  await waitFor(() => getButton('drop'));
  await act(() => user.click(getButton('drop')));

  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('north'));
  await act(() => user.click(getButton('north')));

  // Should be back in cave without ball
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Verify ball is no longer in inventory
  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));
  
  await waitFor(() => {
    const ballButton = screen.queryByRole('button', { name: 'ball' });
    expect(ballButton).toBeNull();
  });

  // Now load the bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should see the bookmark we created, click on it to select it
  await waitFor(() => {
    const bookmarkButton = screen.getByRole('button', { name: /forest.*- .*/ });
    expect(bookmarkButton).toBeInTheDocument();
    return bookmarkButton;
  });
  const bookmarkButton = screen.getByRole('button', { name: /forest.*- .*/ });
  await act(() => user.click(bookmarkButton));

  // Now click load to load the selected bookmark
  await waitFor(() => getButton('load'));
  await act(() => user.click(getButton('load')));

// Wait for load success message
  await waitFor(() => screen.getByText(/Bookmark loaded/), { timeout: 3000 });

  // Verify we're back in the forest (bookmarked state)
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Verify we have the ball back in inventory (bookmarked state)
  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));
  
  await waitFor(() => getButton('ball'));
});

test("Test bookmark manager when no bookmarks exist", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  // Start in cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Open bookmark manager when no bookmarks exist
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should only see "new bookmark" and "cancel" options (no existing bookmarks)
  await waitFor(() => getButton('new bookmark'));
  await waitFor(() => getButton('cancel'));
  
  // Verify no bookmark buttons are present
  const bookmarkButtons = screen.queryAllByRole('button').filter(button => 
    button.textContent && button.textContent.includes(' - ') && !['new bookmark', 'cancel'].includes(button.textContent.trim())
  );
  expect(bookmarkButtons).toHaveLength(0);
  
  // Cancel out
  await act(() => user.click(getButton('cancel')));
  await waitFor(() => screen.getByText(/cancelled/));

  // Should still be in cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });
});

test("Test bookmark creation and deletion", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  // Start in cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Create a bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  // Wait for bookmark creation success
  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // Open bookmark manager again to delete the bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should see the bookmark we created, click on it to select it
  await waitFor(() => {
    const bookmarkButton = screen.getByRole('button', { name: /cave.*- .*/ });
    expect(bookmarkButton).toBeInTheDocument();
    return bookmarkButton;
  });
  const bookmarkButton = screen.getByRole('button', { name: /cave.*- .*/ });
  await act(() => user.click(bookmarkButton));

  // Now click delete to remove the selected bookmark
  await waitFor(() => getButton('delete'));
  await act(() => user.click(getButton('delete')));

  // Wait for deletion success message
  await waitFor(() => screen.getByText(/Bookmark deleted/));

  // Verify bookmark was deleted by opening manager again
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should only see "new bookmark" and "cancel" options (no existing bookmarks)
  await waitFor(() => getButton('new bookmark'));
  await waitFor(() => getButton('cancel'));
  
  // Verify no bookmark buttons are present
  const remainingBookmarkButtons = screen.queryAllByRole('button').filter(button => 
    button.textContent && button.textContent.includes(' - ') && !['new bookmark', 'cancel'].includes(button.textContent.trim())
  );
  expect(remainingBookmarkButtons).toHaveLength(0);
});

test("Test multiple bookmarks and selection", async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  render(<App />);

  // Start in cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });

  // Create first bookmark in cave
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // Move to forest and create second bookmark
  await waitFor(() => getButton('Game', 'tab'));
  await act(() => user.click(getButton('Game', 'tab')));

  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));

  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));

  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Create second bookmark in forest
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // Verify we can see and load both bookmarks
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should see both bookmarks
  await waitFor(() => {
    const caveBookmark = screen.getByRole('button', { name: /cave.*- .*/ });
    const forestBookmark = screen.getByRole('button', { name: /forest.*- .*/ });
    expect(caveBookmark).toBeInTheDocument();
    expect(forestBookmark).toBeInTheDocument();
  });

  // Load the cave bookmark (should transport us back to cave)
  const caveBookmark = screen.getByRole('button', { name: /cave.*- .*/ });
  await act(() => user.click(caveBookmark));

  await waitFor(() => getButton('load'));
  await act(() => user.click(getButton('load')));

  await waitFor(() => screen.getByText(/Bookmark loaded/));

  // Verify we're back in the cave
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('cave');
  });
});

test('bookmark export button is available', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Create a bookmark first
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // Now test export accessibility
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Select the bookmark
  const bookmark = screen.getByRole('button', { name: /cave.*- .*/ });
  await act(() => user.click(bookmark));

  // Verify export button is accessible
  await waitFor(() => getButton('export'));
  expect(screen.getByRole('button', { name: 'export' })).toBeInTheDocument();
});

test('bookmark import button is available', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Open bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Verify import bookmark option exists
  await waitFor(() => getButton('import bookmark'));
  expect(screen.getByRole('button', { name: 'import bookmark' })).toBeInTheDocument();
});

test('bookmark import and export features are available', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Test that import is available even with no bookmarks
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('import bookmark'));
  expect(screen.getByRole('button', { name: 'import bookmark' })).toBeInTheDocument();
  
  // Create a bookmark to test export functionality
  await act(() => user.click(getButton('new bookmark')));
  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // Go back to bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Select bookmark to access export
  const bookmark = screen.getByRole('button', { name: /cave.*- .*/ });
  await act(() => user.click(bookmark));
  
  await waitFor(() => getButton('export'));
  expect(screen.getByRole('button', { name: 'export' })).toBeInTheDocument();
});

test('bookmark manager shows correct options for empty bookmark list', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Open bookmark manager without any existing bookmarks
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should see basic options for empty bookmark list
  await waitFor(() => getButton('new bookmark'));
  await waitFor(() => getButton('import bookmark'));
  await waitFor(() => getButton('cancel'));
  
  expect(screen.getByRole('button', { name: 'new bookmark' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'import bookmark' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'cancel' })).toBeInTheDocument();
  
  // Should not see any bookmarks to select
  const bookmarkButtons = screen.queryAllByRole('button', { name: /.*- .*/ });
  expect(bookmarkButtons).toHaveLength(0);
});

test('can cancel out of bookmark manager', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Open bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('cancel'));
  await act(() => user.click(getButton('cancel')));

  // Should return to normal game interface
  await waitFor(() => getButton('go'));
  expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
});

test('bookmark management UI flow covers all main actions', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Test the entire bookmark management UI flow
  
  // 1. Start with empty bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should have new, import, cancel options when empty
  await waitFor(() => getButton('new bookmark'));
  await waitFor(() => getButton('import bookmark'));
  await waitFor(() => getButton('cancel'));
  
  // 2. Create a bookmark
  await act(() => user.click(getButton('new bookmark')));
  await waitFor(() => screen.getByText(/Bookmark \".*\" created/));

  // 3. Navigate to bookmark manager again to see created bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should now have the bookmark plus new/import/cancel options
  await waitFor(() => {
    const bookmark = screen.getByRole('button', { name: /cave.*- .*/ });
    expect(bookmark).toBeInTheDocument();
  });
  await waitFor(() => getButton('new bookmark'));
  await waitFor(() => getButton('import bookmark'));
  await waitFor(() => getButton('cancel'));

  // 4. Select bookmark to see management actions
  const bookmark = screen.getByRole('button', { name: /cave.*- .*/ });
  await act(() => user.click(bookmark));

  // Should have load, delete, export, cancel options
  await waitFor(() => getButton('load'));
  await waitFor(() => getButton('delete'));  
  await waitFor(() => getButton('export'));
  await waitFor(() => getButton('cancel'));

  // 5. Test load functionality directly
  await act(() => user.click(getButton('load')));

  // Should show loaded message and return to game
  await waitFor(() => screen.getByText(/Bookmark loaded/));
  await waitFor(() => getButton('go'));
  expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
});


function getButton(name : string, role = "button") : HTMLElement {
  return screen.getByRole(role, { name });
}

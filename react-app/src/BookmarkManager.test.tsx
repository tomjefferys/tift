import { render, screen, waitFor, act } from '@testing-library/react';
import App from './App';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import * as reactutils from './util/reactutils';

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

// Mock file operations for import/export testing
let capturedExports: { filename: string; content: string }[] = [];

const mockDownloadTextFile = vi.fn((filename: string, content: string) => {
  capturedExports.push({ filename, content });
});

const mockPromptForTextFile = vi.fn((_title: string, _allowedExtensions: string[]) => {
  const lastExport = capturedExports[capturedExports.length - 1];
  if (lastExport) {
    return Promise.resolve(lastExport.content);
  }
  return Promise.reject(new Error('No exported file available for import'));
});

vi.spyOn(reactutils, 'downloadTextFile').mockImplementation(mockDownloadTextFile);
vi.spyOn(reactutils, 'promptForTextFile').mockImplementation(mockPromptForTextFile);

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
  // Clear captured exports for each test
  capturedExports = [];
  // Reset the mock functions
  mockDownloadTextFile.mockClear();
  mockPromptForTextFile.mockClear();
});

function getButton(name: string, role = "button"): HTMLElement {
  return screen.getByRole(role, { name });
}

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
  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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

  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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

  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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

  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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
  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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
  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

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

test('bookmark export and import end-to-end flow', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Create a bookmark with specific game state
  await waitFor(() => getButton('get'));
  await act(() => user.click(getButton('get')));
  await waitFor(() => getButton('ball'));
  await act(() => user.click(getButton('ball')));

  // Move to another location to create more interesting state
  await waitFor(() => getButton('go'));
  await act(() => user.click(getButton('go')));
  await waitFor(() => getButton('south'));
  await act(() => user.click(getButton('south')));
  await waitFor(() => screen.getAllByText('forest'));

  // Create bookmark in this state
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  await waitFor(() => getButton('new bookmark'));
  await act(() => user.click(getButton('new bookmark')));

  await waitFor(() => screen.getByText(/Bookmark ".*" created/));

  // Export the bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  const bookmark = screen.getByRole('button', { name: /forest.*- .*/ });
  await act(() => user.click(bookmark));

  await waitFor(() => getButton('export'));
  await act(() => user.click(getButton('export')));

  // Verify export was called
  await waitFor(() => {
    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1);
    expect(capturedExports).toHaveLength(1);
  });

  const exportedData = capturedExports[0];
  expect(exportedData.filename).toMatch(/\.tiftbk$/);
  expect(exportedData.content).toBeTruthy();

  // Parse and verify exported content structure
  const parsedExport = JSON.parse(exportedData.content);
  // Check the actual structure
  expect(parsedExport).toHaveProperty('gameId');
  expect(parsedExport).toHaveProperty('name');
  expect(parsedExport).toHaveProperty('data');
  
  // Navigate back to bookmark manager to delete the bookmark
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  const bookmarkAgain = screen.getByRole('button', { name: /forest.*- .*/ });
  await act(() => user.click(bookmarkAgain));
  
  // Delete the original bookmark to test import
  await waitFor(() => getButton('delete'));
  await act(() => user.click(getButton('delete')));

  await waitFor(() => screen.getByText(/Bookmark deleted/));

  // Verify bookmark is gone
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should not find the bookmark anymore
  const deletedBookmark = screen.queryByRole('button', { name: /forest.*- .*/ });
  expect(deletedBookmark).toBeNull();

  // Import the bookmark
  await waitFor(() => getButton('import bookmark'));
  await act(() => user.click(getButton('import bookmark')));

  // Verify import was called and successful
  await waitFor(() => {
    expect(mockPromptForTextFile).toHaveBeenCalledTimes(1);
  });

  await waitFor(() => screen.getByText(/Bookmark ".*" imported\./));

  // Verify the bookmark is back in the manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Should find the bookmark again
  await waitFor(() => {
    const reimportedBookmark = screen.getByRole('button', { name: /forest.*- .*/ });
    expect(reimportedBookmark).toBeInTheDocument();
  });

  // Load the imported bookmark and verify game state
  const reimportedBookmark = screen.getByRole('button', { name: /forest.*- .*/ });
  await act(() => user.click(reimportedBookmark));

  await waitFor(() => getButton('load'));
  await act(() => user.click(getButton('load')));

  // Verify the game state is correctly restored
  await waitFor(() => screen.getAllByText(/Bookmark loaded/));
  await waitFor(() => {
    const status = screen.getByTestId('status');
    expect(status).toHaveTextContent('forest');
  });

  // Verify inventory is restored (should have the ball)
  await waitFor(() => getButton('Inventory', 'tab'));
  await act(() => user.click(getButton('Inventory', 'tab')));

  await waitFor(() => getButton('ball'));
  expect(screen.getByRole('button', { name: 'ball' })).toBeInTheDocument();
});

test('import bookmark handles invalid file gracefully', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};

  // Mock promptForTextFile to return invalid JSON
  mockPromptForTextFile.mockImplementationOnce(() => {
    return Promise.resolve('invalid json content');
  });
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Open bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Try to import invalid file
  await waitFor(() => getButton('import bookmark'));
  await act(() => user.click(getButton('import bookmark')));

  // Should show error message
  await waitFor(() => screen.getAllByText(/Failed to import bookmark/));
});

test('import bookmark handles file selection cancellation', async () => {
  const user = userEvent.setup();
  window.HTMLElement.prototype.scrollIntoView = function() {};

  // Mock promptForTextFile to simulate cancellation
  mockPromptForTextFile.mockImplementationOnce(() => {
    return Promise.reject(new Error('File selection cancelled'));
  });
  
  render(<App />);
  await waitFor(() => screen.getAllByText('cave'));

  // Open bookmark manager
  await waitFor(() => getButton('Options', 'tab'));
  await act(() => user.click(getButton('Options', 'tab')));

  await waitFor(() => getButton('bookmark manager'));
  await act(() => user.click(getButton('bookmark manager')));

  // Try to import but cancel
  await waitFor(() => getButton('import bookmark'));
  await act(() => user.click(getButton('import bookmark')));

  // Should see failure message but then return to game
  await waitFor(() => screen.getAllByText(/Failed to import bookmark/));

  // Check that we're back in the game interface
  await waitFor(() => getButton('go'));
  expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
});
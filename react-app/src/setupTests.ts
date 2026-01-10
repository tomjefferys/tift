// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import * as fs from "fs";

// Mock ResizeObserver as it is not available when running tests
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserver,
});

Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserver,
});

// Mock window.location for testing
Object.defineProperty(window, 'location', {
  writable: true,
  configurable: true,
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
  },
});

// Test data for the game
const TEST_DATA = `
---
game: Test Game
author: Presto Turnip
version: 1.0.0
gameId: Test1234
foo: bar
options:
  - useDefaultVerbs
---
room: cave
description: A dark dank cave
tags: [start]
exits:
  south: forest
---
room: forest
description: A dense verdant forest
exits:
  north: cave
---
item: ball
description: a round ball
location: cave
tags:
  - carryable
after:
  drop(this):
    do: print('boing boing')
---
item: box
description: a large box
location: cave
tags:
  - pushable
  - container
---
`;

// Mock fetch to return test data directly
const originalFetch = global.fetch;
global.fetch = function(url: any, options?: any): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url.toString();
  
  // Mock the specific files used in tests
  if (urlStr.includes('properties.yaml')) {
    const data = fs.readFileSync("public/properties.yaml", "utf8");
    return Promise.resolve(new Response(data, { status: 200 }));
  }
  
  if (urlStr.includes('stdlib.yaml')) {
    const data = fs.readFileSync("public/stdlib.yaml", "utf8");
    return Promise.resolve(new Response(data, { status: 200 }));
  }
  
  if (urlStr.includes('adventure.yaml')) {
    return Promise.resolve(new Response(TEST_DATA, { status: 200 }));
  }
  
  // Fallback to original fetch for any other requests
  return originalFetch(url, options);
};

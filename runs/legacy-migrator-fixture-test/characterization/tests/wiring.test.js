import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

/**
 * R4: nothing in the repo mounts a <Provider> — no entry point exists.
 * Both connected components must fail to render without one. Assert only
 * that it throws, not the message text: react-redux 5 (connect) and the
 * hooks-based migration target raise different error messages for the
 * same missing-store condition.
 */
describe('wiring: connected components require a <Provider>', () => {
  it('rendering Counter without a Provider throws', async () => {
    vi.resetModules();
    const { default: Counter } = await import('@app/Counter');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(React.createElement(Counter))).toThrow();
    errorSpy.mockRestore();
  });

  it('rendering TodoList without a Provider throws', async () => {
    vi.resetModules();
    const { default: TodoList } = await import('@app/TodoList');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(React.createElement(TodoList))).toThrow();
    errorSpy.mockRestore();
  });
});

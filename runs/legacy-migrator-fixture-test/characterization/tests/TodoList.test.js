import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { freshApp } from './helpers/freshApp';

function renderTodoList({ store, Provider, TodoList }) {
  render(React.createElement(Provider, { store }, React.createElement(TodoList)));
  return {
    input: screen.getByRole('textbox'),
    submit: () => fireEvent.click(screen.getByText('Add')),
  };
}

describe('TodoList (connected)', () => {
  it('renders an empty list initially', async () => {
    const app = await freshApp();
    renderTodoList(app);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('input is controlled: typing updates the field value', async () => {
    const app = await freshApp();
    const { input } = renderTodoList(app);
    fireEvent.change(input, { target: { value: 'buy milk' } });
    expect(input.value).toBe('buy milk');
  });

  it('submitting non-empty text adds the todo, clears the input, and updates the store', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: 'buy milk' } });
    submit();
    expect(screen.getByText('buy milk')).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(app.store.getState().todos).toEqual(['buy milk']);
  });

  it('R2: submitting with empty input dispatches nothing and renders no empty <li>', async () => {
    const app = await freshApp();
    const { submit } = renderTodoList(app);
    submit();
    expect(app.store.getState().todos).toEqual([]);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('R2: submitting whitespace-only text IS added (guard checks truthiness only, no trim)', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: '   ' } });
    submit();
    expect(app.store.getState().todos).toEqual(['   ']);
    expect(input.value).toBe('');
  });

  it('R2: submitting the string "0" is added (falsy-string edge of the guard)', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: '0' } });
    submit();
    expect(app.store.getState().todos).toEqual(['0']);
  });

  it('duplicate todos are allowed and rendered in append order', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    for (const text of ['a', 'a', 'b']) {
      fireEvent.change(input, { target: { value: text } });
      submit();
    }
    expect(app.store.getState().todos).toEqual(['a', 'a', 'b']);
    const items = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(items).toEqual(['a', 'a', 'b']);
  });

  it('rendered <li> count matches store todos length', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    for (const text of ['x', 'y', 'z']) {
      fireEvent.change(input, { target: { value: text } });
      submit();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(app.store.getState().todos).toHaveLength(3);
  });
});

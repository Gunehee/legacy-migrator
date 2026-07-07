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
  it('renders div.todo-list with an empty controlled input, an "Add" button, and an empty <ul>', async () => {
    const app = await freshApp();
    const { container } = render(
      React.createElement(app.Provider, { store: app.store }, React.createElement(app.TodoList)),
    );
    expect(container.querySelector('div.todo-list')).not.toBeNull();
    expect(screen.getByRole('textbox').value).toBe('');
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('input is controlled: typing updates the field value (wiring, no dispatch yet)', async () => {
    const app = await freshApp();
    const { input } = renderTodoList(app);
    fireEvent.change(input, { target: { value: 'buy milk' } });
    expect(input.value).toBe('buy milk');
    expect(app.store.getState().todos).toEqual([]);
  });

  it('submitting non-empty text appends an <li>, clears the input, and updates the store', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: 'buy milk' } });
    submit();
    expect(screen.getByText('buy milk')).toBeInTheDocument();
    expect(input.value).toBe('');
    expect(app.store.getState().todos).toEqual(['buy milk']);
  });

  it('submitting with empty input does nothing: no <li>, no dispatch', async () => {
    const app = await freshApp();
    const { submit } = renderTodoList(app);
    submit();
    expect(app.store.getState().todos).toEqual([]);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('submitting "   " (whitespace-only) DOES add a todo — pins the no-trim guard verbatim', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: '   ' } });
    submit();
    expect(app.store.getState().todos).toEqual(['   ']);
    expect(input.value).toBe('');
  });

  it('submitting the string "0" is added — falsy-string edge of the same guard', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    fireEvent.change(input, { target: { value: '0' } });
    submit();
    expect(app.store.getState().todos).toEqual(['0']);
  });

  it('multiple adds preserve list order, including duplicate texts as separate items', async () => {
    const app = await freshApp();
    const { input, submit } = renderTodoList(app);
    for (const text of ['a', 'a', 'b']) {
      fireEvent.change(input, { target: { value: text } });
      submit();
    }
    expect(app.store.getState().todos).toEqual(['a', 'a', 'b']);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['a', 'a', 'b']);
  });

  it('rendered <li> count always matches the store todos length', async () => {
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

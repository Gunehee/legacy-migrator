import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { freshApp } from './helpers/freshApp';

describe('wiring: Counter and TodoList share one store via combineReducers', () => {
  it('adding todos does not affect the count, and incrementing does not affect todos', async () => {
    const { store, Provider, Counter, TodoList } = await freshApp();
    render(
      React.createElement(
        Provider,
        { store },
        // react-redux v5's <Provider> requires a single child (React.Children.only).
        React.createElement(React.Fragment, null, React.createElement(Counter), React.createElement(TodoList)),
      ),
    );

    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    expect(store.getState().counter).toBe(2);
    expect(store.getState().todos).toEqual([]);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'independent' } });
    fireEvent.click(screen.getByText('Add'));
    expect(store.getState().todos).toEqual(['independent']);
    expect(store.getState().counter).toBe(2);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

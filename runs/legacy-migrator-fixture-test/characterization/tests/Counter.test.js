import { describe, expect, it } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { freshApp } from './helpers/freshApp';

describe('Counter (connected)', () => {
  it('renders div.counter with a "-" button, the count, and a "+" button', async () => {
    const { store, Provider, Counter } = await freshApp();
    const { container } = render(React.createElement(Provider, { store }, React.createElement(Counter)));
    expect(container.querySelector('div.counter')).not.toBeNull();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('clicking "+" dispatches increment and updates the displayed count', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(store.getState().counter).toBe(1);
  });

  it('clicking "-" dispatches decrement and updates the displayed count (goes negative)', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    fireEvent.click(screen.getByText('-'));
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(store.getState().counter).toBe(-1);
  });

  it('interleaved "+"/"-" clicks accumulate to the net total', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(store.getState().counter).toBe(2);
  });

  it('an external store.dispatch(increment()) updates the rendered count (store -> view wiring)', async () => {
    const { store, increment, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    // act() because the dispatch originates outside React: React 16 flushed
    // subscriber re-renders synchronously, React 18 batches them into a
    // microtask. The pinned behavior is "the view reflects the dispatch once
    // processed", not the legacy synchronous flush timing.
    act(() => {
      store.dispatch(increment());
    });
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

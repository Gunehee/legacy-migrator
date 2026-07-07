import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { freshApp } from './helpers/freshApp';

describe('Counter (connected)', () => {
  it('renders the current count from store state (initial 0)', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    expect(screen.getByText('0')).toBeInTheDocument();
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

  it('multiple "+" clicks accumulate', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    const plus = screen.getByText('+');
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(store.getState().counter).toBe(3);
  });

  it('mixed "+"/"-" clicks reflect the net total', async () => {
    const { store, Provider, Counter } = await freshApp();
    render(React.createElement(Provider, { store }, React.createElement(Counter)));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('-'));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(store.getState().counter).toBe(1);
  });
});

/**
 * Renders the real <App> with the target's real store/router, after
 * `vi.doMock('@app/agent', ...)` has been applied by the caller.
 *
 * Modules are imported dynamically AFTER resetModules so the store singleton
 * (and agent token state) is fresh per test — the app was built around global
 * singletons, so the harness must re-create the world each time.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

export async function renderApp({ route = '/', jwt = null } = {}) {
  if (jwt) window.localStorage.setItem('jwt', jwt);
  window.history.pushState({}, '', route);

  const { default: App } = await import('@app/components/App');
  const { store, history } = await import('@app/store');
  const { Provider } = await import('react-redux');
  const { Route, Switch } = await import('react-router-dom');

  // original wires ConnectedRouter (react-router-redux) and exposes state.router
  // via routerReducer; migrated drops both. Detect from the store itself.
  let RouterEl;
  if ('router' in store.getState()) {
    const rrr = await import('react-router-redux');
    RouterEl = ({ children }) => React.createElement(rrr.ConnectedRouter, { history }, children);
  } else {
    const { Router } = await import('react-router-dom');
    RouterEl = ({ children }) => React.createElement(Router, { history }, children);
  }

  const utils = render(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        RouterEl,
        null,
        React.createElement(Switch, null, React.createElement(Route, { path: '/', component: App })),
      ),
    ),
  );
  return { ...utils, store, history };
}

/** Standard agent mock: every namespace method is a vi.fn the test overrides. */
export function agentMockFactory() {
  const fn = () => vi.fn(() => new Promise(() => {})); // default: never resolves
  return {
    default: {
      Articles: {
        all: fn(), byAuthor: fn(), byTag: fn(), del: fn(), favorite: fn(),
        favoritedBy: fn(), feed: fn(), get: fn(), unfavorite: fn(), update: fn(), create: fn(),
      },
      Auth: { current: fn(), login: fn(), register: fn(), save: fn() },
      Comments: { create: fn(), delete: fn(), forArticle: fn() },
      Profile: { follow: fn(), get: fn(), unfollow: fn() },
      Tags: { getAll: fn() },
      setToken: vi.fn(),
    },
  };
}

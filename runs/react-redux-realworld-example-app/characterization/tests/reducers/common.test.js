import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/common';

const UNLOAD_TYPES = [
  'ARTICLE_PAGE_UNLOADED',
  'EDITOR_PAGE_UNLOADED',
  'HOME_PAGE_UNLOADED',
  'PROFILE_PAGE_UNLOADED',
  'PROFILE_FAVORITES_PAGE_UNLOADED',
  'SETTINGS_PAGE_UNLOADED',
  'LOGIN_PAGE_UNLOADED',
  'REGISTER_PAGE_UNLOADED',
];

describe('reducers/common', () => {
  it('initial state shape', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      appName: 'Conduit',
      token: null,
      viewChangeCounter: 0,
    });
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { appName: 'Conduit', token: null, viewChangeCounter: 0 };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('APP_LOAD: sets token from action.token||null, appLoaded true, currentUser from payload.user', () => {
    const state = reducer(undefined, { type: 'APP_LOAD', token: 't', payload: { user: { username: 'jo' } } });
    expect(state).toMatchObject({ token: 't', appLoaded: true, currentUser: { username: 'jo' } });
  });

  it('APP_LOAD with no token: token is null', () => {
    const state = reducer(undefined, { type: 'APP_LOAD', token: null, payload: null });
    expect(state).toMatchObject({ token: null, appLoaded: true, currentUser: null });
  });

  it('APP_LOAD with falsy token string: action.token || null still resolves to null', () => {
    const state = reducer(undefined, { type: 'APP_LOAD', token: '', payload: null });
    expect(state.token).toBeNull();
  });

  it('REDIRECT: clears redirectTo', () => {
    const state = reducer({ redirectTo: '/somewhere' }, { type: 'REDIRECT' });
    expect(state.redirectTo).toBeNull();
  });

  it('LOGOUT: redirects to /, clears token and currentUser', () => {
    const state = reducer({ token: 't', currentUser: { username: 'jo' } }, { type: 'LOGOUT' });
    expect(state).toMatchObject({ redirectTo: '/', token: null, currentUser: null });
  });

  it('ARTICLE_SUBMITTED: redirectTo built from payload.article.slug', () => {
    const state = reducer({}, { type: 'ARTICLE_SUBMITTED', payload: { article: { slug: 'my-slug' } } });
    expect(state.redirectTo).toBe('/article/my-slug');
  });

  it('SETTINGS_SAVED success: redirectTo /, currentUser from payload.user', () => {
    const state = reducer({}, { type: 'SETTINGS_SAVED', payload: { user: { username: 'jo2' } } });
    expect(state).toMatchObject({ redirectTo: '/', currentUser: { username: 'jo2' } });
  });

  it('SETTINGS_SAVED error: redirectTo null, currentUser null', () => {
    const state = reducer({ currentUser: { username: 'jo' } }, {
      type: 'SETTINGS_SAVED',
      error: true,
      payload: { errors: {} },
    });
    expect(state).toMatchObject({ redirectTo: null, currentUser: null });
  });

  it('LOGIN success: redirectTo /, token+currentUser from payload.user', () => {
    const state = reducer({}, {
      type: 'LOGIN',
      payload: { user: { username: 'jo', token: 'abc' } },
    });
    expect(state).toMatchObject({ redirectTo: '/', token: 'abc', currentUser: { username: 'jo', token: 'abc' } });
  });

  it('LOGIN error: redirectTo/token/currentUser all null', () => {
    const state = reducer({ token: 'old' }, { type: 'LOGIN', error: true, payload: { errors: {} } });
    expect(state).toMatchObject({ redirectTo: null, token: null, currentUser: null });
  });

  it('REGISTER shares the exact same branch as LOGIN', () => {
    const state = reducer({}, { type: 'REGISTER', payload: { user: { username: 'new', token: 'zzz' } } });
    expect(state).toMatchObject({ redirectTo: '/', token: 'zzz', currentUser: { username: 'new', token: 'zzz' } });
  });

  it('DELETE_ARTICLE: redirectTo /', () => {
    const state = reducer({}, { type: 'DELETE_ARTICLE' });
    expect(state.redirectTo).toBe('/');
  });

  it.each(UNLOAD_TYPES)('%s increments viewChangeCounter by 1', (type) => {
    const state = reducer({ viewChangeCounter: 4 }, { type });
    expect(state.viewChangeCounter).toBe(5);
  });

  it('viewChangeCounter accumulates across repeated unload dispatches', () => {
    let state = { viewChangeCounter: 0 };
    state = reducer(state, { type: 'HOME_PAGE_UNLOADED' });
    state = reducer(state, { type: 'ARTICLE_PAGE_UNLOADED' });
    state = reducer(state, { type: 'SETTINGS_PAGE_UNLOADED' });
    expect(state.viewChangeCounter).toBe(3);
  });
});

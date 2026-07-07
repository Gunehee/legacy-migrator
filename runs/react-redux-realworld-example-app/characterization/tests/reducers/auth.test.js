import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/auth';

describe('reducers/auth', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { email: 'x' };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('LOGIN success: inProgress false, errors null', () => {
    const state = reducer({ inProgress: true }, { type: 'LOGIN', payload: { user: {} } });
    expect(state).toMatchObject({ inProgress: false, errors: null });
  });

  it('LOGIN error: inProgress false, errors from payload.errors', () => {
    const state = reducer({ inProgress: true }, {
      type: 'LOGIN',
      error: true,
      payload: { errors: { 'email or password': ['is invalid'] } },
    });
    expect(state).toMatchObject({ inProgress: false, errors: { 'email or password': ['is invalid'] } });
  });

  it('REGISTER shares the exact same branch as LOGIN (success)', () => {
    const state = reducer({}, { type: 'REGISTER', payload: { user: {} } });
    expect(state).toMatchObject({ inProgress: false, errors: null });
  });

  it('REGISTER error', () => {
    const state = reducer({}, { type: 'REGISTER', error: true, payload: { errors: { username: ['is taken'] } } });
    expect(state).toMatchObject({ inProgress: false, errors: { username: ['is taken'] } });
  });

  it('LOGIN_PAGE_UNLOADED and REGISTER_PAGE_UNLOADED reset to {}', () => {
    expect(reducer({ email: 'x' }, { type: 'LOGIN_PAGE_UNLOADED' })).toEqual({});
    expect(reducer({ email: 'x' }, { type: 'REGISTER_PAGE_UNLOADED' })).toEqual({});
  });

  it('ASYNC_START with subtype LOGIN sets inProgress true', () => {
    const state = reducer({}, { type: 'ASYNC_START', subtype: 'LOGIN' });
    expect(state).toMatchObject({ inProgress: true });
  });

  it('ASYNC_START with subtype REGISTER sets inProgress true', () => {
    const state = reducer({}, { type: 'ASYNC_START', subtype: 'REGISTER' });
    expect(state).toMatchObject({ inProgress: true });
  });

  it('ASYNC_START with any other subtype falls through to unchanged state (break -> return state)', () => {
    const state = { foo: 'bar' };
    expect(reducer(state, { type: 'ASYNC_START', subtype: 'SETTINGS_SAVED' })).toBe(state);
  });

  it('UPDATE_FIELD_AUTH: sets [action.key] to action.value', () => {
    const state = reducer({ email: 'old' }, { type: 'UPDATE_FIELD_AUTH', key: 'email', value: 'new@example.com' });
    expect(state).toMatchObject({ email: 'new@example.com' });
  });
});

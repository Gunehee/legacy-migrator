import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/settings';

describe('reducers/settings', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { errors: null };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('SETTINGS_SAVED success: inProgress false, errors null', () => {
    const state = reducer({ inProgress: true }, { type: 'SETTINGS_SAVED', payload: { user: {} } });
    expect(state).toMatchObject({ inProgress: false, errors: null });
  });

  it('SETTINGS_SAVED error: errors from payload.errors', () => {
    const state = reducer({}, { type: 'SETTINGS_SAVED', error: true, payload: { errors: { email: ['is invalid'] } } });
    expect(state).toMatchObject({ inProgress: false, errors: { email: ['is invalid'] } });
  });

  it('SETTINGS_PAGE_UNLOADED: resets to {}', () => {
    expect(reducer({ inProgress: true }, { type: 'SETTINGS_PAGE_UNLOADED' })).toEqual({});
  });

  it('ASYNC_START: sets inProgress true for ANY action (characterized as-is, unlike auth/editor which check subtype)', () => {
    const state = reducer({}, { type: 'ASYNC_START', subtype: 'SOME_UNRELATED_ACTION' });
    expect(state).toMatchObject({ inProgress: true });
  });
});

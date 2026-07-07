import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/profile';

describe('reducers/profile', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { username: 'anna' };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('PROFILE_PAGE_LOADED: state becomes payload[0].profile verbatim (tuple index 0)', () => {
    const profile = { username: 'anna', bio: 'writer' };
    const state = reducer(undefined, {
      type: 'PROFILE_PAGE_LOADED',
      payload: [{ profile }, { articles: [], articlesCount: 0 }],
    });
    expect(state).toEqual(profile);
  });

  it('PROFILE_PAGE_UNLOADED: resets to {}', () => {
    expect(reducer({ username: 'anna' }, { type: 'PROFILE_PAGE_UNLOADED' })).toEqual({});
  });

  it('FOLLOW_USER: state becomes payload.profile verbatim', () => {
    const profile = { username: 'anna', following: true };
    const state = reducer({ username: 'anna', following: false }, { type: 'FOLLOW_USER', payload: { profile } });
    expect(state).toEqual(profile);
  });

  it('UNFOLLOW_USER: shares the exact same branch as FOLLOW_USER', () => {
    const profile = { username: 'anna', following: false };
    const state = reducer({ username: 'anna', following: true }, { type: 'UNFOLLOW_USER', payload: { profile } });
    expect(state).toEqual(profile);
  });
});

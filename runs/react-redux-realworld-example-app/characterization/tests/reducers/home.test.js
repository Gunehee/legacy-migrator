import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/home';

describe('reducers/home', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { tags: ['a'] };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('HOME_PAGE_LOADED: tags pulled from payload[0].tags (tuple index 0)', () => {
    const state = reducer(undefined, {
      type: 'HOME_PAGE_LOADED',
      payload: [{ tags: ['react', 'redux'] }, { articles: [], articlesCount: 0 }],
    });
    expect(state.tags).toEqual(['react', 'redux']);
  });

  it('HOME_PAGE_UNLOADED: resets to {}', () => {
    expect(reducer({ tags: ['a'] }, { type: 'HOME_PAGE_UNLOADED' })).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/editor';

describe('reducers/editor', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { title: 'x' };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('EDITOR_PAGE_LOADED with an article payload: fields populated, tagInput cleared', () => {
    const state = reducer(undefined, {
      type: 'EDITOR_PAGE_LOADED',
      payload: {
        article: { slug: 's1', title: 'T', description: 'D', body: 'B', tagList: ['a', 'b'] },
      },
    });
    expect(state).toMatchObject({
      articleSlug: 's1',
      title: 'T',
      description: 'D',
      body: 'B',
      tagInput: '',
      tagList: ['a', 'b'],
    });
  });

  it('EDITOR_PAGE_LOADED with null payload (new article): empty-string fields, [] tagList', () => {
    const state = reducer(undefined, { type: 'EDITOR_PAGE_LOADED', payload: null });
    expect(state).toMatchObject({
      articleSlug: '',
      title: '',
      description: '',
      body: '',
      tagInput: '',
      tagList: [],
    });
  });

  it('EDITOR_PAGE_UNLOADED: resets to {}', () => {
    expect(reducer({ title: 'x' }, { type: 'EDITOR_PAGE_UNLOADED' })).toEqual({});
  });

  it('ARTICLE_SUBMITTED success: inProgress null, errors null', () => {
    const state = reducer({ inProgress: true }, { type: 'ARTICLE_SUBMITTED', payload: { article: {} } });
    expect(state).toMatchObject({ inProgress: null, errors: null });
  });

  it('ARTICLE_SUBMITTED error: errors from payload.errors', () => {
    const state = reducer({}, { type: 'ARTICLE_SUBMITTED', error: true, payload: { errors: { title: ["can't be blank"] } } });
    expect(state).toMatchObject({ inProgress: null, errors: { title: ["can't be blank"] } });
  });

  it('ASYNC_START with subtype ARTICLE_SUBMITTED sets inProgress true', () => {
    const state = reducer({}, { type: 'ASYNC_START', subtype: 'ARTICLE_SUBMITTED' });
    expect(state).toMatchObject({ inProgress: true });
  });

  it('ASYNC_START with a different subtype falls through unchanged (break -> return state)', () => {
    const state = { foo: 'bar' };
    expect(reducer(state, { type: 'ASYNC_START', subtype: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('ADD_TAG: concatenates tagInput onto tagList and clears tagInput', () => {
    const state = reducer({ tagList: ['a'], tagInput: 'b' }, { type: 'ADD_TAG' });
    expect(state).toMatchObject({ tagList: ['a', 'b'], tagInput: '' });
  });

  it('REMOVE_TAG: filters the given tag out of tagList', () => {
    const state = reducer({ tagList: ['a', 'b', 'c'] }, { type: 'REMOVE_TAG', tag: 'b' });
    expect(state.tagList).toEqual(['a', 'c']);
  });

  it('UPDATE_FIELD_EDITOR: sets [action.key] to action.value', () => {
    const state = reducer({ title: 'old' }, { type: 'UPDATE_FIELD_EDITOR', key: 'title', value: 'new title' });
    expect(state).toMatchObject({ title: 'new title' });
  });
});

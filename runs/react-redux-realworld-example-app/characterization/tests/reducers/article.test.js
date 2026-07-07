import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/article';
import { makeArticle, makeComment } from '../helpers/fixtures.js';

describe('reducers/article', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { article: makeArticle() };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('ARTICLE_PAGE_LOADED: pulls article from payload[0] and comments from payload[1]', () => {
    const article = makeArticle();
    const comments = [makeComment()];
    const state = reducer(undefined, {
      type: 'ARTICLE_PAGE_LOADED',
      payload: [{ article }, { comments }],
    });
    expect(state.article).toBe(article);
    expect(state.comments).toBe(comments);
  });

  it('ARTICLE_PAGE_UNLOADED: resets to {}', () => {
    const state = reducer({ article: makeArticle(), comments: [] }, { type: 'ARTICLE_PAGE_UNLOADED' });
    expect(state).toEqual({});
  });

  it('ADD_COMMENT success: appends payload.comment to existing comments, clears commentErrors', () => {
    const existing = [makeComment({ id: 1 })];
    const added = makeComment({ id: 2 });
    const state = reducer(
      { comments: existing },
      { type: 'ADD_COMMENT', payload: { comment: added } },
    );
    expect(state.commentErrors).toBeNull();
    expect(state.comments).toEqual([existing[0], added]);
  });

  it('ADD_COMMENT success with no prior comments: (state.comments || []) starts empty', () => {
    const added = makeComment();
    const state = reducer({}, { type: 'ADD_COMMENT', payload: { comment: added } });
    expect(state.comments).toEqual([added]);
  });

  it('ADD_COMMENT error: sets commentErrors from payload.errors, sets comments to null', () => {
    const existing = [makeComment()];
    const state = reducer(
      { comments: existing },
      { type: 'ADD_COMMENT', error: true, payload: { errors: { body: ["can't be empty"] } } },
    );
    expect(state.commentErrors).toEqual({ body: ["can't be empty"] });
    expect(state.comments).toBeNull();
  });

  it('DELETE_COMMENT: filters out the comment matching action.commentId (normal path)', () => {
    const c1 = makeComment({ id: 1 });
    const c2 = makeComment({ id: 2 });
    const state = reducer({ comments: [c1, c2] }, { type: 'DELETE_COMMENT', commentId: 2 });
    expect(state.comments).toEqual([c1]);
  });

  it('BUG (characterized as-is): DELETE_COMMENT throws when state.comments is undefined', () => {
    expect(() => reducer({}, { type: 'DELETE_COMMENT', commentId: 1 })).toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import reducer from '@app/reducers/articleList';
import { makeArticle } from '../helpers/fixtures.js';

describe('reducers/articleList', () => {
  it('has {} as the initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({});
  });

  it('default: returns state unchanged for unknown action', () => {
    const state = { articles: [] };
    expect(reducer(state, { type: 'SOMETHING_ELSE' })).toBe(state);
  });

  it('ARTICLE_FAVORITED: updates only the matching slug, favorited+favoritesCount', () => {
    const a1 = makeArticle({ slug: 'a1', favorited: false, favoritesCount: 1 });
    const a2 = makeArticle({ slug: 'a2', favorited: false, favoritesCount: 5 });
    const state = reducer(
      { articles: [a1, a2] },
      {
        type: 'ARTICLE_FAVORITED',
        payload: { article: { slug: 'a1', favorited: true, favoritesCount: 2 } },
      },
    );
    expect(state.articles[0]).toMatchObject({ slug: 'a1', favorited: true, favoritesCount: 2 });
    expect(state.articles[1]).toBe(a2);
  });

  it('ARTICLE_UNFAVORITED: same shared behavior as ARTICLE_FAVORITED, matching slug only', () => {
    const a1 = makeArticle({ slug: 'a1', favorited: true, favoritesCount: 2 });
    const state = reducer(
      { articles: [a1] },
      {
        type: 'ARTICLE_UNFAVORITED',
        payload: { article: { slug: 'a1', favorited: false, favoritesCount: 1 } },
      },
    );
    expect(state.articles[0]).toMatchObject({ slug: 'a1', favorited: false, favoritesCount: 1 });
  });

  it('SET_PAGE: replaces articles/articlesCount, sets currentPage from action.page', () => {
    const articles = [makeArticle()];
    const state = reducer({ currentPage: 0 }, {
      type: 'SET_PAGE',
      page: 2,
      payload: { articles, articlesCount: 25 },
    });
    expect(state).toMatchObject({ articles, articlesCount: 25, currentPage: 2 });
  });

  it('APPLY_TAG_FILTER: sets tag/pager, clears tab, resets currentPage to 0', () => {
    const pager = () => {};
    const articles = [makeArticle()];
    const state = reducer(
      { tab: 'feed', tag: null, currentPage: 3 },
      { type: 'APPLY_TAG_FILTER', tag: 'redux', pager, payload: { articles, articlesCount: 1 } },
    );
    expect(state).toMatchObject({ tag: 'redux', pager, tab: null, currentPage: 0, articles, articlesCount: 1 });
  });

  it('HOME_PAGE_LOADED: tags from payload[0], articles/count from payload[1], pins tuple order', () => {
    const tags = ['a', 'b'];
    const articles = [makeArticle()];
    const state = reducer(undefined, {
      type: 'HOME_PAGE_LOADED',
      tab: 'all',
      pager: 'PAGER',
      payload: [{ tags }, { articles, articlesCount: 1 }],
    });
    expect(state).toMatchObject({
      pager: 'PAGER',
      tags,
      articles,
      articlesCount: 1,
      currentPage: 0,
      tab: 'all',
    });
  });

  it('HOME_PAGE_UNLOADED: resets to {}', () => {
    expect(reducer({ articles: [] }, { type: 'HOME_PAGE_UNLOADED' })).toEqual({});
  });

  it('CHANGE_TAB: sets tab/pager/articles, clears tag, resets currentPage', () => {
    const articles = [makeArticle()];
    const state = reducer(
      { tag: 'redux', currentPage: 5 },
      { type: 'CHANGE_TAB', tab: 'feed', pager: 'PAGER', payload: { articles, articlesCount: 1 } },
    );
    expect(state).toMatchObject({ pager: 'PAGER', articles, articlesCount: 1, tab: 'feed', currentPage: 0, tag: null });
  });

  it('PROFILE_PAGE_LOADED: articles/count from payload[1] (payload[0] is the profile, ignored here)', () => {
    const articles = [makeArticle()];
    const state = reducer(undefined, {
      type: 'PROFILE_PAGE_LOADED',
      pager: 'PAGER',
      payload: [{ profile: { username: 'anna' } }, { articles, articlesCount: 1 }],
    });
    expect(state).toMatchObject({ pager: 'PAGER', articles, articlesCount: 1, currentPage: 0 });
  });

  it('PROFILE_FAVORITES_PAGE_LOADED: shares the exact same branch as PROFILE_PAGE_LOADED', () => {
    const articles = [makeArticle()];
    const state = reducer(undefined, {
      type: 'PROFILE_FAVORITES_PAGE_LOADED',
      pager: 'PAGER',
      payload: [{ profile: {} }, { articles, articlesCount: 2 }],
    });
    expect(state).toMatchObject({ pager: 'PAGER', articles, articlesCount: 2, currentPage: 0 });
  });

  it('PROFILE_PAGE_UNLOADED and PROFILE_FAVORITES_PAGE_UNLOADED both reset to {}', () => {
    expect(reducer({ articles: [] }, { type: 'PROFILE_PAGE_UNLOADED' })).toEqual({});
    expect(reducer({ articles: [] }, { type: 'PROFILE_FAVORITES_PAGE_UNLOADED' })).toEqual({});
  });
});

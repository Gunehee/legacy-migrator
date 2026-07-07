import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSuperagentMock } from './helpers/superagentMock.js';

const API_ROOT = 'https://conduit.productionready.io/api';

let sa;
let agent;

beforeEach(async () => {
  vi.resetModules();
  sa = createSuperagentMock();
  vi.doMock('superagent', () => ({ default: sa.module, ...sa.module }));
  ({ default: agent } = await import('@app/agent'));
});

function lastCall() {
  return sa.calls[sa.calls.length - 1];
}

describe('agent: Articles URL building', () => {
  it('all(): no page -> limit=10&offset=0', async () => {
    sa.setResponse({ articles: [], articlesCount: 0 });
    await agent.Articles.all();
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/articles?limit=10&offset=0` });
  });

  it('all(page): offset = 10 * page', async () => {
    sa.setResponse({ articles: [], articlesCount: 0 });
    await agent.Articles.all(2);
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/articles?limit=10&offset=20` });
  });

  it('byAuthor: limit 5, encodes the author', async () => {
    sa.setResponse({ articles: [] });
    await agent.Articles.byAuthor('anna b');
    expect(lastCall()).toMatchObject({
      method: 'GET',
      url: `${API_ROOT}/articles?author=${encodeURIComponent('anna b')}&limit=5&offset=0`,
    });
  });

  it('byAuthor(author, page): offset = 5 * page', async () => {
    sa.setResponse({ articles: [] });
    await agent.Articles.byAuthor('anna', 3);
    expect(lastCall().url).toBe(`${API_ROOT}/articles?author=anna&limit=5&offset=15`);
  });

  it('favoritedBy: limit 5, encodes the author, favorited= query key', async () => {
    sa.setResponse({ articles: [] });
    await agent.Articles.favoritedBy('anna b');
    expect(lastCall().url).toBe(`${API_ROOT}/articles?favorited=${encodeURIComponent('anna b')}&limit=5&offset=0`);
  });

  it('byTag: limit 10, encodes the tag', async () => {
    sa.setResponse({ articles: [] });
    await agent.Articles.byTag('c++');
    expect(lastCall().url).toBe(`${API_ROOT}/articles?tag=${encodeURIComponent('c++')}&limit=10&offset=0`);
  });

  it('feed: fixed limit=10&offset=0, no page param supported', async () => {
    sa.setResponse({ articles: [] });
    await agent.Articles.feed();
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/articles/feed?limit=10&offset=0` });
  });

  it('get(slug): GET /articles/:slug', async () => {
    sa.setResponse({ article: { slug: 'my-slug' } });
    await agent.Articles.get('my-slug');
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/articles/my-slug` });
  });

  it('del(slug): DELETE /articles/:slug', async () => {
    sa.setResponse({});
    await agent.Articles.del('my-slug');
    expect(lastCall()).toMatchObject({ method: 'DELETE', url: `${API_ROOT}/articles/my-slug` });
  });

  it('favorite(slug): POST /articles/:slug/favorite, no body', async () => {
    sa.setResponse({ article: {} });
    await agent.Articles.favorite('my-slug');
    expect(lastCall()).toMatchObject({ method: 'POST', url: `${API_ROOT}/articles/my-slug/favorite`, body: undefined });
  });

  it('unfavorite(slug): DELETE /articles/:slug/favorite', async () => {
    sa.setResponse({ article: {} });
    await agent.Articles.unfavorite('my-slug');
    expect(lastCall()).toMatchObject({ method: 'DELETE', url: `${API_ROOT}/articles/my-slug/favorite` });
  });

  it('create(article): POST /articles with {article} body', async () => {
    sa.setResponse({ article: { slug: 'new-1' } });
    const article = { title: 'T', description: 'D', body: 'B', tagList: [] };
    await agent.Articles.create(article);
    expect(lastCall()).toMatchObject({ method: 'POST', url: `${API_ROOT}/articles`, body: { article } });
  });

  it('update(article): PUTs to /articles/<slug> and strips slug from the body via omitSlug', async () => {
    sa.setResponse({ article: { slug: 'my-slug' } });
    const article = { slug: 'my-slug', title: 'T2', description: 'D2', body: 'B2', tagList: [] };
    await agent.Articles.update(article);
    const call = lastCall();
    expect(call.method).toBe('PUT');
    expect(call.url).toBe(`${API_ROOT}/articles/my-slug`);
    // omitSlug does Object.assign({}, article, { slug: undefined }) -- the key
    // is present but its value is undefined (not deleted).
    expect(call.body.article).toHaveProperty('slug');
    expect(call.body.article.slug).toBeUndefined();
    expect(call.body.article).toMatchObject({ title: 'T2', description: 'D2', body: 'B2', tagList: [] });
  });
});

describe('agent: Comments', () => {
  it('create(slug, comment): POST /articles/:slug/comments with {comment} body', async () => {
    sa.setResponse({ comment: { id: 1, body: 'hi' } });
    await agent.Comments.create('my-slug', { body: 'hi' });
    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${API_ROOT}/articles/my-slug/comments`,
      body: { comment: { body: 'hi' } },
    });
  });

  it('delete(slug, commentId): DELETE /articles/:slug/comments/:id', async () => {
    sa.setResponse({});
    await agent.Comments.delete('my-slug', 7);
    expect(lastCall()).toMatchObject({ method: 'DELETE', url: `${API_ROOT}/articles/my-slug/comments/7` });
  });

  it('forArticle(slug): GET /articles/:slug/comments', async () => {
    sa.setResponse({ comments: [] });
    await agent.Comments.forArticle('my-slug');
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/articles/my-slug/comments` });
  });
});

describe('agent: Profile', () => {
  it('follow(username): POST /profiles/:username/follow', async () => {
    sa.setResponse({ profile: {} });
    await agent.Profile.follow('anna');
    expect(lastCall()).toMatchObject({ method: 'POST', url: `${API_ROOT}/profiles/anna/follow` });
  });

  it('unfollow(username): DELETE /profiles/:username/follow', async () => {
    sa.setResponse({ profile: {} });
    await agent.Profile.unfollow('anna');
    expect(lastCall()).toMatchObject({ method: 'DELETE', url: `${API_ROOT}/profiles/anna/follow` });
  });

  it('get(username): GET /profiles/:username', async () => {
    sa.setResponse({ profile: { username: 'anna' } });
    await agent.Profile.get('anna');
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/profiles/anna` });
  });
});

describe('agent: Auth', () => {
  it('login(email, password): POST /users/login with {user:{email,password}} body', async () => {
    sa.setResponse({ user: {} });
    await agent.Auth.login('a@b.com', 'pw');
    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${API_ROOT}/users/login`,
      body: { user: { email: 'a@b.com', password: 'pw' } },
    });
  });

  it('register(username, email, password): POST /users with {user:{username,email,password}} body', async () => {
    sa.setResponse({ user: {} });
    await agent.Auth.register('jo', 'a@b.com', 'pw');
    expect(lastCall()).toMatchObject({
      method: 'POST',
      url: `${API_ROOT}/users`,
      body: { user: { username: 'jo', email: 'a@b.com', password: 'pw' } },
    });
  });

  it('save(user): PUT /user with {user} body', async () => {
    sa.setResponse({ user: {} });
    const user = { username: 'jo', bio: 'hi' };
    await agent.Auth.save(user);
    expect(lastCall()).toMatchObject({ method: 'PUT', url: `${API_ROOT}/user`, body: { user } });
  });

  it('current(): GET /user', async () => {
    sa.setResponse({ user: { username: 'jo' } });
    await agent.Auth.current();
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/user` });
  });
});

describe('agent: Tags', () => {
  it('getAll(): GET /tags', async () => {
    sa.setResponse({ tags: ['a', 'b'] });
    await agent.Tags.getAll();
    expect(lastCall()).toMatchObject({ method: 'GET', url: `${API_ROOT}/tags` });
  });
});

describe('agent: token header + response unwrapping', () => {
  it('with no token set: no authorization header is sent', async () => {
    sa.setResponse({ user: {} });
    await agent.Auth.current();
    expect(lastCall().headers.authorization).toBeUndefined();
  });

  it('after setToken("abc"): subsequent requests carry authorization "Token abc"', async () => {
    agent.setToken('abc');
    sa.setResponse({ user: {} });
    await agent.Auth.current();
    expect(lastCall().headers.authorization).toBe('Token abc');
  });

  it('setToken(null): clears the token, no more authorization header', async () => {
    agent.setToken('abc');
    agent.setToken(null);
    sa.setResponse({ user: {} });
    await agent.Auth.current();
    expect(lastCall().headers.authorization).toBeUndefined();
  });

  it('resolved value is res.body (responseBody unwrapping)', async () => {
    const body = { tags: ['x', 'y'] };
    sa.setResponse(body);
    const result = await agent.Tags.getAll();
    expect(result).toEqual(body);
  });
});

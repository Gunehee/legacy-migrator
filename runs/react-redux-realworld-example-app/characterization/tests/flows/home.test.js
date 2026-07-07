import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { articlesList, makeArticle, tags } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('home page (logged out)', () => {
  it('loads tags + global feed and renders banner, articles and popular tags', async () => {
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue(articlesList([makeArticle()]));

    await renderApp({ route: '/' });

    expect(await screen.findByText('A place to share your knowledge.')).toBeInTheDocument();
    expect(await screen.findByText('How to test')).toBeInTheDocument();
    expect(screen.getByText('About testing')).toBeInTheDocument();
    expect(screen.getByText('Global Feed')).toBeInTheDocument();
    // logged out: no "Your Feed" tab, sign in/up links present
    expect(screen.queryByText('Your Feed')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Popular Tags')).toBeInTheDocument();
    expect(agent.default.Articles.all).toHaveBeenCalledTimes(1);
    expect(agent.default.Articles.feed).not.toHaveBeenCalled();
  });

  it('boots as logged-in when a jwt is stored: fetches current user and feed', async () => {
    agent.default.Auth.current.mockResolvedValue({ user: { username: 'jo', image: '', email: 'jo@example.com', token: 'jwt.token.here' } });
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.feed.mockResolvedValue(articlesList([makeArticle({ title: 'Feed article', slug: 'feed-1' })]));

    await renderApp({ route: '/', jwt: 'jwt.token.here' });

    expect(await screen.findByText('Feed article')).toBeInTheDocument();
    expect(await screen.findByText('Your Feed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('jo')).toBeInTheDocument());
    expect(agent.default.setToken).toHaveBeenCalledWith('jwt.token.here');
    expect(agent.default.Articles.feed).toHaveBeenCalledTimes(1);
    expect(agent.default.Articles.all).not.toHaveBeenCalled();
    // logged-in home hides the banner
    expect(screen.queryByText('A place to share your knowledge.')).not.toBeInTheDocument();
  });
});

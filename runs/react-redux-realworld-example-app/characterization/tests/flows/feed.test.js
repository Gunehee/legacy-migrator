import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { articlesList, makeArticle, tags, user } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('article preview: favorite / unfavorite', () => {
  it('favoriting flips the button to btn-primary and updates the count', async () => {
    const article = makeArticle({ favorited: false, favoritesCount: 3 });
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue(articlesList([article]));
    agent.default.Articles.favorite.mockResolvedValue({
      article: { ...article, favorited: true, favoritesCount: 4 },
    });

    await renderApp({ route: '/' });

    const preview = (await screen.findByText('How to test')).closest('.article-preview');
    const btn = preview.querySelector('button');
    expect(btn.className).not.toContain('btn-primary');
    expect(btn.className).toContain('btn-outline-primary');

    fireEvent.click(btn);
    expect(agent.default.Articles.favorite).toHaveBeenCalledWith('how-to-test-1');

    await waitFor(() => expect(btn.textContent.trim()).toBe('4'));
    expect(btn.className).toContain('btn-primary');
    expect(btn.className).not.toContain('btn-outline-primary');
  });

  it('unfavoriting flips the button back to btn-outline-primary and updates the count', async () => {
    const article = makeArticle({ favorited: true, favoritesCount: 4 });
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue(articlesList([article]));
    agent.default.Articles.unfavorite.mockResolvedValue({
      article: { ...article, favorited: false, favoritesCount: 3 },
    });

    await renderApp({ route: '/' });

    const preview = (await screen.findByText('How to test')).closest('.article-preview');
    const btn = preview.querySelector('button');
    expect(btn.className).toContain('btn-primary');
    expect(btn.className).not.toContain('btn-outline-primary');

    fireEvent.click(btn);
    expect(agent.default.Articles.unfavorite).toHaveBeenCalledWith('how-to-test-1');

    await waitFor(() => expect(btn.textContent.trim()).toBe('3'));
    expect(btn.className).not.toContain('btn-primary');
    expect(btn.className).toContain('btn-outline-primary');
  });
});

describe('home: tag filter', () => {
  it('clicking a popular tag calls Articles.byTag with the tag and re-renders the list', async () => {
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue(articlesList([makeArticle()]));
    agent.default.Articles.byTag.mockResolvedValue(
      articlesList([makeArticle({ slug: 'tagged-1', title: 'Tagged article' })]),
    );

    await renderApp({ route: '/' });
    await screen.findByText('How to test');

    fireEvent.click(screen.getByText('redux'));

    expect(agent.default.Articles.byTag).toHaveBeenCalledWith('redux');
    expect(await screen.findByText('Tagged article')).toBeInTheDocument();
  });
});

describe('home: tab switch (logged in)', () => {
  it('clicking Global Feed calls Articles.all and swaps the article list', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.feed.mockResolvedValue(
      articlesList([makeArticle({ title: 'Feed article', slug: 'feed-1' })]),
    );
    agent.default.Articles.all.mockResolvedValue(
      articlesList([makeArticle({ title: 'Global article', slug: 'global-1' })]),
    );

    await renderApp({ route: '/', jwt: user.token });
    await screen.findByText('Feed article');

    fireEvent.click(screen.getByText('Global Feed'));

    expect(agent.default.Articles.all).toHaveBeenCalled();
    expect(await screen.findByText('Global article')).toBeInTheDocument();
  });
});

describe('home: pagination', () => {
  it('renders page links only when articlesCount > 10, and paginates zero-based', async () => {
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue({ articles: [makeArticle()], articlesCount: 25 });

    await renderApp({ route: '/' });
    await screen.findByText('How to test');

    const pageItems = () => Array.from(document.querySelectorAll('.pagination li'));
    await waitFor(() => expect(pageItems()).toHaveLength(3));
    expect(pageItems().map((li) => li.textContent.trim())).toEqual(['1', '2', '3']);
    expect(pageItems()[0].className).toContain('active');

    fireEvent.click(screen.getByText('2'));

    expect(agent.default.Articles.all).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(pageItems()[1].className).toContain('active'));
    expect(pageItems()[0].className).not.toContain('active');
  });

  it('pagination does not render when articlesCount <= 10', async () => {
    agent.default.Tags.getAll.mockResolvedValue({ tags });
    agent.default.Articles.all.mockResolvedValue({ articles: [makeArticle()], articlesCount: 10 });

    await renderApp({ route: '/' });
    await screen.findByText('How to test');

    expect(document.querySelector('.pagination')).toBeNull();
  });
});

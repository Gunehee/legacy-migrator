import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { articlesList, author, makeArticle } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('profile page', () => {
  it('renders username/bio/image and the author articles (logged out)', async () => {
    agent.default.Profile.get.mockResolvedValue({ profile: author });
    agent.default.Articles.byAuthor.mockResolvedValue(
      articlesList([makeArticle({ title: 'By anna', author })]),
    );

    await renderApp({ route: '/@anna' });

    expect(await screen.findByText('By anna')).toBeInTheDocument();
    const userInfo = document.querySelector('.user-info');
    expect(userInfo.textContent).toContain('anna');
    expect(userInfo.textContent).toContain('writer');
    expect(screen.getAllByAltText('anna').length).toBeGreaterThan(0);
    expect(agent.default.Articles.byAuthor).toHaveBeenCalledWith('anna');
  });

  it('follow button toggles to Unfollow after Profile.follow resolves', async () => {
    agent.default.Profile.get.mockResolvedValue({ profile: author });
    agent.default.Articles.byAuthor.mockResolvedValue(articlesList([]));
    agent.default.Profile.follow.mockResolvedValue({ profile: { ...author, following: true } });

    await renderApp({ route: '/@anna' });

    const followBtn = await screen.findByText('Follow anna');
    fireEvent.click(followBtn);

    expect(agent.default.Profile.follow).toHaveBeenCalledWith('anna');
    expect(await screen.findByText('Unfollow anna')).toBeInTheDocument();
  });

  it('favorites tab (/@anna/favorites) uses Articles.favoritedBy and marks the tab active', async () => {
    agent.default.Profile.get.mockResolvedValue({ profile: author });
    agent.default.Articles.favoritedBy.mockResolvedValue(
      articlesList([makeArticle({ title: 'Favorited by anna', author })]),
    );

    await renderApp({ route: '/@anna/favorites' });

    expect(await screen.findByText('Favorited by anna')).toBeInTheDocument();
    expect(agent.default.Articles.favoritedBy).toHaveBeenCalledWith('anna');

    const favoritedTab = screen.getByText('Favorited Articles');
    expect(favoritedTab.className).toContain('active');
    const myArticlesTab = screen.getByText('My Articles');
    expect(myArticlesTab.className).not.toContain('active');
  });

  it('own profile: shows Edit Profile Settings link instead of a follow button', async () => {
    agent.default.Auth.current.mockResolvedValue({
      user: { username: 'anna', email: 'anna@example.com', bio: author.bio, image: author.image },
    });
    agent.default.Profile.get.mockResolvedValue({ profile: author });
    agent.default.Articles.byAuthor.mockResolvedValue(articlesList([]));

    await renderApp({ route: '/@anna', jwt: 'anna-token' });

    expect(await screen.findByText('Edit Profile Settings')).toBeInTheDocument();
    expect(screen.queryByText('Follow anna')).not.toBeInTheDocument();
    expect(screen.queryByText('Unfollow anna')).not.toBeInTheDocument();
  });
});

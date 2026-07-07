import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { makeArticle, user } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('editor: create new article', () => {
  it('renders an empty form when logged in', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    await renderApp({ route: '/editor', jwt: user.token });

    const title = await screen.findByPlaceholderText('Article Title');
    expect(title.value).toBe('');
    expect(screen.getByPlaceholderText("What's this article about?").value).toBe('');
    expect(screen.getByPlaceholderText('Write your article (in markdown)').value).toBe('');
  });

  it('typing populates title/description/body fields', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    await renderApp({ route: '/editor', jwt: user.token });

    const title = await screen.findByPlaceholderText('Article Title');
    const description = screen.getByPlaceholderText("What's this article about?");
    const body = screen.getByPlaceholderText('Write your article (in markdown)');

    fireEvent.change(title, { target: { value: 'My Title' } });
    fireEvent.change(description, { target: { value: 'My Description' } });
    fireEvent.change(body, { target: { value: 'My **Body**' } });

    await waitFor(() => expect(title.value).toBe('My Title'));
    expect(description.value).toBe('My Description');
    expect(body.value).toBe('My **Body**');
  });

  it('typing a tag + Enter adds a pill; clicking its close icon removes it', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    await renderApp({ route: '/editor', jwt: user.token });

    const tagInput = await screen.findByPlaceholderText('Enter tags');
    fireEvent.change(tagInput, { target: { value: 'testing' } });
    fireEvent.keyUp(tagInput, { keyCode: 13 });

    expect(await screen.findByText('testing')).toBeInTheDocument();
    await waitFor(() => expect(tagInput.value).toBe(''));

    const pill = screen.getByText('testing').closest('.tag-pill');
    const closeIcon = pill.querySelector('.ion-close-round');
    fireEvent.click(closeIcon);

    await waitFor(() => expect(screen.queryByText('testing')).not.toBeInTheDocument());
  });

  it('submit calls Articles.create with the form fields and redirects to the new article', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    const created = makeArticle({ slug: 'my-new-article' });
    agent.default.Articles.create.mockResolvedValue({ article: created });
    agent.default.Articles.get.mockResolvedValue({ article: created });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [] });

    const { history } = await renderApp({ route: '/editor', jwt: user.token });

    fireEvent.change(await screen.findByPlaceholderText('Article Title'), { target: { value: 'New title' } });
    fireEvent.change(screen.getByPlaceholderText("What's this article about?"), { target: { value: 'New desc' } });
    fireEvent.change(screen.getByPlaceholderText('Write your article (in markdown)'), {
      target: { value: 'New body' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter tags'), { target: { value: 'newtag' } });
    fireEvent.keyUp(screen.getByPlaceholderText('Enter tags'), { keyCode: 13 });
    await screen.findByText('newtag');

    fireEvent.click(screen.getByText('Publish Article'));

    expect(agent.default.Articles.create).toHaveBeenCalledWith({
      title: 'New title',
      description: 'New desc',
      body: 'New body',
      tagList: ['newtag'],
    });

    await waitFor(() => expect(history.location.pathname).toBe('/article/my-new-article'));
    await waitFor(() => expect(agent.default.Articles.get).toHaveBeenCalledWith('my-new-article'));
  });
});

describe('editor: edit existing article', () => {
  it('loads the existing article into the form and submit calls Articles.update with slug present in the payload', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    const existing = makeArticle({ slug: 'how-to-test-1', title: 'Old title' });
    agent.default.Articles.get.mockResolvedValue({ article: existing });
    agent.default.Articles.update.mockResolvedValue({ article: existing });

    await renderApp({ route: '/editor/how-to-test-1', jwt: user.token });

    const title = await screen.findByPlaceholderText('Article Title');
    await waitFor(() => expect(title.value).toBe('Old title'));

    fireEvent.change(title, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByText('Publish Article'));

    await waitFor(() => expect(agent.default.Articles.update).toHaveBeenCalled());
    const arg = agent.default.Articles.update.mock.calls[0][0];
    expect(arg.slug).toBe('how-to-test-1');
    expect(arg.title).toBe('Updated title');
  });
});

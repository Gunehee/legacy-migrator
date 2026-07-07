import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { author, makeArticle, makeComment, user } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('article page (logged out)', () => {
  it('renders title, markdown body, tags, and comments with author + date', async () => {
    const article = makeArticle();
    const comment = makeComment();
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [comment] });

    await renderApp({ route: '/article/how-to-test-1' });

    const heading = await screen.findByText('How to test');
    expect(heading.tagName).toBe('H1');

    // 'Plain **markdown** body' -> a real <strong> element
    const strong = document.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong.textContent).toBe('markdown');

    expect(screen.getByText('testing')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();

    expect(screen.getByText('Nice article!')).toBeInTheDocument();
    expect(screen.getAllByText(author.username).length).toBeGreaterThan(0);
    expect(screen.getByText(new Date(comment.createdAt).toDateString())).toBeInTheDocument();

    expect(screen.queryByText('Edit Article')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Article')).not.toBeInTheDocument();

    expect(screen.getByText(/to add comments on this article/)).toBeInTheDocument();
  });

  it('escapes raw HTML in the markdown body (marked sanitize:true) -- no script element renders', async () => {
    const article = makeArticle({ body: '<script>alert(1)</script>hello' });
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [] });

    await renderApp({ route: '/article/how-to-test-1' });

    await screen.findByText('How to test');
    expect(document.querySelector('script')).toBeNull();
    // marked HTML-escapes the raw tag text; it shows up as literal visible text
    expect(document.body.textContent).toContain('<script>alert(1)</script>hello');
  });
});

describe('article page (logged in as the article author)', () => {
  it('shows Edit/Delete Article buttons; delete navigates home', async () => {
    const article = makeArticle(); // author fixture username: 'anna'
    agent.default.Auth.current.mockResolvedValue({
      user: { username: author.username, email: 'anna@example.com', bio: author.bio, image: author.image },
    });
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [] });
    agent.default.Articles.del.mockResolvedValue({});

    const { history } = await renderApp({ route: '/article/how-to-test-1', jwt: 'anna-token' });

    await screen.findByText('Edit Article');
    fireEvent.click(screen.getByText('Delete Article'));

    expect(agent.default.Articles.del).toHaveBeenCalledWith('how-to-test-1');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
  });
});

describe('article page comments (logged in)', () => {
  it('adding a comment appends it to the list and clears the textarea', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    const article = makeArticle();
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [] });
    const newComment = makeComment({ id: 42, body: 'A fresh take', author: user });
    agent.default.Comments.create.mockResolvedValue({ comment: newComment });

    await renderApp({ route: '/article/how-to-test-1', jwt: user.token });

    const textarea = await screen.findByPlaceholderText('Write a comment...');
    fireEvent.change(textarea, { target: { value: 'A fresh take' } });
    fireEvent.submit(textarea.closest('form'));

    expect(agent.default.Comments.create).toHaveBeenCalledWith('how-to-test-1', { body: 'A fresh take' });
    expect(await screen.findByText('A fresh take')).toBeInTheDocument();
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('deleting a comment removes it from the list', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    const article = makeArticle();
    const ownComment = makeComment({ id: 99, body: 'Delete me', author: user });
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [ownComment] });
    agent.default.Comments.delete.mockResolvedValue({});

    await renderApp({ route: '/article/how-to-test-1', jwt: user.token });

    const commentText = await screen.findByText('Delete me');
    const card = commentText.closest('.card');
    const deleteIcon = card.querySelector('.ion-trash-a');
    expect(deleteIcon).not.toBeNull();

    fireEvent.click(deleteIcon);

    expect(agent.default.Comments.delete).toHaveBeenCalledWith('how-to-test-1', 99);
    await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument());
  });

  it('logged out: shows the sign in / sign up to add comments prompt (no comment form)', async () => {
    const article = makeArticle();
    agent.default.Articles.get.mockResolvedValue({ article });
    agent.default.Comments.forArticle.mockResolvedValue({ comments: [] });

    await renderApp({ route: '/article/how-to-test-1' });

    await screen.findByText('How to test');
    expect(screen.getByText(/to add comments on this article/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument();
  });
});

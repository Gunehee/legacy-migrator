import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { user } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
});

describe('settings page', () => {
  it('prefills the form with the current user image/username/bio/email', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });

    await renderApp({ route: '/settings', jwt: user.token });

    const username = await screen.findByPlaceholderText('Username');
    await waitFor(() => expect(username.value).toBe(user.username));
    expect(screen.getByPlaceholderText('Email').value).toBe(user.email);
    expect(screen.getByPlaceholderText('Short bio about you').value).toBe(user.bio);
    expect(screen.getByPlaceholderText('URL of profile picture').value).toBe(user.image);
    expect(screen.getByPlaceholderText('New Password').value).toBe('');
  });

  it('changing username and submitting calls Auth.save with updated fields (password omitted when empty) and redirects home', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });
    const updated = { ...user, username: 'jo2' };
    agent.default.Auth.save.mockResolvedValue({ user: updated });

    await renderApp({ route: '/settings', jwt: user.token });

    const username = await screen.findByPlaceholderText('Username');
    await waitFor(() => expect(username.value).toBe(user.username));

    fireEvent.change(username, { target: { value: 'jo2' } });
    fireEvent.submit(username.closest('form'));

    expect(agent.default.Auth.save).toHaveBeenCalledWith({
      image: user.image,
      username: 'jo2',
      bio: user.bio,
      email: user.email,
    });
    // password field was empty -> `delete user.password` -> key absent from the payload
    const arg = agent.default.Auth.save.mock.calls[0][0];
    expect(arg).not.toHaveProperty('password');

    await waitFor(() => expect(screen.getByText('jo2')).toBeInTheDocument());
  });
});

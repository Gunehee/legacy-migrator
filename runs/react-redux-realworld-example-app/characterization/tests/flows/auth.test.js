import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentMockFactory, renderApp } from '../helpers/renderApp.js';
import { user } from '../helpers/fixtures.js';

let agent;

beforeEach(() => {
  vi.resetModules();
  agent = agentMockFactory();
  vi.doMock('@app/agent', () => agent);
  window.localStorage.clear();
});

describe('login page', () => {
  it('renders the sign-in form', async () => {
    await renderApp({ route: '/login' });
    expect(await screen.findByText('Sign In')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('typing dispatches field updates and the inputs show the typed values', async () => {
    await renderApp({ route: '/login' });
    const email = await screen.findByPlaceholderText('Email');
    const password = screen.getByPlaceholderText('Password');

    fireEvent.change(email, { target: { value: 'jo@example.com' } });
    fireEvent.change(password, { target: { value: 'secret' } });

    await waitFor(() => expect(email.value).toBe('jo@example.com'));
    expect(password.value).toBe('secret');
  });

  it('submit success: redirects to home, header shows username, sign-in link is gone, jwt persisted', async () => {
    agent.default.Auth.login.mockResolvedValue({ user });
    await renderApp({ route: '/login' });

    fireEvent.change(await screen.findByPlaceholderText('Email'), { target: { value: user.email } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'whatever' } });
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'));

    expect(agent.default.Auth.login).toHaveBeenCalledWith(user.email, 'whatever');

    await waitFor(() => expect(screen.getByText(user.username)).toBeInTheDocument());
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('jwt')).toBe(user.token);
    expect(agent.default.setToken).toHaveBeenCalledWith(user.token);
  });

  it('submit failure: shows the error list, stays on the login page', async () => {
    agent.default.Auth.login.mockRejectedValue({
      response: { body: { errors: { 'email or password': ['is invalid'] } } },
    });
    await renderApp({ route: '/login' });

    fireEvent.change(await screen.findByPlaceholderText('Email'), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'));

    expect(await screen.findByText('email or password is invalid')).toBeInTheDocument();
    // still on the login page
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(window.localStorage.getItem('jwt')).toBeNull();
  });
});

describe('register page', () => {
  it('submit success calls Auth.register with username/email/password and redirects home', async () => {
    agent.default.Auth.register.mockResolvedValue({ user: { ...user, username: 'newbie' } });
    await renderApp({ route: '/register' });

    fireEvent.change(await screen.findByPlaceholderText('Username'), { target: { value: 'newbie' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'newbie@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw123' } });
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'));

    expect(agent.default.Auth.register).toHaveBeenCalledWith('newbie', 'newbie@example.com', 'pw123');
    await waitFor(() => expect(screen.getByText('newbie')).toBeInTheDocument());
    expect(window.localStorage.getItem('jwt')).toBe(user.token);
  });

  it('submit failure shows error list and stays on register page', async () => {
    agent.default.Auth.register.mockRejectedValue({
      response: { body: { errors: { username: ['is already taken'] } } },
    });
    await renderApp({ route: '/register' });

    fireEvent.change(await screen.findByPlaceholderText('Username'), { target: { value: 'taken' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'x@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pw123' } });
    fireEvent.submit(screen.getByPlaceholderText('Password').closest('form'));

    expect(await screen.findByText('username is already taken')).toBeInTheDocument();
    expect(screen.getByText('Sign Up')).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('logging out from settings clears the header username and writes empty-string jwt', async () => {
    agent.default.Auth.current.mockResolvedValue({ user });

    await renderApp({ route: '/settings', jwt: user.token });

    await waitFor(() => expect(screen.getByText(user.username)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Or click here to logout.'));

    await waitFor(() => expect(screen.queryByText(user.username)).not.toBeInTheDocument());
    expect(window.localStorage.getItem('jwt')).toBe('');
    expect(agent.default.setToken).toHaveBeenCalledWith(null);
  });
});

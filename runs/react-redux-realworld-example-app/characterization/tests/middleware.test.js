import { beforeEach, describe, expect, it, vi } from 'vitest';

let promiseMiddleware;
let localStorageMiddleware;
let agent;

beforeEach(async () => {
  vi.resetModules();
  agent = { default: { setToken: vi.fn() } };
  vi.doMock('@app/agent', () => agent);
  ({ promiseMiddleware, localStorageMiddleware } = await import('@app/middleware'));
});

function makeStore(state) {
  return {
    getState: vi.fn(() => state),
    dispatch: vi.fn(),
  };
}

describe('middleware: promiseMiddleware', () => {
  it('passes a non-promise payload through to next untouched', () => {
    const store = makeStore({ viewChangeCounter: 0 });
    const next = vi.fn();
    const action = { type: 'UPDATE_FIELD_AUTH', key: 'email', value: 'x' };
    promiseMiddleware(store)(next)(action);
    expect(next).toHaveBeenCalledWith(action);
    expect(store.dispatch).not.toHaveBeenCalled();
  });

  it('promise payload: next is NOT called; ASYNC_START dispatched synchronously with subtype', () => {
    const store = makeStore({ viewChangeCounter: 0 });
    const next = vi.fn();
    let resolvePromise;
    const payload = new Promise((res) => { resolvePromise = res; });
    const action = { type: 'LOGIN', payload };
    promiseMiddleware(store)(next)(action);
    expect(next).not.toHaveBeenCalled();
    expect(store.dispatch).toHaveBeenCalledWith({ type: 'ASYNC_START', subtype: 'LOGIN' });
    resolvePromise({ user: { username: 'jo' } });
  });

  it('on resolution: dispatches ASYNC_END then the action with payload replaced by resolved value', async () => {
    const state = { viewChangeCounter: 0 };
    const store = makeStore(state);
    const next = vi.fn();
    const resolved = { user: { username: 'jo' } };
    const payload = Promise.resolve(resolved);
    const action = { type: 'LOGIN', payload };
    promiseMiddleware(store)(next)(action);
    await payload;
    await Promise.resolve(); // let the .then handlers flush
    expect(action.payload).toBe(resolved);
    const dispatched = store.dispatch.mock.calls.map((c) => c[0]);
    expect(dispatched[0]).toEqual({ type: 'ASYNC_START', subtype: 'LOGIN' });
    expect(dispatched[1]).toEqual({ type: 'ASYNC_END', promise: resolved });
    expect(dispatched[2]).toBe(action);
    expect(dispatched[2].payload).toBe(resolved);
  });

  it('rejection path: sets action.error=true, payload=error.response.body, dispatches ASYNC_END then action', async () => {
    const state = { viewChangeCounter: 0 };
    const store = makeStore(state);
    const next = vi.fn();
    const errBody = { errors: { 'email or password': ['is invalid'] } };
    const error = { response: { body: errBody } };
    const payload = Promise.reject(error);
    const action = { type: 'LOGIN', payload };
    promiseMiddleware(store)(next)(action);
    await payload.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(action.error).toBe(true);
    expect(action.payload).toBe(errBody);
    const dispatched = store.dispatch.mock.calls.map((c) => c[0]);
    expect(dispatched[1]).toEqual({ type: 'ASYNC_END', promise: errBody });
    expect(dispatched[2]).toBe(action);
  });

  it('rejection path with skipTracking: ASYNC_END NOT dispatched, action still dispatched', async () => {
    const state = { viewChangeCounter: 0 };
    const store = makeStore(state);
    const next = vi.fn();
    const errBody = { errors: { base: ['boom'] } };
    const error = { response: { body: errBody } };
    const payload = Promise.reject(error);
    const action = { type: 'APP_LOAD', payload, skipTracking: true };
    promiseMiddleware(store)(next)(action);
    await payload.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    const dispatched = store.dispatch.mock.calls.map((c) => c[0]);
    // only ASYNC_START and the final action; no ASYNC_END
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toEqual({ type: 'ASYNC_START', subtype: 'APP_LOAD' });
    expect(dispatched[1]).toBe(action);
    expect(action.error).toBe(true);
    expect(action.payload).toBe(errBody);
  });

  it('stale-view guard: viewChangeCounter changes between dispatch and resolution -> nothing dispatched after resolution', async () => {
    const state = { viewChangeCounter: 0 };
    const store = makeStore(state);
    const next = vi.fn();
    const resolved = { articles: [] };
    const payload = Promise.resolve(resolved);
    const action = { type: 'HOME_PAGE_LOADED', payload };
    promiseMiddleware(store)(next)(action);
    // simulate navigating away before the promise settles
    state.viewChangeCounter = 1;
    await payload;
    await Promise.resolve();
    await Promise.resolve();
    const dispatched = store.dispatch.mock.calls.map((c) => c[0]);
    // only the initial ASYNC_START was dispatched; resolution branch bailed out
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ type: 'ASYNC_START', subtype: 'HOME_PAGE_LOADED' });
  });

  it('skipTracking bypasses the stale-view guard: dispatches proceed even after viewChangeCounter changes', async () => {
    const state = { viewChangeCounter: 0 };
    const store = makeStore(state);
    const next = vi.fn();
    const resolved = { user: { username: 'jo' } };
    const payload = Promise.resolve(resolved);
    const action = { type: 'APP_LOAD', payload, skipTracking: true };
    promiseMiddleware(store)(next)(action);
    state.viewChangeCounter = 1;
    await payload;
    await Promise.resolve();
    await Promise.resolve();
    const dispatched = store.dispatch.mock.calls.map((c) => c[0]);
    expect(dispatched[0]).toEqual({ type: 'ASYNC_START', subtype: 'APP_LOAD' });
    expect(dispatched[1]).toEqual({ type: 'ASYNC_END', promise: resolved });
    expect(dispatched[2]).toBe(action);
  });
});

describe('middleware: localStorageMiddleware', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('LOGIN success: writes payload.user.token to localStorage jwt and calls agent.setToken', () => {
    const store = makeStore({});
    const next = vi.fn();
    const action = { type: 'LOGIN', payload: { user: { token: 'abc123' } } };
    localStorageMiddleware(store)(next)(action);
    expect(window.localStorage.getItem('jwt')).toBe('abc123');
    expect(agent.default.setToken).toHaveBeenCalledWith('abc123');
    expect(next).toHaveBeenCalledWith(action);
  });

  it('REGISTER success: same as LOGIN', () => {
    const store = makeStore({});
    const next = vi.fn();
    const action = { type: 'REGISTER', payload: { user: { token: 'xyz789' } } };
    localStorageMiddleware(store)(next)(action);
    expect(window.localStorage.getItem('jwt')).toBe('xyz789');
    expect(agent.default.setToken).toHaveBeenCalledWith('xyz789');
  });

  it('LOGIN/REGISTER with action.error=true: does neither localStorage write nor setToken', () => {
    const store = makeStore({});
    const next = vi.fn();
    const action = { type: 'LOGIN', error: true, payload: { errors: {} } };
    localStorageMiddleware(store)(next)(action);
    expect(window.localStorage.getItem('jwt')).toBeNull();
    expect(agent.default.setToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(action);
  });

  it('LOGOUT: writes EMPTY STRING to jwt (not removeItem) and calls agent.setToken(null)', () => {
    window.localStorage.setItem('jwt', 'was-here');
    const store = makeStore({});
    const next = vi.fn();
    const action = { type: 'LOGOUT' };
    localStorageMiddleware(store)(next)(action);
    expect(window.localStorage.getItem('jwt')).toBe('');
    expect(window.localStorage.getItem('jwt')).not.toBeNull();
    expect(agent.default.setToken).toHaveBeenCalledWith(null);
    expect(next).toHaveBeenCalledWith(action);
  });

  it('other actions: untouched, always calls next(action)', () => {
    const store = makeStore({});
    const next = vi.fn();
    const action = { type: 'UPDATE_FIELD_AUTH', key: 'email', value: 'x' };
    localStorageMiddleware(store)(next)(action);
    expect(window.localStorage.getItem('jwt')).toBeNull();
    expect(agent.default.setToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(action);
  });
});

import { describe, expect, it, vi } from 'vitest';

async function freshStore() {
  vi.resetModules();
  return import('@app/store');
}

describe('store.js', () => {
  it('initial state is exactly { counter: 0, todos: [] }', async () => {
    const { store } = await freshStore();
    expect(store.getState()).toEqual({ counter: 0, todos: [] });
  });

  it('action creators produce exact shapes, including the text (not payload) field', async () => {
    const { increment, decrement, addTodo } = await freshStore();
    expect(increment()).toEqual({ type: 'INCREMENT' });
    expect(decrement()).toEqual({ type: 'DECREMENT' });
    expect(addTodo('buy milk')).toEqual({ type: 'ADD_TODO', text: 'buy milk' });
  });

  describe('counter slice', () => {
    it('INCREMENT moves the counter 0 -> 1', async () => {
      const { store, increment } = await freshStore();
      store.dispatch(increment());
      expect(store.getState().counter).toBe(1);
    });

    it('DECREMENT moves the counter 0 -> -1, no clamping at zero', async () => {
      const { store, decrement } = await freshStore();
      store.dispatch(decrement());
      expect(store.getState().counter).toBe(-1);
    });

    it('repeated DECREMENT keeps going negative: -1 -> -2', async () => {
      const { store, decrement } = await freshStore();
      store.dispatch(decrement());
      store.dispatch(decrement());
      expect(store.getState().counter).toBe(-2);
    });

    it('unknown action types leave the counter unchanged', async () => {
      const { store, increment } = await freshStore();
      store.dispatch(increment());
      store.dispatch({ type: 'NOT_A_REAL_ACTION' });
      expect(store.getState().counter).toBe(1);
    });

    it('ADD_TODO does not affect the counter slice', async () => {
      const { store, increment, addTodo } = await freshStore();
      store.dispatch(increment());
      store.dispatch(addTodo('x'));
      expect(store.getState().counter).toBe(1);
    });
  });

  describe('todos slice', () => {
    it('ADD_TODO appends action.text verbatim', async () => {
      const { store, addTodo } = await freshStore();
      store.dispatch(addTodo('first'));
      expect(store.getState().todos).toEqual(['first']);
    });

    it('multiple ADD_TODO dispatches preserve append order', async () => {
      const { store, addTodo } = await freshStore();
      store.dispatch(addTodo('a'));
      store.dispatch(addTodo('b'));
      store.dispatch(addTodo('c'));
      expect(store.getState().todos).toEqual(['a', 'b', 'c']);
    });

    it('duplicate todo text is allowed', async () => {
      const { store, addTodo } = await freshStore();
      store.dispatch(addTodo('dup'));
      store.dispatch(addTodo('dup'));
      expect(store.getState().todos).toEqual(['dup', 'dup']);
    });

    it('unknown action types return the exact same array reference (no mutation, no copy)', async () => {
      const { store, addTodo } = await freshStore();
      store.dispatch(addTodo('keep'));
      const before = store.getState().todos;
      store.dispatch({ type: 'NOT_A_REAL_ACTION' });
      expect(store.getState().todos).toBe(before);
    });

    it('ADD_TODO returns a new array identity, leaving prior state untouched (no mutation)', async () => {
      const { store, addTodo } = await freshStore();
      const before = store.getState().todos;
      store.dispatch(addTodo('new'));
      const after = store.getState().todos;
      expect(after).not.toBe(before);
      expect(before).toEqual([]);
    });

    it('INCREMENT/DECREMENT do not affect the todos slice', async () => {
      const { store, addTodo, increment, decrement } = await freshStore();
      store.dispatch(addTodo('x'));
      store.dispatch(increment());
      store.dispatch(decrement());
      expect(store.getState().todos).toEqual(['x']);
    });
  });
});

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addTodo } from './store';

export default function TodoList() {
  const [text, setText] = useState('');
  const todos = useSelector(state => state.todos);
  const dispatch = useDispatch();

  const handleChange = ev => {
    setText(ev.target.value);
  };

  const handleSubmit = ev => {
    ev.preventDefault();
    // Deliberately no .trim(): the legacy guard blocks only the empty string,
    // so whitespace-only todos are added (pinned by characterization tests).
    if (!text) {
      return;
    }
    // Keep the legacy order: dispatch first, then clear the input.
    dispatch(addTodo(text));
    setText('');
  };

  return (
    <div className="todo-list">
      <form onSubmit={handleSubmit}>
        <input value={text} onChange={handleChange} />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo, i) => (
          <li key={i}>{todo}</li>
        ))}
      </ul>
    </div>
  );
}

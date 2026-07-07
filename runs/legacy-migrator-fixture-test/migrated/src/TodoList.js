import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addTodo } from './store';

const TodoList = () => {
  const [text, setText] = useState('');
  const todos = useSelector(state => state.todos);
  const dispatch = useDispatch();

  const handleChange = ev => {
    setText(ev.target.value);
  };

  const handleSubmit = ev => {
    ev.preventDefault();
    // Deliberately NOT trimmed: only '' is blocked; whitespace-only and "0" submit
    // (pinned by characterization tests — preserve exactly).
    if (!text) {
      return;
    }
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
};

export default TodoList;

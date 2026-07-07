import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { increment, decrement } from './store';

export default function Counter() {
  const count = useSelector(state => state.counter);
  const dispatch = useDispatch();
  return (
    <div className="counter">
      <button onClick={() => dispatch(decrement())}>-</button>
      <span>{count}</span>
      <button onClick={() => dispatch(increment())}>+</button>
    </div>
  );
}

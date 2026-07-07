import { applyMiddleware, createStore } from 'redux';
import { createLogger } from 'redux-logger'
import { composeWithDevTools } from '@redux-devtools/extension';
import { promiseMiddleware, localStorageMiddleware } from './middleware';
import reducer from './reducer';

import { createBrowserHistory } from 'history';

export const history = createBrowserHistory();

const getMiddleware = () => {
  if (import.meta.env.PROD) {
    return applyMiddleware(promiseMiddleware, localStorageMiddleware);
  } else {
    // Enable additional logging in non-production environments.
    return applyMiddleware(promiseMiddleware, localStorageMiddleware, createLogger())
  }
};

export const store = createStore(
  reducer, composeWithDevTools(getMiddleware()));

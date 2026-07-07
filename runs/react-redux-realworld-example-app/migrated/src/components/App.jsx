import agent from '../agent';
import Header from './Header';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { APP_LOAD, REDIRECT } from '../constants/actionTypes';
import { Route, Switch } from 'react-router-dom';
import Article from '../components/Article';
import Editor from '../components/Editor';
import Home from '../components/Home';
import Login from '../components/Login';
import Profile from '../components/Profile';
import ProfileFavorites from '../components/ProfileFavorites';
import Register from '../components/Register';
import Settings from '../components/Settings';
import { history } from '../store';

const App = () => {
  const appLoaded = useSelector(state => state.common.appLoaded);
  const appName = useSelector(state => state.common.appName);
  const currentUser = useSelector(state => state.common.currentUser);
  const redirectTo = useSelector(state => state.common.redirectTo);
  const dispatch = useDispatch();

  // auth bootstrap, once — replaces componentWillMount
  useEffect(() => {
    const token = window.localStorage.getItem('jwt');
    if (token) {
      agent.setToken(token);
    }

    dispatch({
      type: APP_LOAD,
      payload: token ? agent.Auth.current() : null,
      token,
      skipTracking: true
    });
  }, [dispatch]);

  // redirect watcher — replaces componentWillReceiveProps
  useEffect(() => {
    if (redirectTo) {
      history.push(redirectTo);
      dispatch({ type: REDIRECT });
    }
  }, [redirectTo, dispatch]);

  if (appLoaded) {
    return (
      <div>
        <Header
          appName={appName}
          currentUser={currentUser} />
          <Switch>
          <Route exact path="/" component={Home}/>
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/editor/:slug" component={Editor} />
          <Route path="/editor" component={Editor} />
          <Route path="/article/:id" component={Article} />
          <Route path="/settings" component={Settings} />
          <Route path="/@:username/favorites" component={ProfileFavorites} />
          <Route path="/@:username" component={Profile} />
          </Switch>
      </div>
    );
  }
  return (
    <div>
      <Header
        appName={appName}
        currentUser={currentUser} />
    </div>
  );
};

export default App;

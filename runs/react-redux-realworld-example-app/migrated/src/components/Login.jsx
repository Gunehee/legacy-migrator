import { Link } from 'react-router-dom';
import ListErrors from './ListErrors';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import agent from '../agent';
import {
  UPDATE_FIELD_AUTH,
  LOGIN,
  LOGIN_PAGE_UNLOADED
} from '../constants/actionTypes';

const Login = () => {
  const { email, password, inProgress, errors } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  const changeEmail = ev =>
    dispatch({ type: UPDATE_FIELD_AUTH, key: 'email', value: ev.target.value });
  const changePassword = ev =>
    dispatch({ type: UPDATE_FIELD_AUTH, key: 'password', value: ev.target.value });
  const submitForm = (email, password) => ev => {
    ev.preventDefault();
    dispatch({ type: LOGIN, payload: agent.Auth.login(email, password) });
  };

  useEffect(() => {
    return () => {
      dispatch({ type: LOGIN_PAGE_UNLOADED });
    };
  }, [dispatch]);

  return (
    <div className="auth-page">
      <div className="container page">
        <div className="row">

          <div className="col-md-6 offset-md-3 col-xs-12">
            <h1 className="text-xs-center">Sign In</h1>
            <p className="text-xs-center">
              <Link to="/register">
                Need an account?
              </Link>
            </p>

            <ListErrors errors={errors} />

            <form onSubmit={submitForm(email, password)}>
              <fieldset>

                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={changeEmail} />
                </fieldset>

                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={changePassword} />
                </fieldset>

                <button
                  className="btn btn-lg btn-primary pull-xs-right"
                  type="submit"
                  disabled={inProgress}>
                  Sign in
                </button>

              </fieldset>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;

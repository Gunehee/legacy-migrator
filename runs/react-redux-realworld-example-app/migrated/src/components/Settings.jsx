import ListErrors from './ListErrors';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import agent from '../agent';
import {
  SETTINGS_SAVED,
  LOGOUT
} from '../constants/actionTypes';

const emptyForm = {
  image: '',
  username: '',
  bio: '',
  email: '',
  password: ''
};

const fromUser = currentUser => ({
  image: currentUser.image || '',
  username: currentUser.username,
  bio: currentUser.bio,
  email: currentUser.email
});

const SettingsForm = ({ currentUser, onSubmitForm }) => {
  // initialize from currentUser like the original's componentWillMount did
  const [form, setForm] = useState(() =>
    currentUser ? { ...emptyForm, ...fromUser(currentUser) } : emptyForm
  );

  // re-sync when the saved user comes back, like componentWillReceiveProps did
  useEffect(() => {
    if (currentUser) {
      setForm(prev => ({ ...prev, ...fromUser(currentUser) }));
    }
  }, [currentUser]);

  const updateState = field => ev => {
    // capture eagerly: the updater runs after React restores the controlled
    // input, so reading ev.target.value inside it would see the old value
    const value = ev.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const submitForm = ev => {
    ev.preventDefault();

    const user = Object.assign({}, form);
    if (!user.password) {
      delete user.password;
    }

    onSubmitForm(user);
  };

  return (
    <form onSubmit={submitForm}>
      <fieldset>

        <fieldset className="form-group">
          <input
            className="form-control"
            type="text"
            placeholder="URL of profile picture"
            value={form.image}
            onChange={updateState('image')} />
        </fieldset>

        <fieldset className="form-group">
          <input
            className="form-control form-control-lg"
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={updateState('username')} />
        </fieldset>

        <fieldset className="form-group">
          <textarea
            className="form-control form-control-lg"
            rows="8"
            placeholder="Short bio about you"
            value={form.bio}
            onChange={updateState('bio')}>
          </textarea>
        </fieldset>

        <fieldset className="form-group">
          <input
            className="form-control form-control-lg"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={updateState('email')} />
        </fieldset>

        <fieldset className="form-group">
          <input
            className="form-control form-control-lg"
            type="password"
            placeholder="New Password"
            value={form.password}
            onChange={updateState('password')} />
        </fieldset>

        <button
          className="btn btn-lg btn-primary pull-xs-right"
          type="submit"
          disabled={form.inProgress}>
          Update Settings
        </button>

      </fieldset>
    </form>
  );
};

const Settings = () => {
  const errors = useSelector(state => state.settings.errors);
  const currentUser = useSelector(state => state.common.currentUser);
  const dispatch = useDispatch();

  const onClickLogout = () => dispatch({ type: LOGOUT });
  const onSubmitForm = user =>
    dispatch({ type: SETTINGS_SAVED, payload: agent.Auth.save(user) });
  // NOTE: faithful to the original, no SETTINGS_PAGE_UNLOADED is ever
  // dispatched — the class version mapped onUnload but never called it.

  return (
    <div className="settings-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-6 offset-md-3 col-xs-12">

            <h1 className="text-xs-center">Your Settings</h1>

            <ListErrors errors={errors}></ListErrors>

            <SettingsForm
              currentUser={currentUser}
              onSubmitForm={onSubmitForm} />

            <hr />

            <button
              className="btn btn-outline-danger"
              onClick={onClickLogout}>
              Or click here to logout.
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

import React from 'react';
import agent from '../agent';
import { ProfileView } from './Profile';

const favoritesLoader = username => ({
  pager: page => agent.Articles.favoritedBy(username, page),
  payload: Promise.all([
    agent.Profile.get(username),
    agent.Articles.favoritedBy(username)
  ])
});

const ProfileFavorites = () => (
  <ProfileView activeTab="favorites" buildLoader={favoritesLoader} />
);

export default ProfileFavorites;

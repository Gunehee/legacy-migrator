import ArticleList from './ArticleList';
import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import agent from '../agent';
import { useDispatch, useSelector } from 'react-redux';
import {
  FOLLOW_USER,
  UNFOLLOW_USER,
  PROFILE_PAGE_LOADED,
  PROFILE_PAGE_UNLOADED
} from '../constants/actionTypes';

const EditProfileSettings = ({ isUser }) => {
  if (isUser) {
    return (
      <Link
        to="/settings"
        className="btn btn-sm btn-outline-secondary action-btn">
        <i className="ion-gear-a"></i> Edit Profile Settings
      </Link>
    );
  }
  return null;
};

const FollowUserButton = ({ isUser, user, follow, unfollow }) => {
  if (isUser) {
    return null;
  }

  let classes = 'btn btn-sm action-btn';
  if (user.following) {
    classes += ' btn-secondary';
  } else {
    classes += ' btn-outline-secondary';
  }

  const handleClick = ev => {
    ev.preventDefault();
    if (user.following) {
      unfollow(user.username)
    } else {
      follow(user.username)
    }
  };

  return (
    <button
      className={classes}
      onClick={handleClick}>
      <i className="ion-plus-round"></i>
      &nbsp;
      {user.following ? 'Unfollow' : 'Follow'} {user.username}
    </button>
  );
};

const ProfileTabs = ({ username, activeTab }) => (
  <ul className="nav nav-pills outline-active">
    <li className="nav-item">
      <Link
        className={activeTab === 'articles' ? 'nav-link active' : 'nav-link'}
        to={`/@${username}`}>
        My Articles
      </Link>
    </li>

    <li className="nav-item">
      <Link
        className={activeTab === 'favorites' ? 'nav-link active' : 'nav-link'}
        to={`/@${username}/favorites`}>
        Favorited Articles
      </Link>
    </li>
  </ul>
);

/**
 * Shared page body for /@:username and /@:username/favorites — replaces the
 * original's `ProfileFavorites extends Profile` class inheritance.
 * `buildLoader(username)` returns the { pager, payload } for PROFILE_PAGE_LOADED.
 */
export const ProfileView = ({ activeTab, buildLoader }) => {
  const { pager, articles, articlesCount, currentPage } = useSelector(state => state.articleList);
  const currentUser = useSelector(state => state.common.currentUser);
  const profile = useSelector(state => state.profile);
  const dispatch = useDispatch();
  const { username } = useParams();

  const onFollow = username => dispatch({
    type: FOLLOW_USER,
    payload: agent.Profile.follow(username)
  });
  const onUnfollow = username => dispatch({
    type: UNFOLLOW_USER,
    payload: agent.Profile.unfollow(username)
  });

  // load once on mount, like componentWillMount did — the original never
  // refetched on param change either (no componentWillReceiveProps)
  useEffect(() => {
    const { pager, payload } = buildLoader(username);
    dispatch({ type: PROFILE_PAGE_LOADED, pager, payload });
    return () => {
      dispatch({ type: PROFILE_PAGE_UNLOADED });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NB: initial state.profile is {} (truthy) — like the original, the empty
  // shell renders before PROFILE_PAGE_LOADED lands
  if (!profile) {
    return null;
  }

  const isUser = currentUser &&
    profile.username === currentUser.username;

  return (
    <div className="profile-page">

      <div className="user-info">
        <div className="container">
          <div className="row">
            <div className="col-xs-12 col-md-10 offset-md-1">

              <img src={profile.image} className="user-img" alt={profile.username} />
              <h4>{profile.username}</h4>
              <p>{profile.bio}</p>

              <EditProfileSettings isUser={isUser} />
              <FollowUserButton
                isUser={isUser}
                user={profile}
                follow={onFollow}
                unfollow={onUnfollow}
                />

            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row">

          <div className="col-xs-12 col-md-10 offset-md-1">

            <div className="articles-toggle">
              <ProfileTabs username={profile.username} activeTab={activeTab} />
            </div>

            <ArticleList
              pager={pager}
              articles={articles}
              articlesCount={articlesCount}
              state={currentPage} />
          </div>

        </div>
      </div>

    </div>
  );
};

const profileLoader = username => ({
  pager: undefined,
  payload: Promise.all([
    agent.Profile.get(username),
    agent.Articles.byAuthor(username)
  ])
});

const Profile = () => (
  <ProfileView activeTab="articles" buildLoader={profileLoader} />
);

export default Profile;

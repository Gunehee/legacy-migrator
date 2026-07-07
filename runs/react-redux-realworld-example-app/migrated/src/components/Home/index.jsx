import Banner from './Banner';
import MainView from './MainView';
import React, { useEffect } from 'react';
import Tags from './Tags';
import agent from '../../agent';
import { useDispatch, useSelector } from 'react-redux';
import {
  HOME_PAGE_LOADED,
  HOME_PAGE_UNLOADED,
  APPLY_TAG_FILTER
} from '../../constants/actionTypes';

const Home = () => {
  const tags = useSelector(state => state.home.tags);
  const appName = useSelector(state => state.common.appName);
  const token = useSelector(state => state.common.token);
  const dispatch = useDispatch();

  const onClickTag = (tag, pager, payload) =>
    dispatch({ type: APPLY_TAG_FILTER, tag, pager, payload });

  // load once on mount, like componentWillMount did — token is read at mount
  // time only; every token transition routes through a redirect that remounts
  // this page.
  useEffect(() => {
    const tab = token ? 'feed' : 'all';
    const articlesPromise = token ?
      agent.Articles.feed :
      agent.Articles.all;

    dispatch({
      type: HOME_PAGE_LOADED,
      tab,
      pager: articlesPromise,
      payload: Promise.all([agent.Tags.getAll(), articlesPromise()])
    });
    return () => {
      dispatch({ type: HOME_PAGE_UNLOADED });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="home-page">

      <Banner token={token} appName={appName} />

      <div className="container page">
        <div className="row">
          <MainView />

          <div className="col-md-3">
            <div className="sidebar">

              <p>Popular Tags</p>

              <Tags
                tags={tags}
                onClickTag={onClickTag} />

            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Home;

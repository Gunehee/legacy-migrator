import ArticleMeta from './ArticleMeta';
import CommentContainer from './CommentContainer';
import React, { useEffect } from 'react';
import agent from '../../agent';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import marked from 'marked';
import { ARTICLE_PAGE_LOADED, ARTICLE_PAGE_UNLOADED } from '../../constants/actionTypes';

const Article = () => {
  const { article, comments, commentErrors } = useSelector(state => state.article);
  const currentUser = useSelector(state => state.common.currentUser);
  const dispatch = useDispatch();
  const { id } = useParams();

  useEffect(() => {
    dispatch({
      type: ARTICLE_PAGE_LOADED,
      payload: Promise.all([
        agent.Articles.get(id),
        agent.Comments.forArticle(id)
      ])
    });
    return () => {
      dispatch({ type: ARTICLE_PAGE_UNLOADED });
    };
  }, [dispatch, id]);

  if (!article) {
    return null;
  }

  const markup = { __html: marked(article.body, { sanitize: true }) };
  const canModify = currentUser &&
    currentUser.username === article.author.username;
  return (
    <div className="article-page">

      <div className="banner">
        <div className="container">

          <h1>{article.title}</h1>
          <ArticleMeta
            article={article}
            canModify={canModify} />

        </div>
      </div>

      <div className="container page">

        <div className="row article-content">
          <div className="col-xs-12">

            <div dangerouslySetInnerHTML={markup}></div>

            <ul className="tag-list">
              {
                article.tagList.map(tag => {
                  return (
                    <li
                      className="tag-default tag-pill tag-outline"
                      key={tag}>
                      {tag}
                    </li>
                  );
                })
              }
            </ul>

          </div>
        </div>

        <hr />

        <div className="article-actions">
        </div>

        <div className="row">
          <CommentContainer
            comments={comments || []}
            errors={commentErrors}
            slug={id}
            currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
};

export default Article;

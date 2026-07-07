import ListErrors from './ListErrors';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import agent from '../agent';
import {
  ADD_TAG,
  EDITOR_PAGE_LOADED,
  REMOVE_TAG,
  ARTICLE_SUBMITTED,
  EDITOR_PAGE_UNLOADED,
  UPDATE_FIELD_EDITOR
} from '../constants/actionTypes';

const Editor = () => {
  const { articleSlug, title, description, body, tagInput, tagList, inProgress, errors } =
    useSelector(state => state.editor);
  const dispatch = useDispatch();
  const { slug } = useParams();

  useEffect(() => {
    dispatch({
      type: EDITOR_PAGE_LOADED,
      payload: slug ? agent.Articles.get(slug) : null
    });
    return () => {
      dispatch({ type: EDITOR_PAGE_UNLOADED });
    };
  }, [dispatch, slug]);

  const updateFieldEvent = key => ev =>
    dispatch({ type: UPDATE_FIELD_EDITOR, key, value: ev.target.value });
  const changeTitle = updateFieldEvent('title');
  const changeDescription = updateFieldEvent('description');
  const changeBody = updateFieldEvent('body');
  const changeTagInput = updateFieldEvent('tagInput');

  const watchForEnter = ev => {
    if (ev.keyCode === 13) {
      ev.preventDefault();
      dispatch({ type: ADD_TAG });
    }
  };

  const removeTagHandler = tag => () => {
    dispatch({ type: REMOVE_TAG, tag });
  };

  const submitForm = ev => {
    ev.preventDefault();
    const article = {
      title,
      description,
      body,
      tagList
    };

    const promise = articleSlug ?
      agent.Articles.update(Object.assign(article, { slug: articleSlug })) :
      agent.Articles.create(article);

    dispatch({ type: ARTICLE_SUBMITTED, payload: promise });
  };

  return (
    <div className="editor-page">
      <div className="container page">
        <div className="row">
          <div className="col-md-10 offset-md-1 col-xs-12">

            <ListErrors errors={errors}></ListErrors>

            <form>
              <fieldset>

                <fieldset className="form-group">
                  <input
                    className="form-control form-control-lg"
                    type="text"
                    placeholder="Article Title"
                    value={title}
                    onChange={changeTitle} />
                </fieldset>

                <fieldset className="form-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="What's this article about?"
                    value={description}
                    onChange={changeDescription} />
                </fieldset>

                <fieldset className="form-group">
                  <textarea
                    className="form-control"
                    rows="8"
                    placeholder="Write your article (in markdown)"
                    value={body}
                    onChange={changeBody}>
                  </textarea>
                </fieldset>

                <fieldset className="form-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter tags"
                    value={tagInput}
                    onChange={changeTagInput}
                    onKeyUp={watchForEnter} />

                  <div className="tag-list">
                    {
                      (tagList || []).map(tag => {
                        return (
                          <span className="tag-default tag-pill" key={tag}>
                            <i  className="ion-close-round"
                                onClick={removeTagHandler(tag)}>
                            </i>
                            {tag}
                          </span>
                        );
                      })
                    }
                  </div>
                </fieldset>

                <button
                  className="btn btn-lg pull-xs-right btn-primary"
                  type="button"
                  disabled={inProgress}
                  onClick={submitForm}>
                  Publish Article
                </button>

              </fieldset>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;

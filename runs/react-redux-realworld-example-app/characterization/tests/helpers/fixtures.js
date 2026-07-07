/** RealWorld API fixtures shared by all flow tests. */

export const user = {
  email: 'jo@example.com',
  token: 'jwt.token.here',
  username: 'jo',
  bio: 'tester',
  image: 'https://example.com/jo.png',
};

export const author = {
  username: 'anna',
  bio: 'writer',
  image: 'https://example.com/anna.png',
  following: false,
};

export const makeArticle = (over = {}) => ({
  slug: 'how-to-test-1',
  title: 'How to test',
  description: 'About testing',
  body: 'Plain **markdown** body',
  tagList: ['testing', 'react'],
  createdAt: '2021-03-04T12:00:00.000Z',
  updatedAt: '2021-03-04T12:00:00.000Z',
  favorited: false,
  favoritesCount: 3,
  author,
  ...over,
});

export const makeComment = (over = {}) => ({
  id: 7,
  body: 'Nice article!',
  createdAt: '2021-03-05T09:00:00.000Z',
  author,
  ...over,
});

export const tags = ['testing', 'react', 'redux'];

export const articlesList = (articles) => ({ articles, articlesCount: articles.length });

const { AuthenticationError, gql, ForbiddenError } = require('apollo-server')
const { userModel, postModel } = require('./../models/index.js')

const typeDefs = gql`
  type Post {
    id: ID!
    author: User
    title: String
    body: String
    likeGivers: [User]
    createdAt: String
  }

  extend type Query {
    "取得所有貼文"
    posts: [Post]
    "依照 id 取得特定貼文"
    post(id: ID!): Post
  }

  input AddPostInput {
    title: String,
    body: String
  }

  extend type Mutation {
    "新增貼文"
    addPost(input: AddPostInput): Post,
    "喜歡貼文"
    likePost(postId: ID!): Post
    "刪除貼文"
    deletePost(postId: ID!): Post
  }
`

// 有無認證
const isAuthenticated = resolverFunc => (parent, args, context) => {
  if (!context.me) throw new ForbiddenError('Not logged in.');
  return resolverFunc.apply(null, [parent, args, context]);
};

// 貼文擁有者是否為本人
const isPostAuthor = resolverFunc => (parent, args, context) => {
  const { postId } = args;
  const { me, postModel } = context;
  const isAuthor = postModel.findPostByPostId(Number(postId)).authorId === me.id;
  if (!isAuthor) {
    throw new ForbiddenError('Only Author Can Delete this Post');
  }
  return resolverFunc.applyFunc(parent, args, context);
}

// -- resolver --
const resolvers = {
  Query: {
    posts: () => posts,
    post: (root, { id }, { postModel }) => postModel.userModelfindPostByPostId(id)
  },
  // -- mutation
  Mutation: {
    addPost: isAuthenticated((parent, { input }, { me, postModel }) => {
      if (!me) throw new Error ('Plz Log In First');
      const { title, body } = input;
      return postModel.addPost({ authorId: me.id, title, body });
    }),
    likePost: isAuthenticated((parent, { postId }, { me, postModel }) => {
      if (!me) throw new Error ('Plz Log In First');
      const post = postModel.findPostByPostId(postId);

      if (!post) throw new Error(`Post ${postId} Not Exists`);

      if (!post.likeGiverIds.includes(me.id)) {
        return postModel.updatePost(postId, {
          likeGiverIds: post.likeGiverIds.concat(me.id)
        });
      }

      return postModel.updatePost(postId, {
        likeGiverIds: post.likeGiverIds.filter(id => id === me.id)
      });
    }),
    deletePost: isAuthenticated(
      isPostAuthor((root, { postId }, { me, postModel }) => postModel.deletePost(postId))
    ),
  },
  // --
  Post: {
    author: (parent, args, { userModel }) => userModel.findUserByUserId(parent.authorId),
    likeGivers: (parent, args, { userModel }) => userModel.filterUsersByUserIds(parent.likeGiverIds)
  }
};


module.exports = {
  typeDefs,
  resolvers
};
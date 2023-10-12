const { ApolloServer, gql } = require('apollo-server');

// 假資料
const users = [
  { id: 1, name: 'Fong', age: 23, friendIds: [2, 3] },
  { id: 2, name: 'Kevin', age: 40, friendIds: [1] },
  { id: 3, name: 'Mary', age: 18, friendIds: [1] }
];
const posts = [
  { id: 1, authorId: 1, title: "Hello World!", content: "This is my first post.", likeGiverIds: [2] },
  { id: 2, authorId: 2, title: "Good Night", content: "Have a Nice Dream =)", likeGiverIds: [2, 3] },
  { id: 3, authorId: 1, title: "I Love U", content: "Here's my second post!", likeGiverIds: [] },
];

// -- schema
const typeDefs = gql`
  """
  使用者資訊
  """
  type User {
    "識別碼"
    id: ID
    "名字"
    name: String
    "年齡"
    age: Int
    "朋友們"
    friends: [User]
    "貼文"
    posts: [Post]
  }

  """
  貼文
  """
  type Post {
    "識別碼"
    id: ID!
    "作者"
    author: User
    "標題"
    title: String
    "內容"
    content: String
    "按讚者"
    likeGivers: [User]
  }

  type Query {
    "取得當下使用者"
    me: User
    "取得所有使用者"
    users: [User]
    "取得特定 user (name 為必填)"
    selectedUser(name: String!): User
    "取得所有貼文"
    posts: [Post]
  }

  # mutation ----------------------------------
  # 寫法一
  # type Mutation {
    #   "新增貼文"
    # addPost(title: String!, content: String!): Post
    # "貼文按讚 (收回讚)"
    # likePost(postId: ID!): Post
    # }
  # 寫法二：使用 Input Object Type
  input AddPostInput {
    title: String!
    content: String!
  }
  
  type Mutation {
    addPost(input: AddPostInput!): Post
    likePost(postId: ID!): Post
  }
  # -------------------------------------------
`;

// -- Resolver
// Helper Functions
const findUserById = id => users.find(user => user.id === id);
const findUserByName = name => users.find(user => user.name === name);
const filterPostsByAuthorId = authorId => posts.filter(post => post.authorId === authorId);
const meId = 1;  // 假定 meId 來代表目前使用者的 id
const findPostById = id => posts.find(post => post.id === id);

// 1. 新增 User.posts field Resovler
// 2. 新增 Post Type Resolver 及底下的 field Resolver
const resolvers = {
  Query: {
    me: () => users[0],
    users: () => users,
    selectedUser: (root, args, context) => {
      const { name } = args;
      return users.find(user => user.name === name);
    },
    posts: () => posts
  },
  // Mutation Type Resolver
  Mutation : {
    addPost: (root, args, context) => {
      // 寫法一
      // const { title, content } = args;
      // 寫法二：使用 Input Object Type
      const { input } = args;
      const { title, content } = input;
      // 新增 post
      posts.push({
        id: posts.length + 1,
        authorId: meId,
        title,
        content,
        likeGivers: []
      });
      // 回傳新增的那篇 post
      return posts[posts.length - 1];
    },
    likePost: (root, args, context) => {
      const { postId } = args;
      const post = findPostById(postId);
      if (!post) throw new Error(`Post ${psotId} Not Exists`);

      if (post.likeGiverIds.includes(meId)) {
        // 如果已經按過讚就收回
        const index = post.likeGiverIds.findIndex(v => v === userId);
        post.likeGiverIds.splice(index, 1);
      } else {
        // 否則就加入 likeGiverIds 名單
        post.likeGiverIds.push(meId);
      }
      return post;
    },
  },
  User: {
    friends: (parent, args, context) => {
      const { friendIds } = parent;
      return users.filter(user => friendIds.includes(user.id));
    },
    // 1. User.parent field resolver, 回傳屬於該 user 的 posts
    posts: (parent, args, context) => {
      // parent.id 為 userId
      return filterPostsByAuthorId(parent.id);
    }
  },
  // 2. Post type resolver
  Post: {
    // 2-1. parent 為 post 的資料，透過 post.likeGiverIds 連接到 users
    likeGivers: (parent, args, context) => {
      return parent.likeGiverIds.map(id => findUserById(id));
    },
    // 2-2. parent 為 post 的資料，透過 post.author
    author: (parent, args, context) => {
      return findUserById(parent.authorId);
    }
  }
};


const server = new ApolloServer({
  typeDefs,
  resolvers
});

server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
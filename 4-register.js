const { ApolloServer, gql } = require('apollo-server');

// fake data
const meId = 2;
const users = [
  {
    id: 1,
    email: 'fong@test.com',
    password: '$2b$04$wcwaquqi5ea1Ho0aKwkZ0e51/RUkg6SGxaumo8fxzILDmcrv4OBIO', // 123456
    name: 'Fong',
    age: 23,
    friendIds: [2, 3]
  },
  {
    id: 2,
    email: 'kevin@test.com',
    passwrod: '$2b$04$uy73IdY9HVZrIENuLwZ3k./0azDvlChLyY1ht/73N4YfEZntgChbe', // 123456
    name: 'Kevin',
    age: 40,
    friendIds: [1]
  },
  {
    id: 3,
    email: 'mary@test.com',
    password: '$2b$04$UmERaT7uP4hRqmlheiRHbOwGEhskNw05GHYucU73JRf8LgWaqWpTy', // 123456
    name: 'Mary',
    age: 18,
    friendIds: [1]
  }
];

const posts = [
  {
    id: 1,
    authorId: 1,
    title: 'Hello World',
    body: 'This is my first post',
    likeGiverIds: [1, 2],
    createdAt: '2018-10-22T01:40:14.941Z'
  },
  {
    id: 2,
    authorId: 2,
    title: 'Nice Day',
    body: 'Hello My Friend!',
    likeGiverIds: [1],
    createdAt: '2018-10-24T01:40:14.941Z'
  }
];

// -- 加密流程
// 套件
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 定義 bcrypt 加密所需 saltRounds 次數
const SALT_ROUNDS = 2;
// 定義 jwt 所需 secret (可隨便打)
const SECRET = 'just_a_random_secret';


// -- helper functions
const filterPostsByUserId = userId => posts.filter(post => userId === post.authorId);
const filterUsersByUserIds = userIds => users.filter(user => userIds.includes(user.id));
const findUserByUserId = userId => users.find(user => user.id === Number(userId));

const findUserByName = name => users.find(user => user.name === name);
const findPostByPostId = postId => posts.find(post => post.id === Number(postId));

const updateUserInfo = (userId, data) => Object.assign(findUserByUserId(userId), data);
const updatePost = (postId, data) => Object.assign(findPostByPostId(postId), data);
const addPost = ({ authorId, title, body }) =>
  (posts[posts.length] = {
    id: posts[posts.length - 1].id + 1,
    authorId,
    title,
    body,
    likeGiverIds: [],
    createdAt: new Date().toISOString()
  });

// 加密 & 新增使用者
const hash = text => bcrypt.hash(text, SALT_ROUNDS);
const addUser = ({ name, email, password }) => (
  users[users.length] = {
    id: users[users.length - 1].id + 1,
    name,
    email,
    password
  }
);


// -- schema
const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String
    age: Int
    friends: [User]
    posts: [Post]
  }
  type Post {
    id: ID!
    author: User
    title: String
    body: String
    likeGivers: [User]
    createdAt: String
  }
  type Token {
    token: String!
  }

  type Query {
    "取得目前使用者"
    me: User
    "取得所有使用者"
    users: [User]
    "依照名字取得特定使用者"
    user(name: String!): User
    "取得所有貼文"
    posts: [Post]
    "依照 id 取得特定貼文"
    post(id: ID!): Post
  }

  input UpdateMyInfoInput {
    name: String,
    age: Int
  }

  input AddPostInput {
    title: String,
    body: String
  }

  # --- mutation
  type Mutation {
    "註冊 (email 與 passwrod 必填)"
    signUp(name: String, email: String!, password: String!): User
    "修改個人資料"
    updateMyInfo(input: UpdateMyInfoInput): User,
    "加好友"
    addFriend(userId: ID!): User,
    "新增貼文"
    addPost(input: AddPostInput): Post,
    "喜歡貼文"
    likePost(postId: ID!): Post
  }
`

// -- Resolver
const resolvers = {
  Query: {
    me: () => findUserByUserId(meId),
    users: () => users,
    user: (root, { name }, context) => findUserByName(name),
    posts: () => posts,
    post: (root, { id }, context) => findPostByPostId(id)
  },
  // -- mutation
  Mutation: {
    // ------- 註冊 -------
    signUp: async (root, { name, email, password }, context) => {
      // 1. 檢查不能有重複註冊 email
      const isUserEmailDuplicate = users.some(user => user.email === email);
      if (isUserEmailDuplicate) throw new Error('User Email Duplicate');
      // 2. 將 passwrod 加密再存進去
      const hashedPassword = await hash(password, SALT_ROUNDS);
      // 3. 建立新 user
      return addUser({ name, email, password: hashedPassword });
    },
    updateMyInfo: (parent, { input }, context) => {
      // 過濾空值
      const data = ["name", "age"].reduce(
        (obj, key) => (input[key] ? { ...obj, [key]: input[key] } : obj),
        {}
      );
      return updateUserInfo(meId, data);
    },
    addFriend: (parent, { userId }, context) => {
      const me = findUserByUserId(meId);
      if (me.friendIds.include(userId))
        throw new Error(`User ${userId} Already Friend.`);

      const friend = findUserByUserId(userId);
      const newMe = updateUserInfo(meId, {
        friendIds: me.friendIds.concat(userId)
      });
      updateUserInfo(userId, { friendIds: friend.friendIds.concat(meId) });

      return newMe;
    },
    addPost: (parent, { input }, context) => {
      const { title, body } = input;
      return addPost({ authorId: meId, title, body });
    },
    likePost: (parent, { postId }, context) => {
      const post = findPostByPostId(postId);

      if (!post) throw new Error(`Post ${postId} Not Exists`);

      if (!post.likeGiverIds.includes(meId)) {
        return updatePost(postId, {
          likeGiverIds: post.likeGiverIds.concat(meId)
        });
      }

      return updatePost(postId, {
        likeGiverIds: post.likeGiverIds.filter(id => id === meId)
      });
    }
  },
  // --
  User: {
    posts: (parent, args, context) => filterPostsByUserId(parent.id),
    friends: (parent, args, context) => filterUsersByUserIds(parent.friendIds || [])
  },
  Post: {
    author: (parent, args, context) => findUserByUserId(parent.authorId),
    likeGivers: (parent, args, context) => filterUsersByUserIds(parent.likeGiverIds)
  }
};


// ---------- mutation 操作語法 -----------
const language = `
mutation ($updateMeInput: UpdateMyInfoInput!, $addPostInput: AddPostInput!) {
  updateMyInfo (input: $updateMeInput) {
    name
    age
  }
  addPost (input: $addPostInput) {
    id
    title
    body
  }
  likePost (postId: 3) {
    id
    title
    body
    author {
      name
    }
    likeGivers {
      id
      name
      age
    }
  }
}

&
Varaibles

{
  "updateMeInput": {
    "name": "FX",
    "age": 24
  },
  "addPostInput": {
    "title": "Hello World2",
    "body": "testttttinggggg"
  }
}

`
// ---------------------





const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
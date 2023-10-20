// 取得 ForbiddenError 作為錯誤訊息
const { ApolloServer, gql, ForbiddenError } = require('apollo-server')
// 引入.env
require('dotenv').config()

// fake data
// const meId = 2;
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
    password: '$2b$04$uy73IdY9HVZrIENuLwZ3k./0azDvlChLyY1ht/73N4YfEZntgChbe', // 123456
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
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
// 定義 jwt 所需 secret (可隨便打)
const SECRET = process.env.SECRET;


// -- 有無認證
const isAuthenticated = resolverFunc => (parent, args, context) => {
  if (!context.me) throw new ForbiddenError('Not logged in.');
  return resolverFunc.apply(null, [parent, args, context]);
};


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

// 刪除貼文＆只有貼文作者本人才能刪除
const deletePost = (postId) => posts.splice(posts.findIndex(post => post.id === postId), 1)[0];
const isPostAuthor = resolverFunc => (parent, args, context) => {
  const { postId } = args;
  const { me } = context;
  const isAuthor = findPostByPostId(postId).authorId === me.id;
  if (!isAuthor) throw new ForbiddenError('Only Author Can Delete this Post');
  return resolverFunc.applyFunc(parent, args, context);
}

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
// 登入後產生 token，expiresIn: '1d' 表示一天後過期
const createToken = ({ id, email, name }) => 
  jwt.sign({ id, email, name }, SECRET, { expiresIn: '1d' });


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
    "登入"
    login (email: String!, password: String!): Token
    "修改個人資料"
    updateMyInfo(input: UpdateMyInfoInput): User,
    "加好友"
    addFriend(userId: ID!): User,
    "新增貼文"
    addPost(input: AddPostInput): Post,
    "喜歡貼文"
    likePost(postId: ID!): Post
    "刪除貼文"
    deletePost(postId: ID!): Post
  }
`

// -- Resolver
const resolvers = {
  Query: {
    // 更新 me
    // me: (root, args, { me }) => {
    //   if (!me) throw new Error ('Please Log In First');
    //   return findUserByUserId(me.id)
    // },
    me: isAuthenticated((parent, args, { me }) => findUserByUserId(me.id)),
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
    // ------- 登入 -------
    login: async (root, { email, password }, context) => {
      // 1. 透過 email 找到相對應的 user
      const user = users.find(user => user.email === email);
      if (!user) throw new Error('Email Account Not Exists');

      // 2. 將傳進來的 password 與資料庫存的 user.password 做比對
      const passwordIsValid = await bcrypt.compare(password, user.password);
      if (!passwordIsValid) throw new Error('Wrong Password');

      // 3. 成功則回傳 token
      return { token: await createToken(user) };
    },
    updateMyInfo: isAuthenticated((parent, { input }, { me }) => {
      // 過濾空值
      const data = ["name", "age"].reduce(
        (obj, key) => (input[key] ? { ...obj, [key]: input[key] } : obj),
        {}
      );
      return updateUserInfo(me.id, data);
    }),
    addFriend: isAuthenticated((parent, { userId }, { me: { id: meId } }) => {
      if (!me) throw new Error ('Plz Log In First');
      const me = findUserByUserId(meId);
      if (me.friendIds.include(userId))
        throw new Error(`User ${userId} Already Friend.`);

      const friend = findUserByUserId(userId);
      const newMe = updateUserInfo(meId, {
        friendIds: me.friendIds.concat(userId)
      });
      updateUserInfo(userId, { friendIds: friend.friendIds.concat(meId) });

      return newMe;
    }),
    addPost: isAuthenticated((parent, { input }, { me }) => {
      if (!me) throw new Error ('Plz Log In First');
      const { title, body } = input;
      return addPost({ authorId: me.id, title, body });
    }),
    likePost: isAuthenticated((parent, { postId }, { me }) => {
      if (!me) throw new Error ('Plz Log In First');
      const post = findPostByPostId(postId);

      if (!post) throw new Error(`Post ${postId} Not Exists`);

      if (!post.likeGiverIds.includes(me.id)) {
        return updatePost(postId, {
          likeGiverIds: post.likeGiverIds.concat(me.id)
        });
      }

      return updatePost(postId, {
        likeGiverIds: post.likeGiverIds.filter(id => id === me.id)
      });
    }),
    deletePost: isAuthenticated(
      isPostAuthor((root, { postId }, { me }) => deletePost(postId))
    ),
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
mutation ($updateMeInput: UpdateMyInfoInput!, $addPostInput:AddPostInput!) {
  updateMyInfo(input: $updateMeInput) {
    id
    name
    age
  }
  addPost(input: $addPostInput) {
    id
    title
    body
    author {
      name
    }
    createdAt
  }
  likePost(postId: 1) {
    id
  }
}

&
Varaibles

{
  "updateMeInput": {
    "name": "NewTestMan",
    "age": 28
  },
  "addPostInput": {
    "title": "best song",
    "body": "100 ways to live"
  }
}

&
Headers
  "x-token" :
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwibmFtZSI6IlRlc3RNYW4iLCJpYXQiOjE1NDA1MzgzMjksImV4cCI6MTU0MDYyNDcyOX0.ElEoRylTjjB_ACZnayABYlRDGvQSx_yQT4D7XixegFg"
`
// ---------------------





const server = new ApolloServer({
  typeDefs,
  resolvers,
  // -- 登入 token 用 context 傳
  context: async ({ req }) => {
    // 1. 取出
    const token = req.headers['x-token'];
    // 如果沒有 token 就回傳空的 context 出
    if (!token) {
      return {}
    }

    // 2. 檢查 token + 取得解析出的資料，放進 context
    try {
      const me = await jwt.verify(token, SECRET);
      return { me };
    } catch (e) {
      throw new Error('Your session expired. Sign in again.');
    }
  }
  // --
});

server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
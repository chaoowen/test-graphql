const { gql, ForbiddenError, AuthenticationError } = require('apollo-server')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const { userModel } = require('../models');

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String
    age: Int
    friends: [User]
    posts: [Post]
  }

  type Token {
    token: String!
  }

  extend type Query {
    "取得目前使用者"
    me: User
    "取得所有使用者"
    users: [User]
    "依照名字取得特定使用者"
    user(name: String!): User
  }

  input UpdateMyInfoInput {
    name: String,
    age: Int
  }

  extend type Mutation {
    "註冊 (email 與 passwrod 必填)"
    signUp(name: String, email: String!, password: String!): User
    "登入"
    login (email: String!, password: String!): Token
    "修改個人資料"
    updateMyInfo(input: UpdateMyInfoInput): User,
    "加好友"
    addFriend(userId: ID!): User,
  }
`

// ------- helper functions -------
// 加密 & 新增使用者
const hash = (text, saltRounds) => bcrypt.hash(text, saltRounds);
const createToken = ({ id, email, name }, secret) => 
  jwt.sign({ id, email, name }, secret, { expiresIn: '1d' });

// 有無認證
const isAuthenticated = resolverFunc => (parent, args, context) => {
  if (!context.me) throw new ForbiddenError('Not logged in.');
  return resolverFunc.apply(null, [parent, args, context]);
};


// ------- resolver -------
const resolvers = {
  Query: {
    me: isAuthenticated((root, args, { userModel, me }) => userModel.findUserByUserId(me.id)),
    users: () => users,
    user: (root, { name }, { userModel }) => userModel.findUserByName(name),
  },
  // -- mutation
  Mutation: {
    // ------- 註冊 -------
    signUp: async (root, { name, email, password }, { userModel, saltRounds }) => {
      // 1. 檢查不能有重複註冊 email
      if (userModel.isUserEmailDuplicate(email)) throw new Error('User Email Duplicate');
      // 2. 將 passwrod 加密再存進去
      const hashedPassword = await hash(password, saltRounds);
      // 3. 建立新 user
      return userModel.addUser({ name, email, password: hashedPassword });
    },
    // ------- 登入 -------
    login: async (root, { email, password }, { secret }) => {
      // 1. 透過 email 找到相對應的 user
      const user = userModel.findUserByEmail(email);
      if (!user) throw new Error('Email Account Not Exists');

      // 2. 將傳進來的 password 與資料庫存的 user.password 做比對
      const passwordIsValid = await bcrypt.compare(password, user.password);
      if (!passwordIsValid) throw new Error('Wrong Password');
      
      // 3. 成功則回傳 token
      return { token: await createToken(user, secret) };
    },
    updateMyInfo: isAuthenticated((parent, { input }, { me, userModel }) => {
      // 過濾空值
      const data = ["name", "age"].reduce(
        (obj, key) => (input[key] ? { ...obj, [key]: input[key] } : obj),
        {}
      );
      return userModel.updateUserInfo(me.id, data);
    }),
    addFriend: isAuthenticated((parent, { userId }, { me: { id: meId }, userModel }) => {
      if (!me) throw new Error ('Plz Log In First');
      const me = userModel.findUserByUserId(meId);
      if (me.friendIds.include(userId))
        throw new Error(`User ${userId} Already Friend.`);

      const friend = userModel.findUserByUserId(userId);
      const newMe = userModel.updateUserInfo(meId, {
        friendIds: me.friendIds.concat(userId)
      });
      userModel.updateUserInfo(userId, { friendIds: friend.friendIds.concat(meId) });

      return newMe;
    }),
  },
  // --
  User: {
    posts: (parent, args, { postModel }) => postModel.filterPostsByUserId(parent.id),
    friends: (parent, args, { userModel }) => userModel.filterUsersByUserIds(parent.friendIds || [])
  }
};


module.exports = {
  typeDefs,
  resolvers
};
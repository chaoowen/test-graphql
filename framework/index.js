const { ApolloServer } = require('apollo-server')
const jwt = require('jsonwebtoken')
const { typeDefs, resolvers } = require('./schema')
const { userModel, postModel } = require('./models/index.js')
// 引入.env
require('dotenv').config()

// 定義 bcrypt 加密所需 saltRounds 次數
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS);
// 定義 jwt 所需 secret (可隨便打)
const SECRET = process.env.SECRET;

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
    const context = {
      userModel,
      postModel
    }
    const token = req.headers['x-token'];
    if (token) {
      try {
        const me = await jwt.verify(token, SECRET)
        return { ...context, me }
      } catch (e) {
        throw new Error('Your session expired. Sign in again.')
      }
    }
    return context
  }
  // --
});

server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
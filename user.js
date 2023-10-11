const { ApolloServer, gql } = require('apollo-server');

// 1. 加入假資料
const users = [
  { id: 1, name: 'Fong', age: 23, friendIds: [2, 3] },
  { id: 2, name: 'Kevin', age: 40, friendIds: [1] },
  { id: 3, name: 'Mary', age: 18, friendIds: [1] }
];

// The GraphQL schema
// 2. 新增 User type 、在 Query 中新增 me field
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
  }

  type Query {
    "取得當下使用者"
    me: User
    "取得所有使用者"
    users: [User]
    "取得特定 user (name 為必填)"
    selectedUser(name: String!): User
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    // 加上 me 的 resolver (一定要在 Query 中喔)
    me: () => users[0],
    // 3-1 在 `Query` 裡新增 `users`
    users: () => users,
    // ** add variables **
    selectedUser: (root, args, context) => {
      // 取出參數。因為 name 為 non-null 故一定會有值。
      const { name } = args;
      return users.find(user => user.name === name);
    }
  },
  // 3-2 新增 `User` 並包含 `friends` 的 field resolver
  User: {
    // 每個 Field Resolver 都會預設傳入三個參數，
    // 分別為上一層的資料 (即 user)、參數 (下一節會提到) 以及 context (全域變數)
    friends: (parent, args, context) => {
      // 從 user 資料裡提出 friendIds
      const { friendIds } = parent;
      // Filter 出所有 id 出現在 friendIds 的 user
      return users.filter(user => friendIds.includes(user.id));
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
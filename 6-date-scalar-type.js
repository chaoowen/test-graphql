const { ApolloServer, gql } = require('apollo-server');
// GraphQLScalarType 用來建造新的 Scalar Type 的 class
const { GraphQLScalarType } = require('graphql')
// 在建造新的 GraphQLScalarType 時，parseLiteral function 會用 Kind 來檢查 Type 是否合乎需求
const { Kind } = require('graphql/language')

// Schema
const typeDefs = gql`
  """
  日期格式。顯示時以 Unix Timestamp in Milliseconds 呈現。
  """
  scalar Date

  # 宣告後就可以在底下直接使用
  type Query {
    # 獲取現在時間
    now: Date
    # 詢問日期是否為週五... TGIF!!
    isFriday(date: Date!): Boolean
  }
`

const resolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value) {
      // 輸出到前端
      // 回傳 unix timestamp 值
      return value.getTime();
    },
    parseValue(value) {
      // 從前端 variables 進來的 input
      // 回傳 Date Object 到 Resolver
      return new Date(value);
    },
    parseLiteral(ast) {
      // 從前端 query 字串進來的 input
      // 這邊僅接受輸入進來的是 Int 值
      if (ast.kind === Kind.INT) {
        // 回傳 Date Object 到 Resolver (記得要先 parseInt)
        return new Date(parseInt(ast.value, 10)); // ast value is always in string format
      }
      return null;
    }
  }),
  Query: {
    now: () => new Date(),
    isFriday: (root, { date }) => date.getDay() === 5
  }
}

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`? Server ready at ${url}`);
});
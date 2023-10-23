
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
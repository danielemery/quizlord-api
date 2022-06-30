import { gql } from "apollo-server";

const typeDefs = gql`
  scalar Date

  enum QuizType {
    SHARK
    BRAINWAVES
  }

  enum QuizState {
    PENDING_UPLOAD
    READY
  }

  type PageInfo {
    hasNextPage: Boolean
    startCursor: String
    endCursor: String
  }

  type Quiz {
    id: String!
    type: QuizType!
    state: QuizState!
    date: Date!
    imageLink: String
    uploadedAt: Date!
    uploadedBy: String!
  }

  type QuizEdge {
    node: Quiz
    cursor: String
  }

  type QuizConnection {
    edges: [QuizEdge]!
    pageInfo: PageInfo!
  }

  type CreateQuizResult {
    quiz: Quiz!
    uploadLink: String!
  }

  type Query {
    quizzes(first: Int, after: String): QuizConnection
    quiz(id: String): Quiz
  }

  type Mutation {
    createQuiz(
      type: QuizType!
      date: Date!
      fileName: String!
    ): CreateQuizResult
  }
`;

export default typeDefs;

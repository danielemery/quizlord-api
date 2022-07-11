import { gql } from 'apollo-server';

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
    uploadedAt: Date!
    uploadedBy: String!
    myCompletions: [QuizCompletion]
  }

  type QuizDetails {
    id: String!
    type: QuizType!
    state: QuizState!
    date: Date!
    imageLink: String
    uploadedAt: Date!
    uploadedBy: String!
    completions: [QuizCompletion]
  }

  type QuizEdge {
    node: Quiz!
    cursor: String!
  }

  type QuizConnection {
    edges: [QuizEdge]!
    pageInfo: PageInfo!
  }

  type User {
    email: String!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type UserConnection {
    edges: [UserEdge]!
    pageInfo: PageInfo!
  }

  type CreateQuizResult {
    quiz: Quiz!
    uploadLink: String!
  }

  type QuizCompletion {
    completedAt: Date!
    completedBy: [String]!
    score: Float!
  }

  type CompleteQuizResult {
    completion: QuizCompletion
  }

  type Query {
    quizzes(first: Int, after: String): QuizConnection
    quiz(id: String!): QuizDetails
    users(first: Int, after: String): UserConnection
  }

  type Mutation {
    createQuiz(type: QuizType!, date: Date!, fileName: String!): CreateQuizResult
    completeQuiz(quizId: String!, completedBy: [String]!, score: Float!): CompleteQuizResult
  }
`;

export default typeDefs;

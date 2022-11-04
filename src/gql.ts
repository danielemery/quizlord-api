import { gql } from 'apollo-server';

const typeDefs = gql`
  scalar Date

  enum QuizType {
    SHARK
    BRAINWAVES
  }

  enum QuizImageState {
    PENDING_UPLOAD
    READY
  }

  enum UserRole {
    USER
    ADMIN
  }

  enum QuizImageType {
    QUESTION
    ANSWER
    QUESTION_AND_ANSWER
  }

  type PageInfo {
    hasNextPage: Boolean
    startCursor: String
    endCursor: String
  }

  type Quiz {
    id: String!
    type: QuizType!
    date: Date!
    uploadedAt: Date!
    uploadedBy: User!
    myCompletions: [QuizCompletion]
  }

  type QuizImage {
    imageLink: String!
    state: QuizImageState!
    type: QuizImageType!
  }

  type QuizDetails {
    id: String!
    type: QuizType!
    date: Date!
    uploadedAt: Date!
    uploadedBy: User!
    completions: [QuizCompletion]
    images: [QuizImage]
  }

  type QuizEdge {
    node: Quiz!
    cursor: String!
  }

  type QuizConnection {
    edges: [QuizEdge]!
    pageInfo: PageInfo!
  }

  type UserDetails {
    email: String!
    roles: [UserRole]!
  }

  type User {
    email: String!
    name: String
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type UserConnection {
    edges: [UserEdge]!
    pageInfo: PageInfo!
  }

  input CreateQuizFile {
    fileName: String!
    type: QuizImageType!
  }

  type CreateQuizFileNameToUploadLink {
    fileName: String!
    link: String!
  }

  type CreateQuizResult {
    quiz: Quiz!
    uploadLinks: [CreateQuizFileNameToUploadLink]!
  }

  type QuizCompletion {
    completedAt: Date!
    completedBy: [User]!
    score: Float!
  }

  type CompleteQuizResult {
    completion: QuizCompletion
  }

  type Query {
    quizzes(first: Int, after: String): QuizConnection
    quiz(id: String!): QuizDetails
    users(first: Int, after: String): UserConnection
    me: UserDetails
  }

  type Mutation {
    createQuiz(type: QuizType!, date: Date!, files: [CreateQuizFile]): CreateQuizResult
    completeQuiz(quizId: String!, completedBy: [String]!, score: Float!): CompleteQuizResult
  }
`;

export default typeDefs;

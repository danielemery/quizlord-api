import gql from 'graphql-tag';

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

  enum UserSortOption {
    EMAIL_ASC
    NAME_ASC
    NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC
  }

  enum IndividualUserStatisticsSortOption {
    QUIZZES_COMPLETED_DESC
    AVERAGE_SCORE_DESC
  }

  enum ActivityActionType {
    QUIZ_COMPLETED
    QUIZ_UPLOADED
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

  type IndividualUserStatistic {
    name: String
    email: String!
    totalQuizCompletions: Int!
    averageScorePercentage: Float!
  }

  enum ExcludeIllegibleOptions {
    """
    Exclude quizzes that have been marked as illegible by me.
    """
    ME
    """
    Exclude quizzes that have been marked as illegible by anyone.
    """
    ANYONE
  }

  "Optional action that can be taken when the activity is clicked"
  type RecentActivityAction {
    "Name of the action to take when the activity is clicked"
    name: String!
    "Link to the url to navigate to when the activity is clicked"
    link: String!
  }

  "An item in the recent activity feed"
  type RecentActivityItem {
    "The date the activity occurred"
    date: Date!
    "The type of activity that occurred"
    actionType: ActivityActionType!
    "The id of the resource that the activity relates to"
    resourceId: String!
    "The text to display for the activity"
    text: String!
    "The user who performed the activity"
    users: [User]!
    "Optional action to take when the activity is clicked"
    action: RecentActivityAction
  }

  "Available filters for the quizzes query"
  input QuizFilters {
    """
    Optional list of user emails.
    If provided, only quizzes completed by none of these users will be included in the results.
    """
    excludeCompletedBy: [String]
    """
    Optional option to exclude quizzes that have been marked as illegible.
    """
    excludeIllegible: ExcludeIllegibleOptions
  }

  type Query {
    """
    Get a paged list of quizzes.
    Optionally filter using the filters parameter.
    """
    quizzes(
      "The number of results to return, capped at 100"
      first: Int
      "The cursor to start returning results from, for pagination"
      after: String
      "The filters to apply to the query"
      filters: QuizFilters
    ): QuizConnection
    quiz(id: String!): QuizDetails
    """
    Get a paged list of users.
    """
    users(first: Int, after: String, sortedBy: UserSortOption): UserConnection
    me: UserDetails
    """
    Get statistics for every user.
    Optionally sort using the sortedBy parameter.

    Results from this endpoint may be delayed by up to 24 hours.
    """
    individualUserStatistics(
      "The sorting option to use"
      sortedBy: IndividualUserStatisticsSortOption
    ): [IndividualUserStatistic]

    """
    Get the most recent activities.
    """
    activityFeed: [RecentActivityItem]
  }

  type Mutation {
    createQuiz(type: QuizType!, date: Date!, files: [CreateQuizFile]): CreateQuizResult
    completeQuiz(quizId: String!, completedBy: [String]!, score: Float!): CompleteQuizResult
    markQuizIllegible(quizId: String!): Boolean
  }
`;

export default typeDefs;

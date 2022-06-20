import { Quiz } from "./models";

const sampleQuizzes: Quiz[] = [
  {
    type: "SHARK",
    date: new Date("2022-06-13"),
    imageLink: "",
    state: "READY",
  },
];

class Persistence {
  #data: Quiz[] = sampleQuizzes;

  async getQuizzes(): Promise<Quiz[]> {
    return this.#data;
  }

  async createQuiz(quiz: Quiz): Promise<Quiz> {
    this.#data.push(quiz);
    return quiz;
  }
}

export const persistence = new Persistence();

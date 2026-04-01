import { explainIssue } from "./src/services/aiService.js";

const run = async () => {
  const result = await explainIssue("SQL Injection vulnerability");
  console.log(result);
};

run();

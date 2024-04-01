const fs = require("fs");
const readline = require("readline");

// Read the json schema argument
const schemaPath = process.argv[2];
if (!schemaPath) {
  console.error("First argument must be a JSON Schema file. Exiting...");
  process.exit(1);
}

let schemaContent;
try {
  schemaContent = fs.readFileSync(schemaPath, "utf8");
} catch (err) {
  console.log(`ERROR while reading the schema file ${schemaPath}:\n${err}`);
  process.exit(1);
}

const schema = JSON.parse(schemaContent);

// Read the output schema if it does exists
let outputData,
  introText = `This script will help you generate a JSON file that follow the schema describe in ${schemaPath} file.`;

let outputFilename = "output.json";
if (schema.metadata) {
  outputFilename = schema.metadata.output || "output.json";
  introText = schema.metadata.intro || introText;
}

console.log(
  `\n============================================================\n${introText}\n============================================================`
);

try {
  const outputContent = fs.readFileSync(outputFilename, "utf8");
  outputData = JSON.parse(outputContent);
  console.log(`An existing ${outputFilename} was found. Existing value will be proposed as default\n`);
} catch (err) {
  if (err.code !== "ENOENT") {
    console.error(`Error while reading the output file (${outputFilename}):\n${err}`);
    process.exit(1);
  }
}

// Create the interface for the interactive readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Recursive function to browse the schema
function askQuestions(obj, parentKey = "", currentObj = {}) {
  return new Promise((resolve) => {
    const questions = Object.keys(obj);
    let questionIndex = 0;

    const askQuestion = () => {
      if (questionIndex >= questions.length) {
        resolve(currentObj);
        return;
      }

      const key = questions[questionIndex];
      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      if (obj[key].type === "object" && obj[key].properties) {
        const existingValue = outputData && getValueFromPath(outputData, fullKey) !== undefined ? getValueFromPath(outputData, fullKey) : {};
        askQuestions(obj[key].properties, fullKey, existingValue).then((result) => {
          currentObj[key] = result;
          questionIndex++;
          askQuestion();
        });
      } else {
        const existingValue = outputData && getValueFromPath(outputData, fullKey) !== undefined ? getValueFromPath(outputData, fullKey) : "";
        let questionText = `\nAttribute "${fullKey}": ${obj[key].description}`;
        questionText += `\nType: ${obj[key].type} (${existingValue}): `;

        rl.question(questionText, (value) => {
          currentObj[key] = value || existingValue;
          questionIndex++;
          askQuestion();
        });
      }
    };

    askQuestion();
  });
}

// Fonction pour récupérer une valeur à partir d'un chemin dans un objet
function getValueFromPath(obj, path) {
  const keys = path.split(".");
  let currentObj = obj;

  for (const key of keys) {
    if (currentObj[key] === undefined) {
      return undefined;
    }

    currentObj = currentObj[key];
  }

  return currentObj;
}

// Démarrer le questionnaire interactif

console.log(`\n----- Let's start -----\n`);
askQuestions(schema.properties).then((result) => {
  fs.writeFileSync(outputFilename, JSON.stringify(result, null, 2), "utf8");
  console.log(`\n\n----- Well done! -----\nYour file ${outputFilename} has been generated/updated`);
  rl.close();
});

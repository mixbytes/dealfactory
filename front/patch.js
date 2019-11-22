// Adds d.ts to react-scripts file types

const fs = require("fs");

const pathsFilePath = "./node_modules/react-scripts/config/paths.js";
const pathsFileContent = fs.readFileSync(pathsFilePath).toString();

const newPathsFileContent = pathsFileContent.replace(
    "const moduleFileExtensions = [",
    "const moduleFileExtensions = [\n  'd.ts',"
);

fs.writeFileSync(pathsFilePath, newPathsFileContent);

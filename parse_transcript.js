const fs = require("fs");
const path = "C:/Users/Zian/.claude/projects/e--AntiGravity-Projects-Upwork-Researcher/61cdfa3f-6cbf-4c2e-9d36-18764b953234.jsonl";
const lines = fs.readFileSync(path, "utf-8").split("\n");
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.role === "human") {
      const content = obj.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === "text" && c.text.indexOf("<system") !== 0) {
            console.log("USER:", c.text.substring(0, 400));
          }
        }
      } else if (typeof content === "string" && content.indexOf("<system") !== 0) {
        console.log("USER:", content.substring(0, 400));
      }
    }
  } catch(e) {}
}
